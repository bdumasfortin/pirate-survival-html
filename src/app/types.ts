import type { RoomPlayerInfo } from "../../shared/room-protocol";
import type { InputState } from "../core/input";
import type { InputFrame } from "../core/input-buffer";
import type { InputSyncState } from "../core/input-sync";
import type { RollbackBuffer } from "../game/rollback";
import type { GameState } from "../game/state";
import type { Transport } from "../net/transport";

export type RoomConnectionState = {
  role: "host" | "client";
  roomCode: string | null;
  roomId: string | null;
  localPlayerIndex: number | null;
  localPlayerId: string | null;
  playerCount: number;
  inputDelayFrames: number;
  seed: string | null;
  players: RoomPlayerInfo[];
  transport: Transport | null;
  hasSentStart: boolean;
  ui: RoomUiState | null;
  pendingAction: "create" | "join" | null;
  connectTimeoutId: number | null;
  requestTimeoutId: number | null;
  suppressCloseStatus: boolean;
};

export type RoomUiState = {
  setStatus: (text: string, isError?: boolean) => void;
  setRoomInfo: (code: string | null, players: RoomPlayerInfo[], playerCount: number) => void;
  setStartEnabled: (enabled: boolean) => void;
  setActionsEnabled: (enabled: boolean) => void;
};

export type ActiveGameRuntime = {
  state: GameState;
  rollbackBuffer: RollbackBuffer;
  inputSync: InputSyncState;
  frameInputs: InputState[];
  predictedFrames: InputFrame[];
  clock: { frame: number };
  pendingRollbackFrame: { value: number | null };
  remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }>;
  maxInputFrames: number[];
  minRemoteInputFrames: number[];
  lastInputGapWarningFrame: number[];
};

export type PendingResync = {
  snapshotId: string;
  frame: number;
  seed: string;
  players: RoomPlayerInfo[];
  totalBytes: number;
  chunkSize: number;
  buffer: Uint8Array;
  received: Set<number>;
  receivedBytes: number;
  lastReceivedAt: number;
};

export type ResyncSendState = {
  requesterId: string;
  snapshotId: string;
  bytes: Uint8Array;
  offset: number;
  chunkSize: number;
};

export type StartGameOptions = {
  session?: import("../net/session").SessionState;
  inputDelayFrames?: number;
  transport?: Transport | null;
  debugRemoteTransport?: Transport | null;
};

export type NetworkStartOptions = {
  serverUrl?: string;
  inputDelayFrames?: number;
  ui?: RoomUiState | null;
  playerName?: string;
};
