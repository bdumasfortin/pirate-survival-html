import type { WebSocket } from "ws";

import {
  isValidRoomCode,
  normalizeRoomCode,
  type ResyncReason,
  ROOM_CODE_LENGTH,
  type RoomClientMessage,
  type RoomServerErrorCode,
  type RoomServerMessage,
} from "../../shared/room-protocol.js";
import {
  addPlayerToRoom,
  assignHost,
  buildPlayersList,
  createRoom,
  getNextPlayerIndex,
  logRoom,
  ROOM_START_FRAME,
  sanitizePlayerName,
  touchRoom,
} from "./room-manager.js";
import type { Client, Room } from "./types.js";

const MAX_FRAME_INDEX = 10_000_000;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_RESYNC_CHUNK_BYTES = 32 * 1024;
const MAX_RESYNC_CHUNK_BASE64 = Math.ceil(MAX_RESYNC_CHUNK_BYTES / 3) * 4 + 16;

const sendJson = (ws: WebSocket, message: RoomServerMessage): void => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
};

const sendError = (ws: WebSocket, code: RoomServerErrorCode, message: string): void => {
  sendJson(ws, { type: "error", code, message });
};

const relayDelayMs = (): number => {
  const RELAY_LATENCY_MS = Math.max(0, Number(process.env.RELAY_LATENCY_MS ?? "0") || 0);
  const RELAY_JITTER_MS = Math.max(0, Number(process.env.RELAY_JITTER_MS ?? "0") || 0);
  if (RELAY_LATENCY_MS <= 0 && RELAY_JITTER_MS <= 0) {
    return 0;
  }
  const jitter = RELAY_JITTER_MS > 0 ? (Math.random() * 2 - 1) * RELAY_JITTER_MS : 0;
  return Math.max(0, RELAY_LATENCY_MS + jitter);
};

const sendRelay = (ws: WebSocket, payload: string | Buffer): void => {
  if (ws.readyState !== ws.OPEN) {
    return;
  }
  const RELAY_DROP_RATE = Math.min(1, Math.max(0, Number(process.env.RELAY_DROP_RATE ?? "0") || 0));
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

const sendRelayJson = (ws: WebSocket, message: RoomServerMessage): void => {
  sendRelay(ws, JSON.stringify(message));
};

const broadcastRoom = (room: Room, message: RoomServerMessage, excludeId?: string): void => {
  for (const player of room.players.values()) {
    if (excludeId && player.id === excludeId) {
      continue;
    }
    sendJson(player.ws, message);
  }
};

// Validation helpers
const validateFrame = (frame: number): boolean => {
  return Number.isFinite(frame) && frame >= 0 && frame <= MAX_FRAME_INDEX;
};

const validateResyncState = (message: Extract<RoomClientMessage, { type: "resync-state" }>): boolean => {
  return (
    validateFrame(message.frame) &&
    Number.isFinite(message.totalBytes) &&
    message.totalBytes > 0 &&
    message.totalBytes <= MAX_SNAPSHOT_BYTES &&
    Number.isFinite(message.chunkSize) &&
    message.chunkSize > 0 &&
    message.chunkSize <= MAX_RESYNC_CHUNK_BYTES
  );
};

const validateResyncChunk = (message: Extract<RoomClientMessage, { type: "resync-chunk" }>): boolean => {
  return (
    Number.isFinite(message.offset) &&
    message.offset >= 0 &&
    message.offset <= MAX_SNAPSHOT_BYTES &&
    message.data.length <= MAX_RESYNC_CHUNK_BASE64
  );
};

// Message handlers
export const handleCreateRoom = (
  client: Client,
  message: Extract<RoomClientMessage, { type: "create-room" }>,
  rooms: Map<string, Room>
): void => {
  if (client.roomCode) {
    sendError(client.ws, "bad-request", "Cannot create room: already in a room.");
    return;
  }

  const playerName = sanitizePlayerName(message.playerName ?? "");
  if (!playerName) {
    sendError(client.ws, "bad-request", "Cannot create room: player name is required and cannot be empty.");
    return;
  }

  const room = createRoom(client, playerName, rooms, message.seed, message.inputDelayFrames);
  addPlayerToRoom(room, client, 0, true, playerName);
  rooms.set(room.code, room);

  sendJson(client.ws, {
    type: "room-created",
    code: room.code,
    roomId: room.id,
    playerIndex: 0,
    playerCount: room.playerCount,
    seed: room.seed,
    inputDelayFrames: room.inputDelayFrames,
    players: buildPlayersList(room),
  });
  logRoom(room, "Room created");
};

export const handleJoinRoom = (
  client: Client,
  message: Extract<RoomClientMessage, { type: "join-room" }>,
  rooms: Map<string, Room>
): void => {
  if (client.roomCode) {
    sendError(client.ws, "bad-request", "Cannot join room: already in a room.");
    return;
  }

  const playerName = sanitizePlayerName(message.playerName ?? "");
  if (!playerName) {
    sendError(client.ws, "bad-request", "Cannot join room: player name is required and cannot be empty.");
    return;
  }

  const code = normalizeRoomCode(message.code);
  if (!isValidRoomCode(code)) {
    sendError(
      client.ws,
      "invalid-code",
      `Cannot join room: invalid room code format. Expected ${ROOM_CODE_LENGTH} characters from the allowed alphabet.`
    );
    return;
  }

  const room = rooms.get(code);
  if (!room) {
    sendError(client.ws, "room-not-found", `Cannot join room: room with code "${code}" does not exist.`);
    return;
  }

  // Check if room has already started - reject late join immediately
  if (room.started) {
    sendError(
      client.ws,
      "room-already-started",
      "Cannot join room: the game session has already started. Late joining is not supported."
    );
    logRoom(room, `Rejected join request (room already started)`);
    return;
  }

  // Check if room has space
  if (room.players.size >= room.playerCount) {
    sendError(
      client.ws,
      "room-full",
      `Cannot join room: room is full (${room.players.size}/${room.playerCount} players).`
    );
    return;
  }

  const index = getNextPlayerIndex(room);
  addPlayerToRoom(room, client, index, false, playerName);

  logRoom(room, `Player joined | index=${index} id=${client.id}`);

  client.roomCode = room.code;
  touchRoom(room);

  const players = buildPlayersList(room);
  sendJson(client.ws, {
    type: "room-joined",
    code: room.code,
    roomId: room.id,
    playerIndex: index,
    playerCount: room.playerCount,
    seed: room.seed,
    inputDelayFrames: room.inputDelayFrames,
    players,
  });

  broadcastRoom(room, { type: "room-updated", players }, client.id);
};

export const handleStartRoom = (client: Client, rooms: Map<string, Room>): void => {
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
    players: buildPlayersList(room),
  };
  broadcastRoom(room, message);
  logRoom(room, "Game session started");
};

