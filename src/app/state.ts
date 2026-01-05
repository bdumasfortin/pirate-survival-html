import type { SessionState } from "../net/session";
import type { ActiveGameRuntime, PendingResync, ResyncSendState, RoomConnectionState } from "./types";

// Global application state
export let activeRoomState: RoomConnectionState | null = null;
export let activeRoomSocket: WebSocket | null = null;
export let activeSession: SessionState | null = null;
export let activeGame: ActiveGameRuntime | null = null;

// State hash tracking
export const localStateHashes = new Map<number, number>();
export const remoteStateHashes = new Map<number, Map<string, number>>();
export let lastDesyncFrame = -1;
export let lastHashSentFrame = -1;

// Resync state
export let pendingResync: PendingResync | null = null;
export const resyncRetryTimer: number | null = null;
export const resyncTimeoutTimer: number | null = null;
export let resyncRetryCount = 0;
export let resyncRequestFrame: number | null = null;
export const resyncSendState: ResyncSendState | null = null;
export const resyncSendTimer: number | null = null;
export let lastResyncFrame = -1;

// Game state
export let hasStarted = false;

// Setters for state
export const setActiveRoomState = (state: RoomConnectionState | null): void => {
  activeRoomState = state;
};

export const setActiveRoomSocket = (socket: WebSocket | null): void => {
  activeRoomSocket = socket;
};

export const setActiveSession = (session: SessionState | null): void => {
  activeSession = session;
};

export const setActiveGame = (game: ActiveGameRuntime | null): void => {
  activeGame = game;
};

export const setPendingResync = (resync: PendingResync | null): void => {
  pendingResync = resync;
};

export const setHasStarted = (started: boolean): void => {
  hasStarted = started;
};

export const setLastDesyncFrame = (frame: number): void => {
  lastDesyncFrame = frame;
};

export const setLastHashSentFrame = (frame: number): void => {
  lastHashSentFrame = frame;
};

export const setLastResyncFrame = (frame: number): void => {
  lastResyncFrame = frame;
};

export const setResyncRetryCount = (count: number): void => {
  resyncRetryCount = count;
};

export const setResyncRequestFrame = (frame: number | null): void => {
  resyncRequestFrame = frame;
};
