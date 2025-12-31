export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
export const ROOM_MIN_PLAYERS = 2;
export const ROOM_MAX_PLAYERS = 4;
export const DEFAULT_ROOM_PLAYER_COUNT = 2;
export const DEFAULT_INPUT_DELAY_FRAMES = 4;

export const normalizeRoomCode = (code: string) => code.trim().toUpperCase();

const roomCodePattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export const isValidRoomCode = (code: string) => roomCodePattern.test(normalizeRoomCode(code));

export type ResyncReason = "late-join" | "desync";

export type RoomPlayerInfo = {
  id: string;
  index: number;
  isHost: boolean;
};

export type RoomClientMessage =
  | { type: "create-room"; playerCount?: number; seed?: string; inputDelayFrames?: number }
  | { type: "join-room"; code: string }
  | { type: "leave-room" }
  | { type: "start-room" }
  | { type: "resync-state"; requesterId: string; frame: number; seed: string; players: RoomPlayerInfo[]; snapshotId: string; totalBytes: number; chunkSize: number }
  | { type: "resync-chunk"; requesterId: string; snapshotId: string; offset: number; data: string }
  | { type: "state-hash"; frame: number; hash: number }
  | { type: "ping"; ts: number }
  | { type: "resync-request"; fromFrame: number; reason: ResyncReason };

export type RoomServerErrorCode =
  | "room-not-found"
  | "room-full"
  | "invalid-code"
  | "not-host"
  | "not-in-room"
  | "bad-request";

export type RoomServerMessage =
  | {
    type: "room-created";
    code: string;
    roomId: string;
    playerIndex: number;
    playerCount: number;
    seed: string;
    inputDelayFrames: number;
    players: RoomPlayerInfo[];
  }
  | {
    type: "room-joined";
    code: string;
    roomId: string;
    playerIndex: number;
    playerCount: number;
    seed: string;
    inputDelayFrames: number;
    players: RoomPlayerInfo[];
  }
  | { type: "room-updated"; players: RoomPlayerInfo[] }
  | { type: "room-closed"; reason: string }
  | { type: "state-hash"; playerId: string; playerIndex: number; frame: number; hash: number }
  | {
    type: "start";
    seed: string;
    startFrame: number;
    inputDelayFrames: number;
    players: RoomPlayerInfo[];
  }
  | { type: "resync-chunk"; snapshotId: string; offset: number; data: string }
  | { type: "resync-request"; fromFrame: number; reason: ResyncReason; requesterId: string }
  | {
    type: "resync-state";
    frame: number;
    seed: string;
    players: RoomPlayerInfo[];
    snapshotId: string;
    totalBytes: number;
    chunkSize: number;
  }
  | { type: "error"; code: RoomServerErrorCode; message: string }
  | { type: "pong"; ts: number };

export type RoomWireMessage = RoomClientMessage | RoomServerMessage;
