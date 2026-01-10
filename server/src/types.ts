import type { WebSocket } from "ws";

import type { WorldPreset } from "../../shared/room-protocol.js";

export type Client = {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
  lastSeenAt: number;
  lastPingAt: number;
  rateLimits: Map<string, { windowStart: number; count: number }>;
};

export type RoomPlayer = {
  id: string;
  index: number;
  isHost: boolean;
  name: string;
  ws: WebSocket;
  lastSeenAt: number;
  lastPingAt: number;
};

export type Room = {
  id: string;
  code: string;
  seed: string;
  worldPreset: WorldPreset;
  inputDelayFrames: number;
  playerCount: number;
  started: boolean;
  startFrame: number;
  hostId: string;
  createdAt: number;
  lastActivity: number;
  players: Map<string, RoomPlayer>;
};
