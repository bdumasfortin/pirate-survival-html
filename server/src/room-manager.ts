import { randomBytes, randomUUID } from "node:crypto";
import {
  DEFAULT_INPUT_DELAY_FRAMES,
  DEFAULT_ROOM_PLAYER_COUNT,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RoomPlayerInfo,
} from "../../shared/room-protocol.js";
import type { Client, Room, RoomPlayer } from "./types.js";

export const FIXED_ROOM_PLAYER_COUNT = DEFAULT_ROOM_PLAYER_COUNT;
export const ROOM_START_FRAME = 0;
export const MAX_PLAYER_NAME_LENGTH = 16;

export const createId = (): string => {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }
  return randomBytes(8).toString("hex");
};

export const createSeed = (): string => randomBytes(8).toString("hex");

export const sanitizePlayerName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.slice(0, MAX_PLAYER_NAME_LENGTH);
};

export const buildPlayersList = (room: Room): RoomPlayerInfo[] =>
  Array.from(room.players.values())
    .map((player) => ({ id: player.id, index: player.index, isHost: player.isHost, name: player.name }))
    .sort((a, b) => a.index - b.index);

export const generateRoomCode = (rooms: Map<string, Room>): string => {
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

export const logRoom = (room: Room, message: string): void => {
  const players = room.players.size;
  console.info(`[${room.code}] ${message} | players=${players}/${room.playerCount}`);
};

export const touchRoom = (room: Room): void => {
  room.lastActivity = Date.now();
};

export const addPlayerToRoom = (room: Room, client: Client, index: number, isHost: boolean, name: string): void => {
  const now = Date.now();
  const player: RoomPlayer = {
    id: client.id,
    index,
    isHost,
    name,
    ws: client.ws,
    lastSeenAt: now,
    lastPingAt: client.lastPingAt
  };
  room.players.set(client.id, player);
  client.roomCode = room.code;
  room.lastActivity = now;
};

export const assignHost = (room: Room): void => {
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

export const getNextPlayerIndex = (room: Room): number => {
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

export const createRoom = (
  client: Client,
  playerName: string,
  rooms: Map<string, Room>,
  seed?: string,
  inputDelayFrames?: number
): Room => {
  const now = Date.now();
  const room: Room = {
    id: createId(),
    code: generateRoomCode(rooms),
    seed: seed ?? createSeed(),
    inputDelayFrames: Math.max(0, Math.floor(inputDelayFrames ?? DEFAULT_INPUT_DELAY_FRAMES)),
    playerCount: FIXED_ROOM_PLAYER_COUNT,
    started: false,
    startFrame: ROOM_START_FRAME,
    hostId: client.id,
    createdAt: now,
    lastActivity: now,
    players: new Map()
  };
  return room;
};

