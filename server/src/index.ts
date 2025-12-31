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
  hostId: string;
  createdAt: number;
  lastActivity: number;
  players: Map<string, RoomPlayer>;
};

const PORT = Number(process.env.PORT ?? "8787");
const ROOM_IDLE_TTL_MS = 10 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 30 * 1000;
const FIXED_ROOM_PLAYER_COUNT = DEFAULT_ROOM_PLAYER_COUNT;

const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, Client>();

const createId = () => {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }
  return randomBytes(8).toString("hex");
};

const createSeed = () => randomBytes(8).toString("hex");

const buildPlayersList = (room: Room): RoomPlayerInfo[] =>
  Array.from(room.players.values())
    .map((player) => ({ id: player.id, index: player.index, isHost: player.isHost }))
    .sort((a, b) => a.index - b.index);

const sendJson = (ws: WebSocket, message: RoomServerMessage) => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
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

  if (wasHost) {
    closeRoom(room, "host-left");
    return;
  }

  if (room.players.size === 0) {
    rooms.delete(room.code);
    logRoom(room, "removed (empty)");
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
  sendJson(client.ws, {
    type: "room-joined",
    code: room.code,
    roomId: room.id,
    playerIndex: index,
    playerCount: room.playerCount,
    seed: room.seed,
    inputDelayFrames: room.inputDelayFrames,
    players: buildPlayersList(room)
  });

  broadcastRoom(room, { type: "room-updated", players: buildPlayersList(room) }, client.id);
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

  const message: RoomServerMessage = {
    type: "start",
    seed: room.seed,
    startFrame: 0,
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

  const host = room.players.get(room.hostId);
  if (host) {
    sendJson(host.ws, { type: "resync-request", fromFrame, reason, requesterId: client.id });
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
    if (player.ws.readyState === player.ws.OPEN) {
      player.ws.send(data);
    }
  }
  touchRoom(room);
};

const handleClientMessage = (client: Client, message: RoomClientMessage) => {
  client.lastSeenAt = Date.now();

  switch (message.type) {
    case "create-room":
      handleCreateRoom(client, message);
      return;
    case "join-room":
      handleJoinRoom(client, message);
      return;
    case "leave-room":
      removeClientFromRoom(client, "left");
      return;
    case "start-room":
      handleStartRoom(client);
      return;
    case "ping":
      client.lastPingAt = Date.now();
      sendJson(client.ws, { type: "pong", ts: message.ts });
      return;
    case "resync-request":
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
    lastPingAt: 0
  };
  clients.set(ws, client);

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      const buffer = data instanceof ArrayBuffer ? data : (data as Buffer).buffer.slice((data as Buffer).byteOffset, (data as Buffer).byteOffset + (data as Buffer).byteLength);
      handleBinaryMessage(client, buffer);
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
