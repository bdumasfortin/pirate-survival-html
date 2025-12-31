import "./style.css";
import { createInputState, bindKeyboard, bindInventorySelection, bindMouse, bindCraftScroll, type InputState } from "./core/input";
import { applyRemoteInputFrame, createInputSyncState, loadPlayerInputFrame, readPlayerInputFrame, trimInputSyncState, storeLocalInputFrame, type InputSyncState } from "./core/input-sync";
import type { InputFrame } from "./core/input-buffer";
import { startLoop } from "./core/loop";
import { hashGameStateSnapshot } from "./core/state-hash";
import { createInitialState, type GameState } from "./game/state";
import { createGameStateSnapshot, createRollbackBuffer, getRollbackSnapshot, resetRollbackBuffer, restoreGameStateSnapshot, restoreRollbackFrame, storeRollbackSnapshot, type RollbackBuffer } from "./game/rollback";
import { simulateFrame } from "./game/sim";
import { runDeterminismCheck } from "./dev/determinism";
import { render } from "./render/renderer";
import { setHudSeed } from "./render/ui";
import { createClientSession, createHostSession, finalizeSessionStart, pauseSession, resumeSessionFromFrame, setSessionFrame, type SessionState } from "./net/session";
import { decodeInputPacket, encodeInputPacket, type InputPacket } from "./net/input-wire";
import { decodeBase64, deserializeGameStateSnapshot, encodeBase64, serializeGameStateSnapshot } from "./net/snapshot";
import { createLoopbackTransportPair, type Transport } from "./net/transport";
import { createWebSocketTransport } from "./net/ws-transport";
import {
  DEFAULT_INPUT_DELAY_FRAMES,
  isValidRoomCode,
  normalizeRoomCode,
  type RoomClientMessage,
  type RoomPlayerInfo,
  type RoomServerMessage
} from "./net/room-protocol";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;

if (!canvas) {
  throw new Error("Canvas element not found.");
}

const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("Canvas 2D context not available.");
}

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

const menuOverlay = document.getElementById("seed-menu") as HTMLElement | null;
const loadingOverlay = document.getElementById("loading-overlay") as HTMLElement | null;
const seedInput = document.getElementById("seed-input") as HTMLInputElement | null;
const seedInputMulti = document.getElementById("seed-input-mp") as HTMLInputElement | null;
const randomSeedButton = document.getElementById("seed-random") as HTMLButtonElement | null;
const randomSeedButtonMulti = document.getElementById("seed-random-mp") as HTMLButtonElement | null;
const startButton = document.getElementById("start-game") as HTMLButtonElement | null;
const modeSoloButton = document.getElementById("mode-solo") as HTMLButtonElement | null;
const modeMultiButton = document.getElementById("mode-multi") as HTMLButtonElement | null;
const multiCreateButton = document.getElementById("multi-create") as HTMLButtonElement | null;
const multiJoinButton = document.getElementById("multi-join") as HTMLButtonElement | null;
const soloPanel = document.getElementById("solo-panel") as HTMLElement | null;
const multiPanel = document.getElementById("multi-panel") as HTMLElement | null;
const serverUrlInput = document.getElementById("server-url") as HTMLInputElement | null;
const roomCodeInput = document.getElementById("room-code") as HTMLInputElement | null;
const createRoomButton = document.getElementById("create-room") as HTMLButtonElement | null;
const joinRoomButton = document.getElementById("join-room") as HTMLButtonElement | null;
const startRoomButton = document.getElementById("start-room") as HTMLButtonElement | null;
const roomStatus = document.getElementById("room-status") as HTMLElement | null;
const roomCodeDisplay = document.getElementById("room-code-display") as HTMLElement | null;
const roomPlayerCount = document.getElementById("room-player-count") as HTMLElement | null;
const netIndicator = document.getElementById("net-indicator") as HTMLElement | null;

const resize = () => {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const { innerWidth, innerHeight } = window;

  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

window.addEventListener("resize", resize);
resize();

const setOverlayVisible = (element: HTMLElement | null, visible: boolean) => {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !visible);
};

const setNetIndicator = (text: string, visible: boolean) => {
  if (!netIndicator) {
    return;
  }
  netIndicator.textContent = text;
  netIndicator.classList.toggle("hidden", !visible);
};

const clearResyncTimers = () => {
  if (resyncRetryTimer !== null) {
    window.clearTimeout(resyncRetryTimer);
    resyncRetryTimer = null;
  }
  if (resyncTimeoutTimer !== null) {
    window.clearTimeout(resyncTimeoutTimer);
    resyncTimeoutTimer = null;
  }
};

