import { createInputState, bindKeyboard, bindInventorySelection, bindMouse, bindCraftScroll, consumeDebugToggle, consumeMapToggle, type InputState } from "./core/input";
import { applyRemoteInputFrame, createInputSyncState, readPlayerInputFrame, trimInputSyncState, storeLocalInputFrame, type InputSyncState } from "./core/input-sync";
import { applyInputFrame, InputBits, storeInputFrameData, type InputBuffer, type InputFrame } from "./core/input-buffer";
import { isEntityAlive } from "./core/ecs";
import { startLoop } from "./core/loop";
import { hashGameStateSnapshot } from "./core/state-hash";
import { createInitialState, type GameState } from "./game/state";
import { createGameStateSnapshot, createRollbackBuffer, getRollbackSnapshot, resetRollbackBuffer, restoreGameStateSnapshot, restoreRollbackFrame, storeRollbackSnapshot, type RollbackBuffer } from "./game/rollback";
import { simulateFrame } from "./game/sim";
import { runDeterminismCheck } from "./dev/determinism";
import { render } from "./render/renderer";
import { getCraftingLayout } from "./render/crafting-layout";
import { setHudRoomCode, setHudSeed, toggleDebugOverlay } from "./render/ui";
import { closeMapOverlay, isMapOverlayEnabled, toggleMapOverlay } from "./game/map-overlay";
import { setPlayerNameLabels } from "./render/world";
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
const roomForm = document.getElementById("room-form") as HTMLElement | null;
const roomScreen = document.getElementById("room-screen") as HTMLElement | null;
const playerNameInput = document.getElementById("player-name") as HTMLInputElement | null;
const serverUrlInput = document.getElementById("server-url") as HTMLInputElement | null;
const roomCodeInput = document.getElementById("room-code") as HTMLInputElement | null;
const createRoomButton = document.getElementById("create-room") as HTMLButtonElement | null;
const joinRoomButton = document.getElementById("join-room") as HTMLButtonElement | null;
const copyJoinLinkButton = document.getElementById("copy-join-link") as HTMLButtonElement | null;
const startRoomButton = document.getElementById("start-room") as HTMLButtonElement | null;
const leaveRoomButton = document.getElementById("leave-room") as HTMLButtonElement | null;
const roomStatus = document.getElementById("room-status") as HTMLElement | null;
const roomStatusForm = document.getElementById("room-status-form") as HTMLElement | null;
const roomStatusFormBox = roomStatusForm?.closest(".status-box") as HTMLElement | null;
const roomCodeDisplay = document.getElementById("room-code-display") as HTMLElement | null;
const roomPlayerCount = document.getElementById("room-player-count") as HTMLElement | null;
const netIndicator = document.getElementById("net-indicator") as HTMLElement | null;
const inGameMenu = document.getElementById("in-game-menu") as HTMLElement | null;
const resumeButton = document.getElementById("resume-game") as HTMLButtonElement | null;
const exitToMenuButton = document.getElementById("exit-to-menu") as HTMLButtonElement | null;
const MAX_DEVICE_PIXEL_RATIO = 1.5;

const resize = () => {
  const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, window.devicePixelRatio || 1));
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

const clearRoomTimeouts = (roomState: RoomConnectionState) => {
  if (roomState.connectTimeoutId !== null) {
    window.clearTimeout(roomState.connectTimeoutId);
    roomState.connectTimeoutId = null;
  }
  if (roomState.requestTimeoutId !== null) {
    window.clearTimeout(roomState.requestTimeoutId);
    roomState.requestTimeoutId = null;
  }
};

