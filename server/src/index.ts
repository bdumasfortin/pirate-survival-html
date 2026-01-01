import http from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
  DEFAULT_INPUT_DELAY_FRAMES,
  DEFAULT_ROOM_PLAYER_COUNT,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
  type RoomClientMessage,
  type RoomPlayerInfo,
  type RoomServerErrorCode,
  type RoomServerMessage,
  type ResyncReason
} from "./room-protocol";

type Client = {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
  lastSeenAt: number;
  lastPingAt: number;
  rateLimits: Map<string, { windowStart: number; count: number }>;
};

type RoomPlayer = {
  id: string;
  index: number;
  isHost: boolean;
  ws: WebSocket;
  lastSeenAt: number;
  lastPingAt: number;
};

type Room = {
  id: string;
  code: string;
  seed: string;
  inputDelayFrames: number;
  playerCount: number;
  started: boolean;
  startFrame: number;
  hostId: string;
  createdAt: number;
  lastActivity: number;
  players: Map<string, RoomPlayer>;
};

const PORT = Number(process.env.PORT ?? "8787");
const ROOM_IDLE_TTL_MS = 60 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 30 * 1000;
const FIXED_ROOM_PLAYER_COUNT = DEFAULT_ROOM_PLAYER_COUNT;
const ROOM_START_FRAME = 0;
const INPUT_PACKET_SIZE = 26;
const MAX_JSON_MESSAGE_BYTES = 64 * 1024;
const MAX_BINARY_MESSAGE_BYTES = 1024;
const MAX_FRAME_INDEX = 10_000_000;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_RESYNC_CHUNK_BYTES = 32 * 1024;
const MAX_RESYNC_CHUNK_BASE64 = Math.ceil(MAX_RESYNC_CHUNK_BYTES / 3) * 4 + 16;
const RELAY_LATENCY_MS = Math.max(0, Number(process.env.RELAY_LATENCY_MS ?? "0") || 0);
const RELAY_JITTER_MS = Math.max(0, Number(process.env.RELAY_JITTER_MS ?? "0") || 0);
const RELAY_DROP_RATE = Math.min(1, Math.max(0, Number(process.env.RELAY_DROP_RATE ?? "0") || 0));

const RATE_WINDOW_SHORT_MS = 1000;
const RATE_WINDOW_MEDIUM_MS = 10 * 1000;
const RATE_CREATE_LIMIT = 3;
const RATE_JOIN_LIMIT = 3;
const RATE_START_LIMIT = 5;
const RATE_RESYNC_REQUEST_LIMIT = 20;
const RATE_STATE_HASH_LIMIT = 20;
const RATE_RESYNC_META_LIMIT = 5;
const RATE_RESYNC_CHUNK_LIMIT = 400;
const RATE_BINARY_LIMIT = 240;

const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, Client>();

const createId = () => {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }
  return randomBytes(8).toString("hex");
};

const createSeed = () => randomBytes(8).toString("hex");

const allowRate = (client: Client, key: string, limit: number, windowMs: number) => {
  const now = Date.now();
  const entry = client.rateLimits.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    client.rateLimits.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
};

const buildPlayersList = (room: Room): RoomPlayerInfo[] =>
  Array.from(room.players.values())
    .map((player) => ({ id: player.id, index: player.index, isHost: player.isHost }))
    .sort((a, b) => a.index - b.index);

const sendJson = (ws: WebSocket, message: RoomServerMessage) => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
};

const relayDelayMs = () => {
  if (RELAY_LATENCY_MS <= 0 && RELAY_JITTER_MS <= 0) {
    return 0;
  }
  const jitter = RELAY_JITTER_MS > 0 ? (Math.random() * 2 - 1) * RELAY_JITTER_MS : 0;
  return Math.max(0, RELAY_LATENCY_MS + jitter);
};

const sendRelay = (ws: WebSocket, payload: string | Buffer) => {
  if (ws.readyState !== ws.OPEN) {
    return;
  }
  if (RELAY_DROP_RATE > 0 && Math.random() < RELAY_DROP_RATE) {
    return;
  }
  const delay = relayDelayMs();
  if (delay <= 0) {
    ws.send(payload);
    return;
  }
  setTimeout(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }, delay);
};