const scheduleResyncRetry = () => {
  if (resyncRetryCount >= RESYNC_MAX_RETRIES) {
    return;
  }
  if (!activeSession || !activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
    return;
  }
  if (resyncRequestFrame === null) {
    return;
  }
  if (resyncRetryTimer !== null) {
    return;
  }
  resyncRetryTimer = window.setTimeout(() => {
    resyncRetryTimer = null;
    if (!activeSession || activeSession.status !== "paused" || pendingResync) {
      return;
    }
    if (!activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    resyncRetryCount += 1;
    activeRoomState?.ui?.setStatus("Resync stalled. Retrying...");
    sendRoomMessage(activeRoomSocket, { type: "resync-request", fromFrame: resyncRequestFrame ?? 0, reason: "desync" });
    scheduleResyncRetry();
  }, RESYNC_RETRY_DELAY_MS);
};

const scheduleResyncTimeout = () => {
  if (!pendingResync) {
    return;
  }
  if (resyncTimeoutTimer !== null) {
    window.clearTimeout(resyncTimeoutTimer);
  }
  resyncTimeoutTimer = window.setTimeout(() => {
    resyncTimeoutTimer = null;
    if (!pendingResync) {
      return;
    }
    const idleMs = Date.now() - pendingResync.lastReceivedAt;
    if (idleMs < RESYNC_TIMEOUT_MS) {
      scheduleResyncTimeout();
      return;
    }
    pendingResync = null;
    activeRoomState?.ui?.setStatus("Resync timed out. Retrying...", true);
    setNetIndicator("Resyncing...", true);
    scheduleResyncRetry();
  }, RESYNC_TIMEOUT_MS);
};

const getConfirmedFrame = () => {
  if (!activeSession || !activeGame) {
    return -1;
  }
  if (activeGame.maxInputFrames.length !== activeSession.expectedPlayerCount) {
    return -1;
  }
  let confirmed = activeGame.maxInputFrames[0] ?? -1;
  for (const value of activeGame.maxInputFrames) {
    confirmed = Math.min(confirmed, value);
  }
  return Math.min(confirmed, activeGame.clock.frame);
};

const shouldCompareHashes = (frame: number) => {
  if (!activeSession || !activeGame) {
    return false;
  }
  if (activeSession.status !== "running" || pendingResync) {
    return false;
  }
  if (lastResyncFrame >= 0 && frame <= lastResyncFrame + HASH_COOLDOWN_FRAMES) {
    return false;
  }
  return frame <= getConfirmedFrame();
};

const updateMaxInputFrame = (playerIndex: number, frame: number) => {
  if (!activeGame) {
    return;
  }
  if (playerIndex < 0 || playerIndex >= activeGame.maxInputFrames.length) {
    return;
  }
  const current = activeGame.maxInputFrames[playerIndex] ?? -1;
  if (frame > current) {
    activeGame.maxInputFrames[playerIndex] = frame;
  }
};

const sendConfirmedStateHash = () => {
  if (!activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
    return;
  }
  if (!activeGame) {
    return;
  }
  const confirmedFrame = getConfirmedFrame();
  if (confirmedFrame < 0 || confirmedFrame <= lastHashSentFrame) {
    return;
  }
  if (confirmedFrame % STATE_HASH_INTERVAL_FRAMES !== 0) {
    return;
  }
  if (!shouldCompareHashes(confirmedFrame)) {
    return;
  }
  const snapshot = getRollbackSnapshot(activeGame.rollbackBuffer, confirmedFrame);
  if (!snapshot) {
    return;
  }
  const hash = hashGameStateSnapshot(snapshot);
  lastHashSentFrame = confirmedFrame;
  recordLocalStateHash(confirmedFrame, hash);
  sendRoomMessage(activeRoomSocket, { type: "state-hash", frame: confirmedFrame, hash });
};

const generateRandomSeed = () => {
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0].toString(36);
  }

  return Math.floor(Math.random() * 1_000_000_000).toString(36);
};

const getSeedValue = (input: HTMLInputElement | null) => {
  const value = input?.value.trim() ?? "";
  return value.length > 0 ? value : generateRandomSeed();
};

const URL_PARAMS = new URLSearchParams(window.location.search);
let hasStarted = false;
const SHOULD_RUN_DETERMINISM = import.meta.env.DEV && URL_PARAMS.has("determinism");
const NETWORK_MODE = URL_PARAMS.get("net");
const INPUT_DELAY_FRAMES = Math.max(0, Number.parseInt(URL_PARAMS.get("inputDelay") ?? "0", 10) || 0);
const REQUESTED_INPUT_DELAY_FRAMES = URL_PARAMS.has("inputDelay")
  ? INPUT_DELAY_FRAMES
  : DEFAULT_INPUT_DELAY_FRAMES;
const LOOPBACK_LATENCY_MS = Math.max(0, Number.parseInt(URL_PARAMS.get("latencyMs") ?? "0", 10) || 0);
const LOOPBACK_JITTER_MS = Math.max(0, Number.parseInt(URL_PARAMS.get("jitterMs") ?? "0", 10) || 0);
const LOOPBACK_DROP_RATE = Math.min(1, Math.max(0, Number.parseFloat(URL_PARAMS.get("dropRate") ?? "0") || 0));
const INPUT_BUFFER_FRAMES = 240;
const ROLLBACK_BUFFER_FRAMES = 240;
const STATE_HASH_INTERVAL_FRAMES = 30;
const STATE_HASH_HISTORY_FRAMES = ROLLBACK_BUFFER_FRAMES;
const MAX_REMOTE_FRAME_AHEAD = 600;
const MAX_REMOTE_FRAME_BEHIND = ROLLBACK_BUFFER_FRAMES;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_RESYNC_CHUNK_BYTES = 32 * 1024;
const MAX_RESYNC_CHUNK_BASE64 = Math.ceil(MAX_RESYNC_CHUNK_BYTES / 3) * 4 + 16;
const HASH_COOLDOWN_FRAMES = 120;
const RESYNC_RETRY_DELAY_MS = 2000;
const RESYNC_TIMEOUT_MS = 6000;
const RESYNC_MAX_RETRIES = 10;
const PLAYER_COUNT = 1;
const WS_SERVER_URL = URL_PARAMS.get("ws") ??
  (window.location.protocol === "https:"
    ? `wss://${window.location.hostname}:8787`
    : `ws://${window.location.hostname}:8787`);
const WS_ROOM_CODE = URL_PARAMS.get("room");
const WS_ROLE = (URL_PARAMS.get("role") ?? (WS_ROOM_CODE ? "client" : "host")).toLowerCase();
let activeRoomState: RoomConnectionState | null = null;
let activeRoomSocket: WebSocket | null = null;
let activeSession: SessionState | null = null;
let activeGame: ActiveGameRuntime | null = null;
const localStateHashes = new Map<number, number>();
const remoteStateHashes = new Map<number, Map<string, number>>();
let lastDesyncFrame = -1;
let pendingResync: PendingResync | null = null;
let resyncRetryTimer: number | null = null;
let resyncTimeoutTimer: number | null = null;
let resyncRetryCount = 0;
let resyncRequestFrame: number | null = null;
let lastResyncFrame = -1;
let lastHashSentFrame = -1;