export const handleResyncRequest = (
  client: Client,
  fromFrame: number,
  reason: ResyncReason,
  rooms: Map<string, Room>
): void => {
  const room = client.roomCode ? rooms.get(client.roomCode) : null;
  if (!room) {
    sendError(client.ws, "not-in-room", "Not in a room.");
    return;
  }
  if (!validateFrame(fromFrame)) {
    sendError(client.ws, "bad-request", "Invalid resync frame.");
    return;
  }

  const host = room.players.get(room.hostId);
  if (host && host.ws) {
    sendRelayJson(host.ws, { type: "resync-request", fromFrame, reason, requesterId: client.id });
  }
  touchRoom(room);
};

export const handleResyncState = (
  client: Client,
  message: Extract<RoomClientMessage, { type: "resync-state" }>,
  rooms: Map<string, Room>
): void => {
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
  if (!requester || !requester.ws) {
    return;
  }
  if (!validateResyncState(message)) {
    return;
  }
  const payload: RoomServerMessage = {
    type: "resync-state",
    frame: Math.max(0, Math.floor(message.frame)),
    seed: message.seed,
    players: message.players,
    snapshotId: message.snapshotId,
    totalBytes: Math.max(0, Math.floor(message.totalBytes)),
    chunkSize: Math.max(1, Math.floor(message.chunkSize)),
  };
  sendRelayJson(requester.ws, payload);
  touchRoom(room);
};

export const handleResyncChunk = (
  client: Client,
  message: Extract<RoomClientMessage, { type: "resync-chunk" }>,
  rooms: Map<string, Room>
): void => {
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
  if (!requester || !requester.ws) {
    return;
  }
  if (!validateResyncChunk(message)) {
    return;
  }
  const payload: RoomServerMessage = {
    type: "resync-chunk",
    snapshotId: message.snapshotId,
    offset: Math.max(0, Math.floor(message.offset)),
    data: message.data,
  };
  sendRelayJson(requester.ws, payload);
  touchRoom(room);
};

export const handleStateHash = (client: Client, frame: number, hash: number, rooms: Map<string, Room>): void => {
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
  if (!validateFrame(frame)) {
    return;
  }
  const message: RoomServerMessage = {
    type: "state-hash",
    playerId: player.id,
    playerIndex: player.index,
    frame: Math.max(0, Math.floor(frame)),
    hash: hash >>> 0,
  };
  for (const entry of room.players.values()) {
    if (entry.id === client.id) {
      continue;
    }
    sendRelayJson(entry.ws, message);
  }
  touchRoom(room);
};

export const handleBinaryMessage = (client: Client, data: ArrayBuffer, rooms: Map<string, Room>): void => {
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

export const handleRemoveClientFromRoom = (client: Client, reason: string, rooms: Map<string, Room>): void => {
  if (!client.roomCode) {
    return;
  }
  const room = rooms.get(client.roomCode);
  if (!room) {
    client.roomCode = null;
    return;
  }

  const player = room.players.get(client.id);
  if (!player) {
    client.roomCode = null;
    return;
  }

  const wasHost = room.hostId === client.id;

  // Remove player completely
  room.players.delete(client.id);
  logRoom(room, `Player ${reason}`);

  client.roomCode = null;
  touchRoom(room);

  // Check if room is empty
  if (room.players.size === 0) {
    rooms.delete(room.code);
    logRoom(room, "Room deleted (empty)");
    return;
  }

  if (wasHost) {
    assignHost(room);
    broadcastRoom(room, { type: "room-updated", players: buildPlayersList(room) });
    logRoom(room, `Host ${reason} (reassigned)`);
    return;
  }

  broadcastRoom(room, { type: "room-updated", players: buildPlayersList(room) });
};

export const handleCloseRoom = (room: Room, reason: string): void => {
  broadcastRoom(room, { type: "room-closed", reason });
  for (const player of room.players.values()) {
    player.ws.close(1000, reason);
  }
};