const sendRelayJson = (ws: WebSocket, message: RoomServerMessage) => {
  sendRelay(ws, JSON.stringify(message));
};

const sendError = (ws: WebSocket, code: RoomServerErrorCode, message: string) => {
  sendJson(ws, { type: "error", code, message });
};

const broadcastRoom = (room: Room, message: RoomServerMessage, excludeId?: string) => {
  for (const player of room.players.values()) {
    if (excludeId && player.id === excludeId) {
      continue;
    }
    sendJson(player.ws, message);
  }
};

const generateRoomCode = () => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
      code += ROOM_CODE_ALPHABET[index];
    }
    if (!rooms.has(code)) {
      return code;
    }
  }
  return `${randomBytes(3).toString("hex")}`.slice(0, ROOM_CODE_LENGTH).toUpperCase();
};

const logRoom = (room: Room, message: string) => {
  const players = room.players.size;
  const idleMs = Date.now() - room.lastActivity;
  console.info(`[room ${room.code}] ${message} players=${players}/${room.playerCount} idleMs=${idleMs}`);
};

const touchRoom = (room: Room) => {
  room.lastActivity = Date.now();
};

const addPlayerToRoom = (room: Room, client: Client, index: number, isHost: boolean) => {
  const now = Date.now();
  const player: RoomPlayer = {
    id: client.id,
    index,
    isHost,
    ws: client.ws,
    lastSeenAt: now,
    lastPingAt: client.lastPingAt
  };
  room.players.set(client.id, player);
  client.roomCode = room.code;
  room.lastActivity = now;
};

const assignHost = (room: Room) => {
  let nextHost: RoomPlayer | null = null;
  for (const player of room.players.values()) {
    if (!nextHost || player.index < nextHost.index) {
      nextHost = player;
    }
  }

  if (!nextHost) {
    room.hostId = "";
    return;
  }

  room.hostId = nextHost.id;
  for (const player of room.players.values()) {
    player.isHost = player.id === room.hostId;
  }
};

const removeClientFromRoom = (client: Client, reason = "left") => {
  if (!client.roomCode) {
    return;
  }
  const room = rooms.get(client.roomCode);
  if (!room) {
    client.roomCode = null;
    return;
  }

  const wasHost = room.hostId === client.id;
  room.players.delete(client.id);
  client.roomCode = null;
  touchRoom(room);

  if (room.players.size === 0) {
    rooms.delete(room.code);
    logRoom(room, "removed (empty)");
    return;
  }

  if (wasHost) {
    assignHost(room);
    broadcastRoom(room, { type: "room-updated", players: buildPlayersList(room) });
    logRoom(room, `host ${reason} (reassigned)`);
    return;
  }

  broadcastRoom(room, { type: "room-updated", players: buildPlayersList(room) });
  logRoom(room, `player ${reason}`);
};

const closeRoom = (room: Room, reason: string) => {
  broadcastRoom(room, { type: "room-closed", reason });
  for (const player of room.players.values()) {
    player.ws.close(1000, reason);
  }
  rooms.delete(room.code);
  logRoom(room, `closed (${reason})`);
};

const getNextPlayerIndex = (room: Room) => {
  const used = new Set<number>();
  for (const player of room.players.values()) {
    used.add(player.index);
  }
  for (let index = 0; index < room.playerCount; index += 1) {
    if (!used.has(index)) {
      return index;
    }
  }
  return room.playerCount;
};