const scheduleConnectTimeout = (roomState: RoomConnectionState, socket: WebSocket, serverUrl: string) => {
  if (roomState.connectTimeoutId !== null) {
    window.clearTimeout(roomState.connectTimeoutId);
  }
  roomState.connectTimeoutId = window.setTimeout(() => {
    roomState.connectTimeoutId = null;
    if (socket.readyState === WebSocket.OPEN) {
      return;
    }
    roomState.suppressCloseStatus = true;
    roomState.ui?.setStatus(`Connection timed out. Check server URL and port (${serverUrl}).`, true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    socket.close();
  }, CONNECT_TIMEOUT_MS);
};

const scheduleRoomRequestTimeout = (roomState: RoomConnectionState, socket: WebSocket, action: "create" | "join") => {
  if (roomState.requestTimeoutId !== null) {
    window.clearTimeout(roomState.requestTimeoutId);
  }
  roomState.requestTimeoutId = window.setTimeout(() => {
    roomState.requestTimeoutId = null;
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const verb = action === "create" ? "create" : "join";
    roomState.suppressCloseStatus = true;
    roomState.ui?.setStatus(`Timed out waiting to ${verb} room.`, true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    socket.close();
  }, ROOM_REQUEST_TIMEOUT_MS);
};

let isInGameMenuOpen = false;

const setInGameMenuVisible = (visible: boolean) => {
  if (!inGameMenu) {
    return;
  }
  isInGameMenuOpen = visible;
  inGameMenu.classList.toggle("hidden", !visible);

  if (!activeSession || activeSession.expectedPlayerCount !== 1) {
    return;
  }

  if (visible) {
    if (activeSession.status === "running") {
      pauseSession(activeSession, "menu");
    }
  } else if (activeSession.status === "paused" && activeSession.pauseReason === "menu") {
    resumeSessionFromFrame(activeSession, activeSession.currentFrame);
  }
};

const returnToMainMenu = () => {
  window.location.href = window.location.pathname;
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

const clearResyncSendState = () => {
  if (resyncSendTimer !== null) {
    window.clearTimeout(resyncSendTimer);
    resyncSendTimer = null;
  }
  resyncSendState = null;
};

const scheduleResyncChunkSend = () => {
  if (!resyncSendState) {
    return;
  }
  if (resyncSendTimer !== null) {
    return;
  }
  resyncSendTimer = window.setTimeout(() => {
    resyncSendTimer = null;
    const sendState = resyncSendState;
    if (!sendState) {
      return;
    }
    if (!activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
      clearResyncSendState();
      return;
    }
    let sent = 0;
    while (sent < RESYNC_CHUNKS_PER_TICK && sendState.offset < sendState.bytes.length) {
      const offset = sendState.offset;
      const chunk = sendState.bytes.subarray(offset, offset + sendState.chunkSize);
      sendRoomMessage(activeRoomSocket, {
        type: "resync-chunk",
        requesterId: sendState.requesterId,
        snapshotId: sendState.snapshotId,
        offset,
        data: encodeBase64(chunk)
      });
      sendState.offset += sendState.chunkSize;
      sent += 1;
    }
    if (sendState.offset >= sendState.bytes.length) {
      resyncSendState = null;
      return;
    }
    scheduleResyncChunkSend();
  }, RESYNC_CHUNK_SEND_INTERVAL_MS);
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

const createEmptyInputFrame = (): InputFrame => ({
  buttons: 0,
  craftIndex: -1,
  craftScroll: 0,
  inventoryIndex: -1,
  inventoryScroll: 0,
  mouseX: 0,
  mouseY: 0
});

const EMPTY_INPUT_FRAME = createEmptyInputFrame();

const PREDICTED_BUTTON_MASK = InputBits.Up | InputBits.Down | InputBits.Left | InputBits.Right | InputBits.HasMouse;

const fillPredictedFrame = (target: InputFrame, source: InputFrame) => {
  target.buttons = source.buttons & PREDICTED_BUTTON_MASK;
  target.craftIndex = -1;
  target.craftScroll = 0;
  target.inventoryIndex = -1;
  target.inventoryScroll = 0;
  target.mouseX = source.mouseX;
  target.mouseY = source.mouseY;
};

const findLatestInputFrame = (sync: InputSyncState, playerIndex: number, targetFrame: number) => {
  const buffer = sync.buffers[playerIndex];
  if (!buffer) {
    return null;
  }
  let bestFrame = -1;
  for (let i = 0; i < buffer.capacity; i += 1) {
    const frame = buffer.frames[i];
    if (frame >= 0 && frame <= targetFrame && frame > bestFrame) {
      bestFrame = frame;
    }
  }
  if (bestFrame < 0) {
    return null;
  }
  return readPlayerInputFrame(sync, playerIndex, bestFrame);
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

const getServerUrlValue = () => serverUrlInput?.value.trim() || WS_SERVER_URL;

const buildJoinLink = (roomCode: string, serverUrl: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set("net", "ws");
  url.searchParams.set("role", "client");
  url.searchParams.set("room", normalizeRoomCode(roomCode));
  url.searchParams.set("ws", serverUrl);
  return url.toString();
};

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
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
const RESYNC_CHUNK_SEND_INTERVAL_MS = 16;
const RESYNC_CHUNKS_PER_TICK = 4;
const CONNECT_TIMEOUT_MS = 8000;
const ROOM_REQUEST_TIMEOUT_MS = 8000;
const PLAYER_NAME_STORAGE_KEY = "pirate_player_name";
const SERVER_URL_STORAGE_KEY = "pirate_server_url";
const ROOM_CODE_STORAGE_KEY = "pirate_room_code";
const MAX_PLAYER_NAME_LENGTH = 16;
const PLAYER_COUNT = 1;
const WS_SERVER_URL = URL_PARAMS.get("ws") ??
  (window.location.protocol === "https:"
    ? "wss://server.sailorquest.com"
    : `ws://${window.location.hostname}:8787`);
const WS_ROOM_CODE = URL_PARAMS.get("room");
const WS_ROLE = (URL_PARAMS.get("role") ?? (WS_ROOM_CODE ? "client" : "host")).toLowerCase();
const sanitizePlayerName = (value: string) => value.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
const readStoredPlayerName = () => {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

const readStoredServerUrl = () => {
  try {
    return localStorage.getItem(SERVER_URL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

const readStoredRoomCode = () => {
  try {
    return localStorage.getItem(ROOM_CODE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};
const storePlayerName = (value: string) => {
  try {
    if (!value) {
      localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
      return;
    }
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (private mode, etc).
  }
};

const storeServerUrl = (value: string) => {
  try {
    if (!value) {
      localStorage.removeItem(SERVER_URL_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SERVER_URL_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (private mode, etc).
  }
};

const storeRoomCode = (value: string) => {
  try {
    if (!value) {
      localStorage.removeItem(ROOM_CODE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ROOM_CODE_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (private mode, etc).
  }
};
const getPlayerNameValue = () => sanitizePlayerName(playerNameInput?.value ?? readStoredPlayerName());
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
let resyncSendState: ResyncSendState | null = null;
let resyncSendTimer: number | null = null;
let lastResyncFrame = -1;
let lastHashSentFrame = -1;
let setRoomScreen: ((step: "form" | "room") => void) | null = null;

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
  pendingAction: "create" | "join" | null;
  connectTimeoutId: number | null;
  requestTimeoutId: number | null;
  suppressCloseStatus: boolean;
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
  predictedFrames: InputFrame[];
  clock: { frame: number };
  pendingRollbackFrame: { value: number | null };
  remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }>;
  maxInputFrames: number[];
  minRemoteInputFrames: number[];
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

type ResyncSendState = {
  requesterId: string;
  snapshotId: string;
  bytes: Uint8Array;
  offset: number;
  chunkSize: number;
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

const formatRoomError = (roomState: RoomConnectionState, message: Extract<RoomServerMessage, { type: "error" }>) => {
  const action = roomState.pendingAction === "create"
    ? "Create room failed"
    : roomState.pendingAction === "join"
      ? "Join room failed"
      : "Room error";

  let detail = message.message;
  switch (message.code) {
    case "room-not-found":
      detail = "Room not found. Check the code and server URL.";
      break;
    case "room-full":
      detail = "Room is full.";
      break;
    case "invalid-code":
      detail = "Invalid room code. Use the 5-character code from the host.";
      break;
    case "not-host":
      detail = "Only the host can perform that action.";
      break;
    case "not-in-room":
      detail = "You are not currently in a room.";
      break;
    case "bad-request":
      detail = message.message || "Bad request.";
      break;
    default:
      break;
  }

  return `${action}. ${detail}`;
};

const resetStateHashTracking = () => {
  localStateHashes.clear();
  remoteStateHashes.clear();
  lastDesyncFrame = -1;
  lastHashSentFrame = -1;
};

const resetInputBuffer = (buffer: InputBuffer) => {
  buffer.frames.fill(-1);
  buffer.buttons.fill(0);
  buffer.craftIndex.fill(0);
  buffer.craftScroll.fill(0);
  buffer.inventoryIndex.fill(0);
  buffer.inventoryScroll.fill(0);
  buffer.mouseX.fill(0);
  buffer.mouseY.fill(0);
};

const resetRemotePlayerInputState = (playerIndex: number) => {
  if (!activeGame) {
    return;
  }
  const buffer = activeGame.inputSync.buffers[playerIndex];
  if (buffer) {
    resetInputBuffer(buffer);
  }
  const predicted = activeGame.predictedFrames[playerIndex];
  if (predicted) {
    predicted.buttons = 0;
    predicted.craftIndex = -1;
    predicted.craftScroll = 0;
    predicted.inventoryIndex = -1;
    predicted.inventoryScroll = 0;
    predicted.mouseX = 0;
    predicted.mouseY = 0;
  }
  if (playerIndex >= 0 && playerIndex < activeGame.maxInputFrames.length) {
    activeGame.maxInputFrames[playerIndex] = activeGame.clock.frame - 1;
  }
  const queue = activeGame.remoteInputQueue;
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    if (queue[i].playerIndex === playerIndex) {
      queue.splice(i, 1);
    }
  }
};

const syncRoomPlayers = (roomState: RoomConnectionState, players: RoomPlayerInfo[]) => {
  roomState.players = players;

  const localId = roomState.localPlayerId;
  if (localId) {
    const localInfo = players.find((player) => player.id === localId);
    if (localInfo) {
      roomState.localPlayerIndex = localInfo.index;
      roomState.role = localInfo.isHost ? "host" : "client";
    }
  }

  if (activeSession) {
    activeSession.players = players.map((player) => ({
      id: player.id,
      index: player.index,
      isLocal: player.id === activeSession.localId
    }));
    const localInfo = players.find((player) => player.id === activeSession.localId);
    if (localInfo) {
      activeSession.localPlayerIndex = localInfo.index;
      activeSession.isHost = localInfo.isHost;
      roomState.role = localInfo.isHost ? "host" : "client";
    }
  }

  if (!activeGame) {
    return;
  }

  const ecs = activeGame.state.ecs;
  const connected = new Set(players.map((player) => player.index));
  if (activeGame.minRemoteInputFrames.length !== activeGame.state.playerIds.length) {
    activeGame.minRemoteInputFrames = Array.from(
      { length: activeGame.state.playerIds.length },
      (_, index) => activeGame.minRemoteInputFrames[index] ?? 0
    );
  }
  for (let index = 0; index < activeGame.state.playerIds.length; index += 1) {
    const playerId = activeGame.state.playerIds[index];
    if (playerId === undefined) {
      continue;
    }
    const shouldBeAlive = connected.has(index);
    const isAlive = isEntityAlive(ecs, playerId);
    if (shouldBeAlive && !isAlive) {
      ecs.alive[playerId] = 1;
      resetRemotePlayerInputState(index);
      const delayFrames = Math.max(0, roomState.inputDelayFrames);
      if (index !== activeSession?.localPlayerIndex) {
        activeGame.minRemoteInputFrames[index] = activeGame.clock.frame + delayFrames;
      }
      continue;
    }
    if (!shouldBeAlive && isAlive) {
      ecs.alive[playerId] = 0;
      resetRemotePlayerInputState(index);
      if (activeGame.state.attackEffects[index]) {
        activeGame.state.attackEffects[index] = null;
      }
    }
  }

  const labels = Array.from({ length: activeGame.state.playerIds.length }, () => "");
  for (const player of players) {
    if (player.index >= 0 && player.index < labels.length) {
      labels[player.index] = player.name;
    }
  }
  setPlayerNameLabels(labels);
};

const getNextRoomPlayerIndex = (roomState: RoomConnectionState) => {
  const used = new Set<number>();
  for (const player of roomState.players) {
    used.add(player.index);
  }
  for (let index = 0; index < roomState.playerCount; index += 1) {
    if (!used.has(index)) {
      return index;
    }
  }
  return roomState.playerCount;
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
  const expectedPlayerCount = activeRoomState?.playerCount && activeRoomState.playerCount > 0
    ? activeRoomState.playerCount
    : Math.max(activeSession.expectedPlayerCount, pending.players.length);
  activeSession.expectedPlayerCount = expectedPlayerCount;
  activeGame.inputSync.playerCount = expectedPlayerCount;
  const resetFrame = pending.frame - 1;
  activeGame.maxInputFrames.length = expectedPlayerCount;
  for (let i = 0; i < activeGame.maxInputFrames.length; i += 1) {
    activeGame.maxInputFrames[i] = resetFrame;
  }
  if (activeGame.minRemoteInputFrames.length !== expectedPlayerCount) {
    const next = Array.from({ length: expectedPlayerCount }, (_, index) => activeGame.minRemoteInputFrames[index] ?? 0);
    activeGame.minRemoteInputFrames = next;
  }
  activeGame.predictedFrames.length = 0;
  for (let i = 0; i < expectedPlayerCount; i += 1) {
    activeGame.predictedFrames.push(createEmptyInputFrame());
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
  if (activeGame.frameInputs.length !== expectedPlayerCount) {
    activeGame.frameInputs.length = 0;
    for (let i = 0; i < expectedPlayerCount; i += 1) {
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
  if (activeRoomState) {
    syncRoomPlayers(activeRoomState, pending.players);
  }
};

const sendResyncSnapshot = (
  roomState: RoomConnectionState,
  requesterId: string,
  fromFrame: number,
  options: { useLiveSnapshot?: boolean } = {}
) => {
  if (!activeGame || !activeSession || !activeSession.isHost) {
    return;
  }
  if (!activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
    return;
  }
  const requestedFrame = Math.max(0, Math.floor(fromFrame));
  let snapshotFrame = requestedFrame;
  let snapshot = options.useLiveSnapshot
    ? null
    : getRollbackSnapshot(activeGame.rollbackBuffer, requestedFrame);
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
  clearResyncSendState();
  resyncSendState = {
    requesterId,
    snapshotId,
    bytes,
    offset: 0,
    chunkSize
  };
  scheduleResyncChunkSend();
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
  playerName?: string;
};

const startGame = async (seed: string, options: StartGameOptions = {}) => {
  if (hasStarted) {
    return;
  }

  hasStarted = true;
  setOverlayVisible(menuOverlay, false);
  setOverlayVisible(loadingOverlay, true);
  setInGameMenuVisible(false);

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const hasPendingResync = pendingResync !== null;
  const inputDelayFrames = options.inputDelayFrames ?? INPUT_DELAY_FRAMES;
  const session = options.session ?? createHostSession(seed, PLAYER_COUNT);
  if (!options.session) {
    finalizeSessionStart(session, 0, inputDelayFrames);
  }
  activeSession = session;
  resetStateHashTracking();
  if (!hasPendingResync) {
    setNetIndicator("", false);
  }
  setHudRoomCode(activeRoomState?.roomCode ?? null);
  lastResyncFrame = -1;
  if (!hasPendingResync) {
    pendingResync = null;
    resyncRequestFrame = null;
    resyncRetryCount = 0;
    clearResyncTimers();
  }
  clearResyncSendState();

  const sessionSeed = session.seed ?? seed;
  const state = createInitialState(sessionSeed, session.expectedPlayerCount, session.localPlayerIndex);
  setHudSeed(sessionSeed);
  const liveInput = createInputState();
  const frameInputs = Array.from({ length: session.expectedPlayerCount }, () => createInputState());
  const predictedFrames = Array.from({ length: session.expectedPlayerCount }, () => createEmptyInputFrame());
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
    predictedFrames,
    clock,
    pendingRollbackFrame,
    remoteInputQueue,
    maxInputFrames: Array.from({ length: session.expectedPlayerCount }, () => -1),
    minRemoteInputFrames: Array.from({ length: session.expectedPlayerCount }, () => 0)
  };
  if (activeRoomState) {
    syncRoomPlayers(activeRoomState, activeRoomState.players);
  }

  if (hasPendingResync) {
    pauseSession(session, "late-join");
  }

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
      const playerId = activeGame?.state.playerIds[entry.playerIndex];
      if (playerId === undefined || !isEntityAlive(activeGame.state.ecs, playerId)) {
        continue;
      }
      const minFrame = activeGame?.minRemoteInputFrames[entry.playerIndex] ?? 0;
      if (entry.frame < minFrame) {
        continue;
      }
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
      const input = readPlayerInputFrame(inputSync, playerIndex, targetFrame);
      if (input) {
        applyInputFrame(input, frameInputs[playerIndex]);
        continue;
      }

      if (playerIndex === session.localPlayerIndex) {
        applyInputFrame(EMPTY_INPUT_FRAME, frameInputs[playerIndex]);
        continue;
      }

      const fallback = findLatestInputFrame(inputSync, playerIndex, targetFrame);
      if (fallback) {
        const predicted = predictedFrames[playerIndex];
        fillPredictedFrame(predicted, fallback);
        const buffer = inputSync.buffers[playerIndex];
        if (buffer) {
          storeInputFrameData(buffer, targetFrame, predicted);
        }
        applyInputFrame(predicted, frameInputs[playerIndex]);
        continue;
      }

      applyInputFrame(EMPTY_INPUT_FRAME, frameInputs[playerIndex]);
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
  bindMouse(liveInput, (x, y) => {
    const layout = getCraftingLayout(state, window.innerWidth, window.innerHeight);
    if (!layout) {
      return false;
    }
    const { button } = layout;
    return x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height;
  });
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

  if (pendingResync && pendingResync.receivedBytes >= pendingResync.totalBytes) {
    applyResyncSnapshot(pendingResync);
  }

  startLoop({
      onUpdate: (delta) => {
        if (session.status !== "running") {
          return;
        }

        if (consumeDebugToggle(liveInput)) {
          toggleDebugOverlay();
        }
        if (consumeMapToggle(liveInput)) {
          toggleMapOverlay();
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
  const playerCount = 4;
  const inputDelayFrames = options.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
  const serverUrl = options.serverUrl ?? WS_SERVER_URL;
  const playerName = sanitizePlayerName(options.playerName ?? getPlayerNameValue());
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
    ui,
    pendingAction: "create",
    connectTimeoutId: null,
    requestTimeoutId: null,
    suppressCloseStatus: false
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

  scheduleConnectTimeout(roomState, socket, serverUrl);

  socket.addEventListener("open", () => {
    roomState.suppressCloseStatus = false;
    clearRoomTimeouts(roomState);
    sendRoomMessage(socket, {
      type: "create-room",
      playerName,
      playerCount,
      seed,
      inputDelayFrames
    });
    scheduleRoomRequestTimeout(roomState, socket, "create");
  });

  socket.addEventListener("error", () => {
    roomState.suppressCloseStatus = true;
    roomState.ui?.setStatus("Network error. Could not connect to server.", true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
  });

  socket.addEventListener("close", () => {
    clearRoomTimeouts(roomState);
    setRoomScreen?.("form");
    if (!roomState.suppressCloseStatus) {
      roomState.ui?.setStatus("Disconnected from server.", true);
    }
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    setHudRoomCode(null);
    clearResyncSendState();
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
  const playerName = sanitizePlayerName(options.playerName ?? getPlayerNameValue());
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
    ui,
    pendingAction: "join",
    connectTimeoutId: null,
    requestTimeoutId: null,
    suppressCloseStatus: false
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

  scheduleConnectTimeout(roomState, socket, serverUrl);

  socket.addEventListener("open", () => {
    roomState.suppressCloseStatus = false;
    clearRoomTimeouts(roomState);
    sendRoomMessage(socket, { type: "join-room", code: normalizedCode, playerName });
    scheduleRoomRequestTimeout(roomState, socket, "join");
  });

  socket.addEventListener("error", () => {
    roomState.suppressCloseStatus = true;
    roomState.ui?.setStatus("Network error. Could not connect to server.", true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
  });

  socket.addEventListener("close", () => {
    clearRoomTimeouts(roomState);
    setRoomScreen?.("form");
    if (!roomState.suppressCloseStatus) {
      roomState.ui?.setStatus("Disconnected from server.", true);
    }
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    setHudRoomCode(null);
    clearResyncSendState();
    if (activeRoomSocket === socket) {
      activeRoomSocket = null;
      activeRoomState = null;
    }
  });
};

const handleRoomServerMessage = (roomState: RoomConnectionState, socket: WebSocket, message: RoomServerMessage) => {
  switch (message.type) {
    case "room-created": {
      clearRoomTimeouts(roomState);
      roomState.pendingAction = null;
      setRoomScreen?.("room");
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
  roomState.ui?.setStartEnabled(roomState.role === "host");
  console.info(`[room] created code=${message.code} players=${message.playerCount}`);
  return;
}
    case "room-joined": {
      clearRoomTimeouts(roomState);
      roomState.pendingAction = null;
      setRoomScreen?.("room");
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
    case "room-updated": {
      syncRoomPlayers(roomState, message.players);
      roomState.ui?.setRoomInfo(roomState.roomCode, message.players, roomState.playerCount);
      roomState.ui?.setStartEnabled(roomState.role === "host");
      return;
    }
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
      setRoomScreen?.("form");
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
      if (activeSession && activeSession.status === "running") {
        pauseSession(activeSession, "late-join");
      }
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
      clearRoomTimeouts(roomState);
      roomState.pendingAction = null;
      setRoomScreen?.("form");
      roomState.ui?.setStatus(formatRoomError(roomState, message), true);
      roomState.ui?.setActionsEnabled(true);
      console.warn(`[room] error ${message.code}: ${message.message}`);
      return;
    case "pong":
      return;
    case "resync-request": {
      if (activeSession) {
        const isLocalRequester = message.requesterId === activeSession.localId;
        if (message.reason === "late-join" && message.requesterId) {
          const hasRequester = roomState.players.some((player) => player.id === message.requesterId);
          if (!hasRequester) {
            const assignedIndex = getNextRoomPlayerIndex(roomState);
            const nextPlayers = [...roomState.players, {
              id: message.requesterId,
              index: assignedIndex,
              isHost: false,
              name: ""
            }].sort((a, b) => a.index - b.index);
            syncRoomPlayers(roomState, nextPlayers);
            roomState.ui?.setRoomInfo(roomState.roomCode, nextPlayers, roomState.playerCount);
          }
          if (activeGame) {
            const requester = roomState.players.find((player) => player.id === message.requesterId);
            const requesterIndex = requester?.index ?? getNextRoomPlayerIndex(roomState);
            if (requesterIndex >= 0 && requesterIndex < activeGame.minRemoteInputFrames.length) {
              activeGame.minRemoteInputFrames[requesterIndex] = activeGame.clock.frame +
                Math.max(0, roomState.inputDelayFrames);
            }
          }
        }
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
          const useLiveSnapshot = message.reason === "late-join";
          const requestedFrame = useLiveSnapshot && activeGame
            ? activeGame.clock.frame
            : message.fromFrame;
          sendResyncSnapshot(roomState, message.requesterId, requestedFrame, { useLiveSnapshot });
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

  resumeButton?.addEventListener("click", () => setInGameMenuVisible(false));
  exitToMenuButton?.addEventListener("click", returnToMainMenu);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (!hasStarted || !activeGame || !activeSession) {
      return;
    }
    if (isMapOverlayEnabled()) {
      closeMapOverlay();
      event.preventDefault();
      return;
    }
    const craftingOpen = activeGame.state.crafting[activeSession.localPlayerIndex]?.isOpen ?? false;
    if (craftingOpen) {
      return;
    }
    setInGameMenuVisible(!isInGameMenuOpen);
    event.preventDefault();
  });

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

  let multiplayerActionsEnabled = true;
  const setJoinLinkEnabled = (enabled: boolean) => {
    if (copyJoinLinkButton) {
      copyJoinLinkButton.disabled = !enabled;
    }
  };
  const updateMultiplayerActions = () => {
    const nameValid = getPlayerNameValue().length > 0;
    const enabled = multiplayerActionsEnabled && nameValid;
    if (createRoomButton) {
      createRoomButton.disabled = !enabled;
    }
    if (joinRoomButton) {
      joinRoomButton.disabled = !enabled;
    }
  };

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
        setHudRoomCode(code);
        setJoinLinkEnabled(Boolean(code));
        storeRoomCode(code ?? "");
      },
      setStartEnabled: (enabled) => {
        startRoomButton.disabled = !enabled;
        startRoomButton.classList.toggle("hidden", !enabled);
      },
      setActionsEnabled: (enabled) => {
        multiplayerActionsEnabled = enabled;
        updateMultiplayerActions();
        setJoinLinkEnabled(enabled && Boolean(activeRoomState?.roomCode));
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
        if (playerNameInput) {
          playerNameInput.disabled = !enabled;
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
  const setFormStatus = (text: string, isError = false) => {
    if (!roomStatusForm) {
      return;
    }
    roomStatusForm.textContent = text || "";
    roomStatusForm.classList.toggle("error", isError);
    roomStatusFormBox?.classList.toggle("hidden", !text);
  };
  const setRoomStep = (step: "form" | "room") => {
    if (!roomForm || !roomScreen) {
      return;
    }
    roomForm.classList.toggle("hidden", step !== "form");
    roomScreen.classList.toggle("hidden", step !== "room");
    if (step === "form") {
      setFormStatus("", false);
    }
  };
  setRoomScreen = setRoomStep;

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
    setFormStatus("", false);
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
      setRoomStep("form");
    }
  };

  modeSoloButton?.addEventListener("click", () => setMode("solo"));
  modeMultiButton?.addEventListener("click", () => setMode("multi"));
  multiCreateButton?.addEventListener("click", () => setMultiplayerMode("create"));
  multiJoinButton?.addEventListener("click", () => setMultiplayerMode("join"));
  setMode("solo");
  setMultiplayerMode("create");

  if (serverUrlInput) {
    const storedUrl = readStoredServerUrl();
    serverUrlInput.value = storedUrl || WS_SERVER_URL;
    serverUrlInput.addEventListener("input", () => {
      const value = serverUrlInput.value.trim();
      storeServerUrl(value);
    });
  }
  if (roomCodeInput) {
    const storedCode = readStoredRoomCode();
    roomCodeInput.value = WS_ROOM_CODE || storedCode;
    roomCodeInput.addEventListener("input", () => {
      const value = normalizeRoomCode(roomCodeInput.value);
      if (roomCodeInput.value !== value) {
        roomCodeInput.value = value;
      }
      storeRoomCode(value);
    });
  }
  if (playerNameInput) {
    const storedName = sanitizePlayerName(readStoredPlayerName());
    if (storedName) {
      playerNameInput.value = storedName;
    }
    playerNameInput.addEventListener("input", () => {
      const sanitized = sanitizePlayerName(playerNameInput.value);
      if (playerNameInput.value !== sanitized) {
        playerNameInput.value = sanitized;
      }
      storePlayerName(sanitized);
      updateMultiplayerActions();
      setFormStatus("", false);
    });
  }
  roomUi?.setRoomInfo(null, [], 0);
  updateMultiplayerActions();
  setJoinLinkEnabled(false);

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

  const ensurePlayerName = () => {
    const playerName = getPlayerNameValue();
    if (!playerName) {
      setFormStatus("Enter player name.", true);
      playerNameInput?.focus();
      return null;
    }
    storePlayerName(playerName);
    return playerName;
  };

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
    const playerName = ensurePlayerName();
    if (!playerName) {
      return;
    }
    setRoomStep("room");
    const seed = getSeedValue(seedInputMulti ?? seedInput);
    const serverUrl = getServerUrlValue();
    setMode("multi");
    setMultiplayerMode("create");
    startNetworkHost(seed, {
      serverUrl,
      inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
      ui: roomUi,
      playerName
    });
  });

  joinRoomButton?.addEventListener("click", () => {
    const playerName = ensurePlayerName();
    if (!playerName) {
      return;
    }
    const serverUrl = getServerUrlValue();
    const code = roomCodeInput?.value.trim() ?? "";
    const normalizedCode = normalizeRoomCode(code);
    if (!isValidRoomCode(normalizedCode)) {
      setFormStatus("Invalid room code.", true);
      return;
    }
    setRoomStep("room");
    setMode("multi");
    setMultiplayerMode("join");
    startNetworkClient(normalizedCode, {
      serverUrl,
      inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
      ui: roomUi,
      playerName
    });
  });

  startRoomButton?.addEventListener("click", () => {
    if (!activeRoomState || activeRoomState.role !== "host") {
      return;
    }
    if (!activeRoomSocket || activeRoomSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    sendRoomMessage(activeRoomSocket, { type: "start-room" });
    activeRoomState.hasSentStart = true;
    roomUi?.setStatus("Starting match...");
  });

  leaveRoomButton?.addEventListener("click", () => {
    if (activeRoomSocket && activeRoomSocket.readyState === WebSocket.OPEN) {
      sendRoomMessage(activeRoomSocket, { type: "leave-room" });
      activeRoomSocket.close();
    } else if (activeRoomSocket) {
      activeRoomSocket.close();
    }
    activeRoomState = null;
    setRoomScreen?.("form");
    roomUi?.setActionsEnabled(true);
    roomUi?.setStartEnabled(false);
    setHudRoomCode(null);
  });

  copyJoinLinkButton?.addEventListener("click", async () => {
    const code = activeRoomState?.roomCode;
    if (!code) {
      return;
    }
    const serverUrl = getServerUrlValue();
    const link = buildJoinLink(code, serverUrl);
    const ok = await copyTextToClipboard(link);
    roomUi?.setStatus(ok ? "Join link copied." : "Failed to copy join link.", !ok);
  });

  if (NETWORK_MODE === "ws") {
    setMode("multi");
    if (WS_ROLE === "client" && WS_ROOM_CODE) {
      const playerName = ensurePlayerName();
      if (!playerName) {
        return;
      }
      setMultiplayerMode("join");
      startNetworkClient(WS_ROOM_CODE, {
        serverUrl: WS_SERVER_URL,
        inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
        ui: roomUi,
        playerName
      });
      return;
    }
    if (WS_ROLE === "host") {
      const playerName = ensurePlayerName();
      if (!playerName) {
        return;
      }
      const seed = getSeedValue(seedInputMulti ?? seedInput);
      setMultiplayerMode("create");
      startNetworkHost(seed, {
        serverUrl: WS_SERVER_URL,
        inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
        ui: roomUi,
        playerName
      });
      return;
    }
  }
};

initMenu();