type RoomConnectionState = {
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
};

type RoomUiState = {
  setStatus: (text: string, isError?: boolean) => void;
  setRoomInfo: (code: string | null, players: RoomPlayerInfo[], playerCount: number) => void;
  setStartEnabled: (enabled: boolean) => void;
  setActionsEnabled: (enabled: boolean) => void;
};

type ActiveGameRuntime = {
  state: GameState;
  rollbackBuffer: RollbackBuffer;
  inputSync: InputSyncState;
  frameInputs: InputState[];
  clock: { frame: number };
  pendingRollbackFrame: { value: number | null };
  remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }>;
  maxInputFrames: number[];
};

type PendingResync = {
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

const parseRoomServerMessage = (payload: string): RoomServerMessage | null => {
  try {
    const data = JSON.parse(payload) as RoomServerMessage;
    if (!data || typeof data !== "object" || !("type" in data)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const sendRoomMessage = (socket: WebSocket, message: RoomClientMessage) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const resetStateHashTracking = () => {
  localStateHashes.clear();
  remoteStateHashes.clear();
  lastDesyncFrame = -1;
  lastHashSentFrame = -1;
};

const pruneStateHashHistory = (currentFrame: number) => {
  const cutoff = currentFrame - STATE_HASH_HISTORY_FRAMES;
  for (const frame of localStateHashes.keys()) {
    if (frame < cutoff) {
      localStateHashes.delete(frame);
    }
  }
  for (const [frame, hashes] of remoteStateHashes.entries()) {
    if (frame < cutoff) {
      remoteStateHashes.delete(frame);
      continue;
    }
    if (hashes.size === 0) {
      remoteStateHashes.delete(frame);
    }
  }
};

const requestDesyncResync = (frame: number, peerId?: string) => {
  if (!activeSession || activeSession.status !== "running") {
    return;
  }
  if (!activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
    return;
  }
  if (lastDesyncFrame >= 0 && frame <= lastDesyncFrame) {
    return;
  }
  lastDesyncFrame = frame;
  if (activeSession.isHost && peerId && activeRoomState) {
    activeRoomState.ui?.setStatus("Desync detected. Sending resync...");
    sendResyncSnapshot(activeRoomState, peerId, frame);
    return;
  }
  pauseSession(activeSession, "desync");
  setNetIndicator("Resyncing...", true);
  pendingResync = null;
  resyncRequestFrame = frame;
  resyncRetryCount = 0;
  clearResyncTimers();
  scheduleResyncRetry();
  activeRoomState?.ui?.setStatus("Desync detected. Requesting resync...", true);
  sendRoomMessage(activeRoomSocket, { type: "resync-request", fromFrame: frame, reason: "desync" });
};

const recordLocalStateHash = (frame: number, hash: number) => {
  localStateHashes.set(frame, hash);
  if (!shouldCompareHashes(frame)) {
    pruneStateHashHistory(frame);
    return;
  }
  const remoteForFrame = remoteStateHashes.get(frame);
  if (remoteForFrame) {
    for (const [playerId, remoteHash] of remoteForFrame.entries()) {
      if (remoteHash !== hash) {
        requestDesyncResync(frame, playerId);
        break;
      }
    }
  }
  pruneStateHashHistory(frame);
};

const recordRemoteStateHash = (playerId: string, frame: number, hash: number) => {
  let remoteForFrame = remoteStateHashes.get(frame);
  if (!remoteForFrame) {
    remoteForFrame = new Map();
    remoteStateHashes.set(frame, remoteForFrame);
  }
  if (remoteForFrame.get(playerId) === hash) {
    return;
  }
  remoteForFrame.set(playerId, hash);
  if (!shouldCompareHashes(frame)) {
    pruneStateHashHistory(frame);
    return;
  }
  const localHash = localStateHashes.get(frame);
  if (localHash !== undefined && localHash !== hash) {
    requestDesyncResync(frame, playerId);
  }
  pruneStateHashHistory(frame);
};

const clearLocalStateHashesFrom = (frame: number) => {
  for (const key of localStateHashes.keys()) {
    if (key >= frame) {
      localStateHashes.delete(key);
    }
  }
  if (lastHashSentFrame >= frame) {
    lastHashSentFrame = frame - 1;
  }
};

const createSnapshotId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(16)}${values[1].toString(16)}`;
  }
  return Math.floor(Math.random() * 1_000_000_000).toString(16);
};

const applyResyncSnapshot = (pending: PendingResync) => {
  if (!activeGame || !activeSession) {
    return;
  }
  const snapshot = deserializeGameStateSnapshot(pending.buffer);
  const localPlayer = pending.players.find((player) => player.id === activeSession.localId) ?? null;
  if (localPlayer) {
    activeSession.localPlayerIndex = localPlayer.index;
  }
  const localIndex = Math.max(0, Math.min(activeSession.localPlayerIndex, snapshot.playerIds.length - 1));
  snapshot.localPlayerIndex = localIndex;
  restoreGameStateSnapshot(activeGame.state, snapshot);
  activeGame.state.localPlayerIndex = localIndex;
  activeGame.inputSync.localPlayerIndex = localIndex;
  resetRollbackBuffer(activeGame.rollbackBuffer, pending.frame, activeGame.state);
  trimInputSyncState(activeGame.inputSync, pending.frame);
  activeSession.seed = pending.seed;
  activeSession.players = pending.players.map((player) => ({
    id: player.id,
    index: player.index,
    isLocal: player.id === activeSession.localId
  }));
  activeSession.expectedPlayerCount = activeSession.players.length;
  activeGame.inputSync.playerCount = activeSession.expectedPlayerCount;
  const resetFrame = pending.frame - 1;
  activeGame.maxInputFrames.length = activeSession.expectedPlayerCount;
  for (let i = 0; i < activeGame.maxInputFrames.length; i += 1) {
    activeGame.maxInputFrames[i] = resetFrame;
  }
  activeGame.pendingRollbackFrame.value = null;
  for (const entry of activeGame.remoteInputQueue) {
    if (entry.frame < pending.frame) {
      continue;
    }
    applyRemoteInputFrame(activeGame.inputSync, entry.playerIndex, pending.frame, entry.frame, entry.input);
    updateMaxInputFrame(entry.playerIndex, entry.frame);
  }
  activeGame.remoteInputQueue.length = 0;
  activeGame.clock.frame = pending.frame;
  setSessionFrame(activeSession, pending.frame);
  if (activeGame.frameInputs.length !== activeSession.expectedPlayerCount) {
    activeGame.frameInputs.length = 0;
    for (let i = 0; i < activeSession.expectedPlayerCount; i += 1) {
      activeGame.frameInputs.push(createInputState());
    }
  }
  setHudSeed(pending.seed);
  resumeSessionFromFrame(activeSession, pending.frame);
  resetStateHashTracking();
  lastResyncFrame = pending.frame;
  resyncRetryCount = 0;
  resyncRequestFrame = null;
  clearResyncTimers();
  pendingResync = null;
  setNetIndicator("", false);
  activeRoomState?.ui?.setStatus("Resync complete.");
};

const sendResyncSnapshot = (roomState: RoomConnectionState, requesterId: string, fromFrame: number) => {
  if (!activeGame || !activeSession || !activeSession.isHost) {
    return;
  }
  if (!activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
    return;
  }
  const requestedFrame = Math.max(0, Math.floor(fromFrame));
  let snapshot = getRollbackSnapshot(activeGame.rollbackBuffer, requestedFrame);
  let snapshotFrame = requestedFrame;
  if (!snapshot) {
    snapshot = createGameStateSnapshot(activeGame.state);
    snapshotFrame = activeGame.clock.frame;
  }
  const bytes = serializeGameStateSnapshot(snapshot);
  if (bytes.length > MAX_SNAPSHOT_BYTES) {
    roomState.ui?.setStatus("Snapshot too large to resync.", true);
    return;
  }
  const snapshotId = createSnapshotId();
  const chunkSize = 16 * 1024;
  const seed = roomState.seed ?? activeSession.seed ?? "";
  sendRoomMessage(activeRoomSocket, {
    type: "resync-state",
    requesterId,
    frame: snapshotFrame,
    seed,
    players: roomState.players,
    snapshotId,
    totalBytes: bytes.length,
    chunkSize
  });
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    sendRoomMessage(activeRoomSocket, {
      type: "resync-chunk",
      requesterId,
      snapshotId,
      offset,
      data: encodeBase64(chunk)
    });
  }
};

const buildSessionFromStart = (
  startMessage: Extract<RoomServerMessage, { type: "start" }>,
  roomState: RoomConnectionState
): SessionState => {
  const session = createClientSession();
  session.isHost = roomState.role === "host";
  session.localPlayerIndex = roomState.localPlayerIndex ?? 0;
  session.expectedPlayerCount = roomState.playerCount > 0
    ? roomState.playerCount
    : startMessage.players.length;
  session.seed = startMessage.seed;
  session.startFrame = startMessage.startFrame;
  session.currentFrame = startMessage.startFrame;
  session.players = startMessage.players.map((player) => ({
    id: player.id,
    index: player.index,
    isLocal: player.index === session.localPlayerIndex
  }));
  session.localId = roomState.localPlayerId ?? session.localId;
  session.status = "running";
  session.pauseReason = null;
  return session;
};

type StartGameOptions = {
  session?: SessionState;
  inputDelayFrames?: number;
  transport?: Transport | null;
  debugRemoteTransport?: Transport | null;
};

type NetworkStartOptions = {
  serverUrl?: string;
  inputDelayFrames?: number;
  ui?: RoomUiState | null;
};

const startGame = async (seed: string, options: StartGameOptions = {}) => {
  if (hasStarted) {
    return;
  }

  hasStarted = true;
  setOverlayVisible(menuOverlay, false);
  setOverlayVisible(loadingOverlay, true);

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const inputDelayFrames = options.inputDelayFrames ?? INPUT_DELAY_FRAMES;
  const session = options.session ?? createHostSession(seed, PLAYER_COUNT);
  if (!options.session) {
    finalizeSessionStart(session, 0, inputDelayFrames);
  }
  activeSession = session;
  resetStateHashTracking();
  setNetIndicator("", false);
  pendingResync = null;
  resyncRequestFrame = null;
  resyncRetryCount = 0;
  lastResyncFrame = -1;
  clearResyncTimers();

  const sessionSeed = session.seed ?? seed;
  const state = createInitialState(sessionSeed, session.expectedPlayerCount, session.localPlayerIndex);
  setHudSeed(sessionSeed);
  const liveInput = createInputState();
  const frameInputs = Array.from({ length: session.expectedPlayerCount }, () => createInputState());
  const inputSync = createInputSyncState(session.expectedPlayerCount, session.localPlayerIndex, INPUT_BUFFER_FRAMES);
  const rollbackBuffer = createRollbackBuffer(ROLLBACK_BUFFER_FRAMES);
  const clock = { frame: session.startFrame };
  const pendingRollbackFrame = { value: null as number | null };
  const remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }> = [];
  let transport: Transport | null = options.transport ?? null;
  activeGame = {
    state,
    rollbackBuffer,
    inputSync,
    frameInputs,
    clock,
    pendingRollbackFrame,
    remoteInputQueue,
    maxInputFrames: Array.from({ length: session.expectedPlayerCount }, () => -1)
  };

  const enqueueRemoteInput = (playerIndex: number, remoteFrame: number, inputFrame: InputFrame) => {
    remoteInputQueue.push({ playerIndex, frame: remoteFrame, input: inputFrame });
  };

  if (import.meta.env.DEV) {
    const devWindow = window as typeof window & { enqueueRemoteInput?: typeof enqueueRemoteInput };
    devWindow.enqueueRemoteInput = enqueueRemoteInput;
  }

  if (!transport && NETWORK_MODE === "loopback") {
    const [localTransport, remoteTransport] = createLoopbackTransportPair({
      latencyMs: LOOPBACK_LATENCY_MS,
      jitterMs: LOOPBACK_JITTER_MS,
      dropRate: LOOPBACK_DROP_RATE
    });
    transport = localTransport;

    if (import.meta.env.DEV) {
      const devWindow = window as typeof window & { sendLoopbackPacket?: (packet: InputPacket) => void };
      devWindow.sendLoopbackPacket = (packet: InputPacket) => {
        remoteTransport.send(encodeInputPacket(packet));
      };
    }
  } else if (import.meta.env.DEV && options.debugRemoteTransport) {
    const devWindow = window as typeof window & { sendLoopbackPacket?: (packet: InputPacket) => void };
    devWindow.sendLoopbackPacket = (packet: InputPacket) => {
      options.debugRemoteTransport?.send(encodeInputPacket(packet));
    };
  }

  if (transport) {
    transport.onMessage((data) => {
      const packet = decodeInputPacket(data);
      if (!packet) {
        return;
      }
      if (packet.frame < 0) {
        return;
      }
      if (packet.playerIndex < 0 || packet.playerIndex >= session.expectedPlayerCount) {
        return;
      }
      const maxAhead = session.status === "running" && !pendingResync
        ? MAX_REMOTE_FRAME_AHEAD
        : MAX_REMOTE_FRAME_AHEAD * 4;
      if (packet.frame > clock.frame + maxAhead) {
        return;
      }
      if (packet.frame < clock.frame - MAX_REMOTE_FRAME_BEHIND) {
        return;
      }
      enqueueRemoteInput(packet.playerIndex, packet.frame, packet.input);
    });
  }

  const flushRemoteInputs = () => {
    if (remoteInputQueue.length === 0) {
      return;
    }

    for (const entry of remoteInputQueue) {
      const rollbackFrame = applyRemoteInputFrame(inputSync, entry.playerIndex, clock.frame, entry.frame, entry.input);
      updateMaxInputFrame(entry.playerIndex, entry.frame);
      if (rollbackFrame !== null) {
        pendingRollbackFrame.value = pendingRollbackFrame.value === null
          ? rollbackFrame
          : Math.min(pendingRollbackFrame.value, rollbackFrame);
      }
    }
    remoteInputQueue.length = 0;
  };

  const loadFrameInputs = (targetFrame: number) => {
    for (let playerIndex = 0; playerIndex < session.expectedPlayerCount; playerIndex += 1) {
      loadPlayerInputFrame(inputSync, playerIndex, targetFrame, frameInputs[playerIndex]);
    }
  };

  const resimulateFrom = (fromFrame: number, toFrame: number, delta: number) => {
    if (!restoreRollbackFrame(rollbackBuffer, state, fromFrame)) {
      return false;
    }

    for (let simFrame = fromFrame; simFrame < toFrame; simFrame += 1) {
      loadFrameInputs(simFrame);
      storeRollbackSnapshot(rollbackBuffer, simFrame, state);
      simulateFrame(state, frameInputs, delta);
    }

    return true;
  };

  bindKeyboard(liveInput);
  bindMouse(liveInput);
  bindCraftScroll(liveInput, () => state.crafting[state.localPlayerIndex]?.isOpen ?? false);
  bindInventorySelection(liveInput, () => {
    const localPlayerId = state.playerIds[state.localPlayerIndex];
    if (localPlayerId === undefined) {
      return false;
    }
    return !(state.crafting[state.localPlayerIndex]?.isOpen ?? false) && !state.ecs.playerIsDead[localPlayerId];
  });

  if (document.fonts && document.fonts.load) {
    try {
      await document.fonts.load("16px Zain");
    } catch {
      // Ignore font loading issues; fallback rendering will still work.
    }
  }

  setOverlayVisible(loadingOverlay, false);

  startLoop({
    onUpdate: (delta) => {
      if (session.status !== "running") {
        return;
      }

      const inputFrameIndex = clock.frame + inputDelayFrames;
      storeLocalInputFrame(inputSync, inputFrameIndex, liveInput);
      updateMaxInputFrame(session.localPlayerIndex, inputFrameIndex);

      if (transport) {
        const outgoing = readPlayerInputFrame(inputSync, session.localPlayerIndex, inputFrameIndex);
        if (outgoing) {
          transport.send(encodeInputPacket({
            playerIndex: session.localPlayerIndex,
            frame: inputFrameIndex,
            input: outgoing
          }));
        }
      }
      flushRemoteInputs();

      if (pendingRollbackFrame.value !== null && pendingRollbackFrame.value < clock.frame) {
        const rollbackFrame = pendingRollbackFrame.value;
        pendingRollbackFrame.value = null;
        if (resimulateFrom(rollbackFrame, clock.frame, delta)) {
          clearLocalStateHashesFrom(rollbackFrame);
        }
      }

      loadFrameInputs(clock.frame);
      storeRollbackSnapshot(rollbackBuffer, clock.frame, state);
      simulateFrame(state, frameInputs, delta);
      clock.frame += 1;
      setSessionFrame(session, clock.frame);
      sendConfirmedStateHash();
    },
    onRender: () => {
      render(ctx, state);
    }
  });
};

const startNetworkHost = (seed: string, options: NetworkStartOptions = {}) => {
  const playerCount = 2;
  const inputDelayFrames = options.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
  const serverUrl = options.serverUrl ?? WS_SERVER_URL;
  const ui = options.ui ?? null;

  ui?.setStatus("Connecting to room server...");
  ui?.setActionsEnabled(false);

  const roomState: RoomConnectionState = {
    role: "host",
    roomCode: null,
    roomId: null,
    localPlayerIndex: null,
    localPlayerId: null,
    playerCount,
    inputDelayFrames,
    seed,
    players: [],
    transport: null,
    hasSentStart: false,
    ui
  };

  if (activeRoomSocket && activeRoomSocket.readyState === WebSocket.OPEN) {
    activeRoomSocket.close();
  }

  const { socket, transport } = createWebSocketTransport(serverUrl, (payload) => {
    const message = parseRoomServerMessage(payload);
      if (!message) {
        return;
      }
      if (!pendingResync && activeSession?.status === "paused") {
        scheduleResyncRetry();
      }
      handleRoomServerMessage(roomState, socket, message);
  });

  roomState.transport = transport;
  activeRoomState = roomState;
  activeRoomSocket = socket;

  socket.addEventListener("open", () => {
    sendRoomMessage(socket, {
      type: "create-room",
      playerCount,
      seed,
      inputDelayFrames
    });
  });

  socket.addEventListener("close", () => {
    roomState.ui?.setStatus("Disconnected from server.", true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    if (activeRoomSocket === socket) {
      activeRoomSocket = null;
      activeRoomState = null;
    }
  });

  if (import.meta.env.DEV) {
    const devWindow = window as typeof window & { startRoom?: () => void };
    devWindow.startRoom = () => {
      if (!roomState.hasSentStart) {
        sendRoomMessage(socket, { type: "start-room" });
        roomState.hasSentStart = true;
      }
    };
  }
};

const startNetworkClient = (roomCode: string, options: NetworkStartOptions = {}) => {
  const serverUrl = options.serverUrl ?? WS_SERVER_URL;
  const inputDelayFrames = options.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
  const ui = options.ui ?? null;

  ui?.setStatus("Connecting to room server...");
  ui?.setActionsEnabled(false);

  const normalizedCode = normalizeRoomCode(roomCode);
  if (!isValidRoomCode(normalizedCode)) {
    console.warn(`[net] invalid room code "${roomCode}"`);
    ui?.setStatus("Invalid room code.", true);
    ui?.setActionsEnabled(true);
    return;
  }

  const roomState: RoomConnectionState = {
    role: "client",
    roomCode: normalizedCode,
    roomId: null,
    localPlayerIndex: null,
    localPlayerId: null,
    playerCount: 0,
    inputDelayFrames,
    seed: null,
    players: [],
    transport: null,
    hasSentStart: false,
    ui
  };

  if (activeRoomSocket && activeRoomSocket.readyState === WebSocket.OPEN) {
    activeRoomSocket.close();
  }

  const { socket, transport } = createWebSocketTransport(serverUrl, (payload) => {
    const message = parseRoomServerMessage(payload);
    if (!message) {
      return;
    }
    handleRoomServerMessage(roomState, socket, message);
  });

  roomState.transport = transport;
  activeRoomState = roomState;
  activeRoomSocket = socket;

  socket.addEventListener("open", () => {
    sendRoomMessage(socket, { type: "join-room", code: normalizedCode });
  });

  socket.addEventListener("close", () => {
    roomState.ui?.setStatus("Disconnected from server.", true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    if (activeRoomSocket === socket) {
      activeRoomSocket = null;
      activeRoomState = null;
    }
  });
};

const handleRoomServerMessage = (roomState: RoomConnectionState, socket: WebSocket, message: RoomServerMessage) => {
  switch (message.type) {
    case "room-created": {
      roomState.roomCode = message.code;
      roomState.roomId = message.roomId;
      roomState.playerCount = message.playerCount;
      roomState.inputDelayFrames = message.inputDelayFrames;
      roomState.seed = message.seed;
      roomState.players = message.players;
      roomState.localPlayerIndex = message.playerIndex;
      roomState.localPlayerId = message.players.find((player) => player.index === message.playerIndex)?.id ?? null;
      roomState.ui?.setStatus(`Room created. Share code ${message.code}.`);
  roomState.ui?.setRoomInfo(message.code, message.players, message.playerCount);
  roomState.ui?.setStartEnabled(message.players.length >= message.playerCount);
  console.info(`[room] created code=${message.code} players=${message.playerCount}`);
  return;
}
    case "room-joined": {
      roomState.roomCode = message.code;
      roomState.roomId = message.roomId;
      roomState.playerCount = message.playerCount;
      roomState.inputDelayFrames = message.inputDelayFrames;
      roomState.seed = message.seed;
      roomState.players = message.players;
      roomState.localPlayerIndex = message.playerIndex;
      roomState.localPlayerId = message.players.find((player) => player.index === message.playerIndex)?.id ?? null;
      roomState.ui?.setStatus(`Joined room ${message.code}. Waiting for host...`);
      roomState.ui?.setRoomInfo(message.code, message.players, message.playerCount);
      roomState.ui?.setStartEnabled(false);
      console.info(`[room] joined code=${message.code} players=${message.playerCount}`);
      return;
    }
    case "room-updated":
  roomState.players = message.players;
  roomState.ui?.setRoomInfo(roomState.roomCode, message.players, roomState.playerCount);
  roomState.ui?.setStartEnabled(roomState.role === "host" && message.players.length >= roomState.playerCount);
  return;
    case "start": {
      if (hasStarted) {
        return;
      }
      roomState.ui?.setStatus("Starting match...");
      const session = buildSessionFromStart(message, roomState);
      const inputDelayFrames = message.inputDelayFrames ?? roomState.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
      roomState.hasSentStart = true;
      void startGame(message.seed, {
        session,
        inputDelayFrames,
        transport: roomState.transport
      });
      return;
    }
    case "room-closed":
      roomState.ui?.setStatus(`Room closed: ${message.reason}`, true);
      roomState.ui?.setActionsEnabled(true);
      console.warn(`[room] closed: ${message.reason}`);
      return;
    case "state-hash":
      if (!activeSession || message.playerId === activeSession.localId) {
        return;
      }
      if (message.frame < activeSession.currentFrame - STATE_HASH_HISTORY_FRAMES ||
        message.frame > activeSession.currentFrame + MAX_REMOTE_FRAME_AHEAD) {
        return;
      }
      recordRemoteStateHash(message.playerId, message.frame, message.hash);
      return;
    case "resync-state": {
      if (message.totalBytes <= 0 || message.totalBytes > MAX_SNAPSHOT_BYTES) {
        roomState.ui?.setStatus("Resync snapshot rejected (too large).", true);
        setNetIndicator("", false);
        return;
      }
      if (message.chunkSize <= 0 || message.chunkSize > MAX_RESYNC_CHUNK_BYTES) {
        roomState.ui?.setStatus("Resync snapshot rejected (chunk size).", true);
        setNetIndicator("", false);
        return;
      }
      clearResyncTimers();
      roomState.players = message.players;
      resyncRequestFrame = message.frame;
      resyncRetryCount = 0;
      pendingResync = {
        snapshotId: message.snapshotId,
        frame: message.frame,
        seed: message.seed,
        players: message.players,
        totalBytes: message.totalBytes,
        chunkSize: message.chunkSize,
        buffer: new Uint8Array(message.totalBytes),
        received: new Set(),
        receivedBytes: 0,
        lastReceivedAt: Date.now()
      };
      setNetIndicator("Receiving snapshot...", true);
      roomState.ui?.setStatus("Receiving resync snapshot...");
      scheduleResyncTimeout();
      return;
    }
    case "resync-chunk": {
      if (!pendingResync || pendingResync.snapshotId !== message.snapshotId) {
        return;
      }
      if (message.data.length > MAX_RESYNC_CHUNK_BASE64) {
        return;
      }
      const bytes = decodeBase64(message.data);
      const offset = Math.max(0, Math.floor(message.offset));
      if (pendingResync.received.has(offset) || offset >= pendingResync.totalBytes) {
        return;
      }
      const available = Math.min(bytes.length, pendingResync.chunkSize, pendingResync.totalBytes - offset);
      pendingResync.buffer.set(bytes.subarray(0, available), offset);
      pendingResync.received.add(offset);
      pendingResync.receivedBytes += available;
      pendingResync.lastReceivedAt = Date.now();
      scheduleResyncTimeout();
      if (pendingResync.receivedBytes >= pendingResync.totalBytes) {
        applyResyncSnapshot(pendingResync);
      }
      return;
    }
    case "error":
      roomState.ui?.setStatus(`Error: ${message.message}`, true);
      roomState.ui?.setActionsEnabled(true);
      console.warn(`[room] error ${message.code}: ${message.message}`);
      return;
    case "pong":
      return;
    case "resync-request": {
      if (activeSession) {
        const isLocalRequester = message.requesterId === activeSession.localId;
        if (!activeSession.isHost || isLocalRequester) {
          pauseSession(activeSession, message.reason);
          const label = message.reason === "late-join"
            ? "Syncing new player..."
            : "Resyncing...";
          setNetIndicator(label, true);
          roomState.ui?.setStatus("Resync requested. Waiting for host...");
        } else {
          roomState.ui?.setStatus("Sending resync snapshot...");
        }
        console.info(`[room] resync requested reason=${message.reason} requester=${message.requesterId}`);
        if (activeSession.isHost && message.requesterId && !isLocalRequester) {
          sendResyncSnapshot(roomState, message.requesterId, message.fromFrame);
        } else if (isLocalRequester) {
          pendingResync = null;
          resyncRequestFrame = message.fromFrame;
          resyncRetryCount = 0;
          clearResyncTimers();
          scheduleResyncRetry();
        }
      }
      return;
    }
    default:
      return;
  }
};

const initMenu = () => {
  if (SHOULD_RUN_DETERMINISM) {
    runDeterminismCheck();
    return;
  }

  const hasMenu = menuOverlay && loadingOverlay && seedInput && randomSeedButton && startButton;
  if (!hasMenu) {
    const seed = generateRandomSeed();
    if (NETWORK_MODE === "ws" && WS_ROLE === "host") {
      void startNetworkHost(seed);
      return;
    }
    void startGame(seed);
    return;
  }

  const roomUi: RoomUiState | null = roomStatus && roomCodeDisplay && roomPlayerCount && createRoomButton && joinRoomButton && startRoomButton
    ? {
      setStatus: (text, isError = false) => {
        roomStatus.textContent = `Status: ${text}`;
        roomStatus.classList.toggle("error", isError);
      },
      setRoomInfo: (code, players, playerCount) => {
        roomCodeDisplay.textContent = code ?? "--";
        const total = playerCount > 0 ? playerCount : players.length;
        roomPlayerCount.textContent = `${players.length}/${total}`;
      },
      setStartEnabled: (enabled) => {
        startRoomButton.disabled = !enabled;
      },
      setActionsEnabled: (enabled) => {
        createRoomButton.disabled = !enabled;
        joinRoomButton.disabled = !enabled;
        if (multiCreateButton) {
          multiCreateButton.disabled = !enabled;
        }
        if (multiJoinButton) {
          multiJoinButton.disabled = !enabled;
        }
        if (modeSoloButton) {
          modeSoloButton.disabled = !enabled;
        }
        if (modeMultiButton) {
          modeMultiButton.disabled = !enabled;
        }
        if (serverUrlInput) {
          serverUrlInput.disabled = !enabled;
        }
        if (roomCodeInput) {
          roomCodeInput.disabled = !enabled;
        }
        if (seedInputMulti) {
          seedInputMulti.disabled = !enabled;
        }
        if (randomSeedButtonMulti) {
          randomSeedButtonMulti.disabled = !enabled;
        }
      }
    }
    : null;

  let multiplayerMode: "create" | "join" = "create";
  const createOnlyElements = multiPanel?.querySelectorAll<HTMLElement>(".create-only") ?? [];
  const joinOnlyElements = multiPanel?.querySelectorAll<HTMLElement>(".join-only") ?? [];

  const setMultiplayerMode = (mode: "create" | "join") => {
    multiplayerMode = mode;
    createOnlyElements.forEach((element) => {
      element.classList.toggle("hidden", mode === "join");
    });
    joinOnlyElements.forEach((element) => {
      element.classList.toggle("hidden", mode === "create");
    });
    multiCreateButton?.classList.toggle("active", mode === "create");
    multiJoinButton?.classList.toggle("active", mode === "join");
  };

  const setMode = (mode: "solo" | "multi") => {
    if (soloPanel) {
      soloPanel.classList.toggle("hidden", mode !== "solo");
    }
    if (multiPanel) {
      multiPanel.classList.toggle("hidden", mode !== "multi");
    }
    modeSoloButton?.classList.toggle("active", mode === "solo");
    modeMultiButton?.classList.toggle("active", mode === "multi");
    if (mode === "multi") {
      setMultiplayerMode(multiplayerMode);
    }
  };

  modeSoloButton?.addEventListener("click", () => setMode("solo"));
  modeMultiButton?.addEventListener("click", () => setMode("multi"));
  multiCreateButton?.addEventListener("click", () => setMultiplayerMode("create"));
  multiJoinButton?.addEventListener("click", () => setMultiplayerMode("join"));
  setMode("solo");
  setMultiplayerMode("create");

  if (serverUrlInput) {
    serverUrlInput.value = WS_SERVER_URL;
  }
  if (roomCodeInput && WS_ROOM_CODE) {
    roomCodeInput.value = WS_ROOM_CODE;
  }
  roomUi?.setRoomInfo(null, [], 0);

  randomSeedButton.addEventListener("click", () => {
    const seed = generateRandomSeed();
    seedInput.value = seed;
    seedInput.focus();
    seedInput.select();
  });

  randomSeedButtonMulti?.addEventListener("click", () => {
    const seed = generateRandomSeed();
    if (seedInputMulti) {
      seedInputMulti.value = seed;
      seedInputMulti.focus();
      seedInputMulti.select();
    }
  });

  const handleStart = () => {
    const seed = getSeedValue(seedInput);
    seedInput.value = seed;
    seedInput.disabled = true;
    randomSeedButton.disabled = true;
    startButton.disabled = true;
    if (NETWORK_MODE === "ws" && WS_ROLE === "host") {
      startNetworkHost(seed, { ui: roomUi });
      return;
    }
    void startGame(seed);
  };

  startButton.addEventListener("click", handleStart);
  seedInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleStart();
    }
  });

  createRoomButton?.addEventListener("click", () => {
    const seed = getSeedValue(seedInputMulti ?? seedInput);
    const serverUrl = serverUrlInput?.value.trim() || WS_SERVER_URL;
    setMode("multi");
    setMultiplayerMode("create");
    startNetworkHost(seed, {
      serverUrl,
      inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
      ui: roomUi
    });
  });

  joinRoomButton?.addEventListener("click", () => {
    const serverUrl = serverUrlInput?.value.trim() || WS_SERVER_URL;
    const code = roomCodeInput?.value.trim() ?? "";
    setMode("multi");
    setMultiplayerMode("join");
    startNetworkClient(code, {
      serverUrl,
      inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
      ui: roomUi
    });
  });

  startRoomButton?.addEventListener("click", () => {
    if (!activeRoomState || activeRoomState.role !== "host") {
      return;
    }
    if (!activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (activeRoomState.players.length < activeRoomState.playerCount) {
      roomUi?.setStatus("Waiting for more players...");
      return;
    }
    sendRoomMessage(activeRoomSocket, { type: "start-room" });
    activeRoomState.hasSentStart = true;
    roomUi?.setStatus("Starting match...");
  });

  if (NETWORK_MODE === "ws") {
    setMode("multi");
    if (WS_ROLE === "client" && WS_ROOM_CODE) {
      setMultiplayerMode("join");
      startNetworkClient(WS_ROOM_CODE, {
        serverUrl: WS_SERVER_URL,
        inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
        ui: roomUi
      });
      return;
    }
    if (WS_ROLE === "host") {
      const seed = getSeedValue(seedInputMulti ?? seedInput);
      setMultiplayerMode("create");
      startNetworkHost(seed, {
        serverUrl: WS_SERVER_URL,
        inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
        ui: roomUi
      });
      return;
    }
  }
};

initMenu();