const handleCreateRoom = (client: Client, message: Extract<RoomClientMessage, { type: "create-room" }>) => {
  if (client.roomCode) {
    sendError(client.ws, "bad-request", "Already in a room.");
    return;
  }

  const playerCount = FIXED_ROOM_PLAYER_COUNT;
  const seed = message.seed ?? createSeed();
  const inputDelayFrames = Math.max(0, Math.floor(message.inputDelayFrames ?? DEFAULT_INPUT_DELAY_FRAMES));
  const code = generateRoomCode();
  const now = Date.now();
  const room: Room = {
    id: createId(),
    code,
    seed,
    inputDelayFrames,
    playerCount,
    started: false,
    startFrame: ROOM_START_FRAME,
    hostId: client.id,
    createdAt: now,
    lastActivity: now,
    players: new Map()
  };

  addPlayerToRoom(room, client, 0, true);
  rooms.set(code, room);

  sendJson(client.ws, {
    type: "room-created",
    code,
    roomId: room.id,
    playerIndex: 0,
    playerCount: room.playerCount,
    seed: room.seed,
    inputDelayFrames: room.inputDelayFrames,
    players: buildPlayersList(room)
  });
  logRoom(room, "created");
};

const handleJoinRoom = (client: Client, message: Extract<RoomClientMessage, { type: "join-room" }>) => {
  if (client.roomCode) {
    sendError(client.ws, "bad-request", "Already in a room.");
    return;
  }

  const code = normalizeRoomCode(message.code);
  if (!isValidRoomCode(code)) {
    sendError(client.ws, "invalid-code", "Invalid room code.");
    return;
  }

  const room = rooms.get(code);
  if (!room) {
    sendError(client.ws, "room-not-found", "Room not found.");
    return;
  }

  if (room.players.size >= room.playerCount) {
    sendError(client.ws, "room-full", "Room is full.");
    return;
  }

  const index = getNextPlayerIndex(room);
  addPlayerToRoom(room, client, index, false);
  const players = buildPlayersList(room);
  sendJson(client.ws, {
    type: "room-joined",
    code: room.code,
    roomId: room.id,
    playerIndex: index,
    playerCount: room.playerCount,
    seed: room.seed,
    inputDelayFrames: room.inputDelayFrames,
    players
  });

  broadcastRoom(room, { type: "room-updated", players }, client.id);
  if (room.started) {
    sendJson(client.ws, {
      type: "start",
      seed: room.seed,
      startFrame: room.startFrame,
      inputDelayFrames: room.inputDelayFrames,
      players
    });
    const host = room.players.get(room.hostId);
    if (host) {
      sendJson(host.ws, {
        type: "resync-request",
        fromFrame: room.startFrame,
        reason: "late-join",
        requesterId: client.id
      });
    }
  }
  logRoom(room, `player joined index=${index}`);
};

const handleStartRoom = (client: Client) => {
  const room = client.roomCode ? rooms.get(client.roomCode) : null;
  if (!room) {
    sendError(client.ws, "not-in-room", "Not in a room.");
    return;
  }
  if (room.hostId !== client.id) {
    sendError(client.ws, "not-host", "Only the host can start the room.");
    return;
  }
  if (room.started) {
    sendError(client.ws, "bad-request", "Room already started.");
    return;
  }

  room.started = true;
  room.startFrame = ROOM_START_FRAME;

  const message: RoomServerMessage = {
    type: "start",
    seed: room.seed,
    startFrame: room.startFrame,
    inputDelayFrames: room.inputDelayFrames,
    players: buildPlayersList(room)
  };
  broadcastRoom(room, message);
  logRoom(room, "started");
};

const handleResyncRequest = (client: Client, fromFrame: number, reason: ResyncReason) => {
  const room = client.roomCode ? rooms.get(client.roomCode) : null;
  if (!room) {
    sendError(client.ws, "not-in-room", "Not in a room.");
    return;
  }
  if (!Number.isFinite(fromFrame) || fromFrame < 0 || fromFrame > MAX_FRAME_INDEX) {
    sendError(client.ws, "bad-request", "Invalid resync frame.");
    return;
  }

  const host = room.players.get(room.hostId);
  if (host) {
    sendRelayJson(host.ws, { type: "resync-request", fromFrame, reason, requesterId: client.id });
  }
  touchRoom(room);
};

