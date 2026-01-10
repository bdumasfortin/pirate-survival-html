import http from "node:http";

import { type WebSocket, WebSocketServer } from "ws";

import type { RoomClientMessage, RoomServerErrorCode, RoomServerMessage } from "../../shared/room-protocol.js";
import {
  handleBinaryMessage,
  handleCloseRoom,
  handleCreateRoom,
  handleJoinRoom,
  handleRemoveClientFromRoom,
  handleResyncChunk,
  handleResyncRequest,
  handleResyncState,
  handleStartRoom,
  handleStateHash,
} from "./message-handlers.js";
import {
  allowRate,
  RATE_BINARY_LIMIT,
  RATE_CREATE_LIMIT,
  RATE_JOIN_LIMIT,
  RATE_RESYNC_CHUNK_LIMIT,
  RATE_RESYNC_META_LIMIT,
  RATE_RESYNC_REQUEST_LIMIT,
  RATE_START_LIMIT,
  RATE_STATE_HASH_LIMIT,
  RATE_WINDOW_MEDIUM_MS,
  RATE_WINDOW_SHORT_MS,
} from "./rate-limit.js";
import { createId, logRoom } from "./room-manager.js";
import type { Client, Room } from "./types.js";
import { validateMessageStructure } from "./validation.js";

const PORT = Number(process.env.PORT ?? "8787");
const ROOM_IDLE_TTL_MS = 60 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 30 * 1000;
const INPUT_PACKET_SIZE = 26;
const MAX_JSON_MESSAGE_BYTES = 64 * 1024;
const MAX_BINARY_MESSAGE_BYTES = 1024;

const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, Client>();

const parseClientMessage = (data: string): RoomClientMessage | null => {
  try {
    const parsed = JSON.parse(data);
    // Validate message structure
    if (validateMessageStructure(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const sendJson = (ws: WebSocket, message: RoomServerMessage): void => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
};

const sendError = (ws: WebSocket, code: RoomServerErrorCode, message: string): void => {
  sendJson(ws, { type: "error", code, message });
};

const handleClientMessage = (client: Client, message: RoomClientMessage): void => {
  client.lastSeenAt = Date.now();

  switch (message.type) {
    case "create-room":
      if (!allowRate(client, "create-room", RATE_CREATE_LIMIT, RATE_WINDOW_MEDIUM_MS)) {
        sendError(client.ws, "bad-request", "Rate limit exceeded for create-room.");
        return;
      }
      handleCreateRoom(client, message, rooms);
      return;
    case "join-room":
      if (!allowRate(client, "join-room", RATE_JOIN_LIMIT, RATE_WINDOW_MEDIUM_MS)) {
        sendError(client.ws, "bad-request", "Rate limit exceeded for join-room.");
        return;
      }
      handleJoinRoom(client, message, rooms);
      return;
    case "leave-room":
      handleRemoveClientFromRoom(client, "left", rooms);
      return;
    case "start-room":
      if (!allowRate(client, "start-room", RATE_START_LIMIT, RATE_WINDOW_MEDIUM_MS)) {
        sendError(client.ws, "bad-request", "Rate limit exceeded for start-room.");
        return;
      }
      handleStartRoom(client, rooms);
      return;
    case "resync-state":
      if (!allowRate(client, "resync-state", RATE_RESYNC_META_LIMIT, RATE_WINDOW_SHORT_MS)) {
        return;
      }
      handleResyncState(client, message, rooms);
      return;
    case "resync-chunk":
      if (!allowRate(client, "resync-chunk", RATE_RESYNC_CHUNK_LIMIT, RATE_WINDOW_SHORT_MS)) {
        return;
      }
      handleResyncChunk(client, message, rooms);
      return;
    case "state-hash":
      if (!allowRate(client, "state-hash", RATE_STATE_HASH_LIMIT, RATE_WINDOW_SHORT_MS)) {
        return;
      }
      handleStateHash(client, message.frame, message.hash, rooms);
      return;
    case "ping":
      client.lastPingAt = Date.now();
      sendJson(client.ws, { type: "pong", ts: message.ts });
      return;
    case "resync-request":
      if (!allowRate(client, "resync-request", RATE_RESYNC_REQUEST_LIMIT, RATE_WINDOW_MEDIUM_MS)) {
        return;
      }
      handleResyncRequest(client, message.fromFrame, message.reason, rooms);
      return;
    default:
      sendError(
        client.ws,
        "bad-request",
        `Unknown message type: ${(message as { type?: string }).type ?? "undefined"}.`
      );
  }
};

// Server setup
const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const client: Client = {
    id: createId(),
    ws,
    roomCode: null,
    lastSeenAt: Date.now(),
    lastPingAt: 0,
    rateLimits: new Map(),
  };
  clients.set(ws, client);

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      const byteLength = data instanceof ArrayBuffer ? data.byteLength : (data as Buffer).byteLength;
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
      const buffer =
        data instanceof ArrayBuffer
          ? data
          : (data as Buffer).buffer.slice(
              (data as Buffer).byteOffset,
              (data as Buffer).byteOffset + (data as Buffer).byteLength
            );
      handleBinaryMessage(client, buffer as ArrayBuffer, rooms);
      return;
    }

    const textByteLength = typeof data === "string" ? Buffer.byteLength(data, "utf8") : (data as Buffer).byteLength;
    if (textByteLength > MAX_JSON_MESSAGE_BYTES) {
      ws.close(1009, "Message too big.");
      return;
    }
    const text = typeof data === "string" ? data : data.toString("utf8");
    const message = parseClientMessage(text);
    if (!message) {
      sendError(ws, "bad-request", "Invalid JSON payload or message structure.");
      return;
    }
    handleClientMessage(client, message);
  });

  ws.on("close", () => {
    handleRemoveClientFromRoom(client, "disconnected", rooms);
    clients.delete(ws);
  });
});

// Room cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.players.size === 0) {
      rooms.delete(room.code);
      continue;
    }

    if (now - room.lastActivity > ROOM_IDLE_TTL_MS) {
      handleCloseRoom(room, "idle-timeout");
      rooms.delete(room.code);
      logRoom(room, `Room closed (idle-timeout)`);
    }
  }
}, ROOM_CLEANUP_INTERVAL_MS);

server.listen(PORT, () => {
  console.info(`[server] Room relay listening on :${PORT}`);
});