const handleResyncState = (client: Client, message: Extract<RoomClientMessage, { type: "resync-state" }>) => {
  const room = client.roomCode ? rooms.get(client.roomCode) : null;
  if (!room) {
    sendError(client.ws, "not-in-room", "Not in a room.");
    return;
  }
  if (room.hostId !== client.id) {
    sendError(client.ws, "not-host", "Only the host can send resync snapshots.");
    return;
  }
  const requester = room.players.get(message.requesterId);
  if (!requester) {
    return;
  }
  if (!Number.isFinite(message.frame) || message.frame < 0 || message.frame > MAX_FRAME_INDEX) {
    return;
  }
  if (!Number.isFinite(message.totalBytes) || message.totalBytes <= 0 || message.totalBytes > MAX_SNAPSHOT_BYTES) {
    return;
  }
  if (!Number.isFinite(message.chunkSize) || message.chunkSize <= 0 || message.chunkSize > MAX_RESYNC_CHUNK_BYTES) {
    return;
  }
  const payload: RoomServerMessage = {
    type: "resync-state",
    frame: Math.max(0, Math.floor(message.frame)),
    seed: message.seed,
    players: message.players,
    snapshotId: message.snapshotId,
    totalBytes: Math.max(0, Math.floor(message.totalBytes)),
    chunkSize: Math.max(1, Math.floor(message.chunkSize))
  };
  sendRelayJson(requester.ws, payload);
  touchRoom(room);
};

const handleResyncChunk = (client: Client, message: Extract<RoomClientMessage, { type: "resync-chunk" }>) => {
  const room = client.roomCode ? rooms.get(client.roomCode) : null;
  if (!room) {
    sendError(client.ws, "not-in-room", "Not in a room.");
    return;
  }
  if (room.hostId !== client.id) {
    sendError(client.ws, "not-host", "Only the host can send resync snapshots.");
    return;
  }
  const requester = room.players.get(message.requesterId);
  if (!requester) {
    return;
  }
  if (!Number.isFinite(message.offset) || message.offset < 0 || message.offset > MAX_SNAPSHOT_BYTES) {
    return;
  }
  if (message.data.length > MAX_RESYNC_CHUNK_BASE64) {
    return;
  }
  const payload: RoomServerMessage = {
    type: "resync-chunk",
    snapshotId: message.snapshotId,
    offset: Math.max(0, Math.floor(message.offset)),
    data: message.data
  };
  sendRelayJson(requester.ws, payload);
  touchRoom(room);
};

const handleStateHash = (client: Client, frame: number, hash: number) => {
  const room = client.roomCode ? rooms.get(client.roomCode) : null;
  if (!room) {
    sendError(client.ws, "not-in-room", "Not in a room.");
    return;
  }
  const player = room.players.get(client.id);
  if (!player) {
    sendError(client.ws, "not-in-room", "Not in a room.");
    return;
  }
  if (!Number.isFinite(frame) || !Number.isFinite(hash)) {
    sendError(client.ws, "bad-request", "Invalid state hash payload.");
    return;
  }
  if (frame < 0 || frame > MAX_FRAME_INDEX) {
    return;
  }
  const message: RoomServerMessage = {
    type: "state-hash",
    playerId: player.id,
    playerIndex: player.index,
    frame: Math.max(0, Math.floor(frame)),
    hash: hash >>> 0
  };
  for (const entry of room.players.values()) {
    if (entry.id === client.id) {
      continue;
    }
    sendRelayJson(entry.ws, message);
  }
  touchRoom(room);
};

const handleBinaryMessage = (client: Client, data: ArrayBuffer) => {
  const room = client.roomCode ? rooms.get(client.roomCode) : null;
  if (!room) {
    return;
  }

  for (const player of room.players.values()) {
    if (player.id === client.id) {
      continue;
    }
    sendRelay(player.ws, Buffer.from(data));
  }
  touchRoom(room);
};

const handleClientMessage = (client: Client, message: RoomClientMessage) => {
  client.lastSeenAt = Date.now();

  switch (message.type) {
    case "create-room":
      if (!allowRate(client, "create-room", RATE_CREATE_LIMIT, RATE_WINDOW_MEDIUM_MS)) {
        sendError(client.ws, "bad-request", "Rate limit exceeded.");
        return;
      }
      handleCreateRoom(client, message);
      return;
    case "join-room":
      if (!allowRate(client, "join-room", RATE_JOIN_LIMIT, RATE_WINDOW_MEDIUM_MS)) {
        sendError(client.ws, "bad-request", "Rate limit exceeded.");
        return;
      }
      handleJoinRoom(client, message);
      return;
    case "leave-room":
      removeClientFromRoom(client, "left");
      return;
    case "start-room":
      if (!allowRate(client, "start-room", RATE_START_LIMIT, RATE_WINDOW_MEDIUM_MS)) {
        sendError(client.ws, "bad-request", "Rate limit exceeded.");
        return;
      }
      handleStartRoom(client);
      return;
    case "resync-state":
      if (!allowRate(client, "resync-state", RATE_RESYNC_META_LIMIT, RATE_WINDOW_SHORT_MS)) {
        return;
      }
      handleResyncState(client, message);
      return;
    case "resync-chunk":
      if (!allowRate(client, "resync-chunk", RATE_RESYNC_CHUNK_LIMIT, RATE_WINDOW_SHORT_MS)) {
        return;
      }
      handleResyncChunk(client, message);
      return;
    case "state-hash":
      if (!allowRate(client, "state-hash", RATE_STATE_HASH_LIMIT, RATE_WINDOW_SHORT_MS)) {
        return;
      }
      handleStateHash(client, message.frame, message.hash);
      return;
    case "ping":
      client.lastPingAt = Date.now();
      sendJson(client.ws, { type: "pong", ts: message.ts });
      return;
    case "resync-request":
      if (!allowRate(client, "resync-request", RATE_RESYNC_REQUEST_LIMIT, RATE_WINDOW_MEDIUM_MS)) {
        return;
      }
      handleResyncRequest(client, message.fromFrame, message.reason);
      return;
    default:
      sendError(client.ws, "bad-request", "Unknown message type.");
  }
};

const parseClientMessage = (data: string) => {
  try {
    return JSON.parse(data) as RoomClientMessage;
  } catch {
    return null;
  }
};

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const client: Client = {
    id: createId(),
    ws,
    roomCode: null,
    lastSeenAt: Date.now(),
    lastPingAt: 0,
    rateLimits: new Map()
  };
  clients.set(ws, client);

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      const byteLength = data instanceof ArrayBuffer
        ? data.byteLength
        : (data as Buffer).byteLength;
      if (byteLength > MAX_BINARY_MESSAGE_BYTES) {
        ws.close(1009, "Message too big.");
        return;
      }
      if (byteLength !== INPUT_PACKET_SIZE) {
        return;
      }
      if (!allowRate(client, "binary", RATE_BINARY_LIMIT, RATE_WINDOW_SHORT_MS)) {
        return;
      }
      const buffer = data instanceof ArrayBuffer
        ? data
        : (data as Buffer).buffer.slice((data as Buffer).byteOffset, (data as Buffer).byteOffset + (data as Buffer).byteLength);
      handleBinaryMessage(client, buffer);
      return;
    }

    const textByteLength = typeof data === "string"
      ? Buffer.byteLength(data, "utf8")
      : (data as Buffer).byteLength;
    if (textByteLength > MAX_JSON_MESSAGE_BYTES) {
      ws.close(1009, "Message too big.");
      return;
    }
    const text = typeof data === "string" ? data : data.toString("utf8");
    const message = parseClientMessage(text);
    if (!message) {
      sendError(ws, "bad-request", "Invalid JSON payload.");
      return;
    }
    handleClientMessage(client, message);
  });

  ws.on("close", () => {
    removeClientFromRoom(client, "disconnected");
    clients.delete(ws);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.players.size === 0) {
      rooms.delete(room.code);
      continue;
    }

    if (now - room.lastActivity > ROOM_IDLE_TTL_MS) {
      closeRoom(room, "idle-timeout");
    }
  }
}, ROOM_CLEANUP_INTERVAL_MS);

server.listen(PORT, () => {
  console.info(`[server] room relay listening on :${PORT}`);
});
