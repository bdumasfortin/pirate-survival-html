// Core imports
import { isValidRoomCode, normalizeRoomCode, type RoomServerMessage } from "../shared/room-protocol";
import { setupCanvas } from "./app/canvas-setup";
// App module imports
import {
  INPUT_BUFFER_FRAMES,
  INPUT_DELAY_FRAMES,
  INPUT_GAP_WARN_INTERVAL_FRAMES,
  LOOPBACK_DROP_RATE,
  LOOPBACK_JITTER_MS,
  LOOPBACK_LATENCY_MS,
  MAX_INPUT_GAP_FRAMES,
  MAX_REMOTE_FRAME_AHEAD,
  MAX_REMOTE_FRAME_BEHIND,
  NETWORK_MODE,
  PLAYER_COUNT,
  REQUESTED_INPUT_DELAY_FRAMES,
  ROLLBACK_BUFFER_FRAMES,
  SHOULD_RUN_DETERMINISM,
  STATE_HASH_HISTORY_FRAMES,
  WS_ROLE,
  WS_ROOM_CODE,
  WS_SERVER_URL,
} from "./app/constants";
import { EMPTY_INPUT_FRAME, fillPredictedFrame, findLatestInputFrame, updateMaxInputFrame } from "./app/input-manager";
import { syncRoomPlayers } from "./app/player-sync";
import {
  clearResyncSendState,
  clearResyncTimers,
  scheduleResyncRetry,
  scheduleResyncTimeout,
  setNetIndicatorElement,
} from "./app/resync-manager";
import { applyResyncSnapshot, sendResyncSnapshot } from "./app/resync-snapshot";
import { clearRoomTimeouts, scheduleConnectTimeout, scheduleRoomRequestTimeout } from "./app/room-connection";
import { formatRoomError, parseRoomServerMessage, sendRoomMessage } from "./app/room-messages";
import {
  activeGame,
  activeRoomSocket,
  activeRoomState,
  activeSession,
  hasStarted,
  pendingResync,
  setActiveGame,
  setActiveRoomSocket,
  setActiveRoomState,
  setActiveSession,
  setHasStarted,
  setLastResyncFrame,
  setPendingResync,
  setResyncRequestFrame,
  setResyncRetryCount,
} from "./app/state";
import {
  clearLocalStateHashesFrom,
  recordRemoteStateHash,
  resetStateHashTracking,
  sendConfirmedStateHash,
} from "./app/state-hash-manager";
import {
  readStoredPlayerName,
  readStoredRoomCode,
  readStoredServerUrl,
  storePlayerName,
  storeRoomCode,
  storeServerUrl,
} from "./app/storage";
import type {
  ActiveGameRuntime,
  NetworkStartOptions,
  PendingResync,
  RoomConnectionState,
  RoomUiState,
  StartGameOptions,
} from "./app/types";
import {
  buildJoinLink,
  copyTextToClipboard,
  generateRandomSeed,
  sanitizePlayerName,
  setNetIndicator,
  setOverlayVisible,
} from "./app/ui-helpers";
import { isEntityAlive } from "./core/ecs";
import {
  bindCraftScroll,
  bindInventorySelection,
  bindKeyboard,
  bindMouse,
  consumeDebugToggle,
  consumeMapToggle,
  createInputState,
} from "./core/input";
import { applyInputFrame, type InputFrame, storeInputFrameData } from "./core/input-buffer";
import {
  applyRemoteInputFrame,
  createInputSyncState,
  readPlayerInputFrame,
  storeLocalInputFrame,
} from "./core/input-sync";
import { startLoop } from "./core/loop";
import { runDeterminismCheck } from "./dev/determinism";
import { closeMapOverlay, isMapOverlayEnabled, toggleMapOverlay } from "./game/map-overlay";
import { createRollbackBuffer, restoreRollbackFrame, storeRollbackSnapshot } from "./game/rollback";
import { simulateFrame } from "./game/sim";
import { createInitialState } from "./game/state";
import { decodeInputPacket, encodeInputPacket, type InputPacket } from "./net/input-wire";
import {
  createClientSession,
  createHostSession,
  finalizeSessionStart,
  pauseSession,
  resumeSessionFromFrame,
  type SessionState,
  setSessionFrame,
} from "./net/session";
import { decodeBase64 } from "./net/snapshot";
import { createLoopbackTransportPair, type Transport } from "./net/transport";
import { createWebSocketTransport } from "./net/ws-transport";
import { getCraftingLayout } from "./render/crafting-layout";
import { render } from "./render/renderer";
import { setHudRoomCode, setHudSeed, toggleDebugOverlay } from "./render/ui";

// DOM element references
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("Canvas element not found.");
}
const ctx = setupCanvas(canvas);

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

// Initialize net indicator in modules
if (netIndicator) {
  setNetIndicatorElement(netIndicator);
}

let isInGameMenuOpen = false;

const setInGameMenuVisible = (visible: boolean): void => {
  if (!inGameMenu) {
    return;
  }
  isInGameMenuOpen = visible;
  inGameMenu.classList.toggle("hidden", !visible);

  const session = activeSession;
  if (!session || session.expectedPlayerCount !== 1) {
    return;
  }

  if (visible) {
    if (session.status === "running") {
      pauseSession(session, "menu");
    }
  } else if (session.status === "paused" && session.pauseReason === "menu") {
    resumeSessionFromFrame(session, session.currentFrame);
  }
};

const returnToMainMenu = (): void => {
  window.location.href = window.location.pathname;
};

const getServerUrlValue = (): string => serverUrlInput?.value.trim() || WS_SERVER_URL;

const getSeedValue = (input: HTMLInputElement | null): string => {
  const value = input?.value.trim() ?? "";
  return value.length > 0 ? value : generateRandomSeed();
};

const getPlayerNameValue = (): string => {
  const maxLength = 16; // MAX_PLAYER_NAME_LENGTH from constants
  return sanitizePlayerName(playerNameInput?.value ?? readStoredPlayerName(), maxLength);
};

let setRoomScreen: ((step: "form" | "room") => void) | null = null;

const buildSessionFromStart = (
  startMessage: Extract<RoomServerMessage, { type: "start" }>,
  roomState: RoomConnectionState
): SessionState => {
  const session = createClientSession();
  session.isHost = roomState.role === "host";
  session.localPlayerIndex = roomState.localPlayerIndex ?? 0;
  session.expectedPlayerCount = roomState.playerCount > 0 ? roomState.playerCount : startMessage.players.length;
  session.seed = startMessage.seed;
  session.startFrame = startMessage.startFrame;
  session.currentFrame = startMessage.startFrame;
  session.players = startMessage.players.map((player) => ({
    id: player.id,
    index: player.index,
    isLocal: player.index === session.localPlayerIndex,
  }));
  session.localId = roomState.localPlayerId ?? session.localId;
  session.status = "running";
  session.pauseReason = null;
  return session;
};

const startGame = async (seed: string, options: StartGameOptions = {}): Promise<void> => {
  if (hasStarted) {
    return;
  }

  setHasStarted(true);
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
  setActiveSession(session);
  resetStateHashTracking();
  if (!hasPendingResync) {
    setNetIndicator(netIndicator, "", false);
  }
  setHudRoomCode(activeRoomState?.roomCode ?? null);
  setLastResyncFrame(-1);
  if (!hasPendingResync) {
    setPendingResync(null);
    setResyncRequestFrame(null);
    setResyncRetryCount(0);
    clearResyncTimers();
  }
  clearResyncSendState();

  const sessionSeed = session.seed ?? seed;
  const state = createInitialState(sessionSeed, session.expectedPlayerCount, session.localPlayerIndex);
  setHudSeed(sessionSeed);
  const liveInput = createInputState();
  const frameInputs = Array.from({ length: session.expectedPlayerCount }, () => createInputState());
  const predictedFrames = Array.from({ length: session.expectedPlayerCount }, () => EMPTY_INPUT_FRAME);
  const inputSync = createInputSyncState(session.expectedPlayerCount, session.localPlayerIndex, INPUT_BUFFER_FRAMES);
  const rollbackBuffer = createRollbackBuffer(ROLLBACK_BUFFER_FRAMES);
  const clock = { frame: session.startFrame };
  const pendingRollbackFrame = { value: null as number | null };
  const remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }> = [];
  let transport: Transport | null = options.transport ?? null;

  const game: ActiveGameRuntime = {
    state,
    rollbackBuffer,
    inputSync,
    frameInputs,
    predictedFrames,
    clock,
    pendingRollbackFrame,
    remoteInputQueue,
    maxInputFrames: Array.from({ length: session.expectedPlayerCount }, () => -1),
    minRemoteInputFrames: Array.from({ length: session.expectedPlayerCount }, () => 0),
    lastInputGapWarningFrame: Array.from({ length: session.expectedPlayerCount }, () => -1),
  };
  setActiveGame(game);

  if (activeRoomState) {
    syncRoomPlayers(activeRoomState, activeRoomState.players);
  }

  if (hasPendingResync) {
    pauseSession(session, "desync");
  }

  const enqueueRemoteInput = (playerIndex: number, remoteFrame: number, inputFrame: InputFrame): void => {
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
      dropRate: LOOPBACK_DROP_RATE,
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
      const maxAhead =
        session.status === "running" && !pendingResync ? MAX_REMOTE_FRAME_AHEAD : MAX_REMOTE_FRAME_AHEAD * 4;
      if (packet.frame > clock.frame + maxAhead) {
        return;
      }
      if (packet.frame < clock.frame - MAX_REMOTE_FRAME_BEHIND) {
        return;
      }
      enqueueRemoteInput(packet.playerIndex, packet.frame, packet.input);
    });
  }

  const flushRemoteInputs = (): void => {
    if (remoteInputQueue.length === 0) {
      return;
    }

    for (const entry of remoteInputQueue) {
      const currentGame = activeGame;
      if (!currentGame) {
        continue;
      }
      const playerId = currentGame.state.playerIds[entry.playerIndex];
      if (playerId === undefined || !isEntityAlive(currentGame.state.ecs, playerId)) {
        continue;
      }
      const minFrame = currentGame.minRemoteInputFrames[entry.playerIndex] ?? 0;
      if (entry.frame < minFrame) {
        continue;
      }
      const rollbackFrame = applyRemoteInputFrame(inputSync, entry.playerIndex, clock.frame, entry.frame, entry.input);
      updateMaxInputFrame(entry.playerIndex, entry.frame);
      if (rollbackFrame !== null) {
        pendingRollbackFrame.value =
          pendingRollbackFrame.value === null ? rollbackFrame : Math.min(pendingRollbackFrame.value, rollbackFrame);
      }
    }
    remoteInputQueue.length = 0;
  };

  const loadFrameInputs = (targetFrame: number): void => {
    for (let playerIndex = 0; playerIndex < session.expectedPlayerCount; playerIndex += 1) {
      const input = readPlayerInputFrame(inputSync, playerIndex, targetFrame);
      if (input) {
        const currentGame = activeGame;
        if (currentGame && playerIndex < currentGame.lastInputGapWarningFrame.length) {
          currentGame.lastInputGapWarningFrame[playerIndex] = -1;
        }
        applyInputFrame(input, frameInputs[playerIndex]);
        continue;
      }

      if (playerIndex === session.localPlayerIndex) {
        applyInputFrame(EMPTY_INPUT_FRAME, frameInputs[playerIndex]);
        continue;
      }

      const currentGame = activeGame;
      const maxInputFrame = currentGame?.maxInputFrames[playerIndex] ?? -1;
      const minRemoteFrame = currentGame?.minRemoteInputFrames[playerIndex] ?? 0;
      const gapFrames = targetFrame - maxInputFrame;

      if (gapFrames > MAX_INPUT_GAP_FRAMES && targetFrame >= minRemoteFrame && currentGame) {
        const playerId = currentGame.state.playerIds[playerIndex];
        const isPlayerAlive = playerId !== undefined && isEntityAlive(currentGame.state.ecs, playerId);

        if (isPlayerAlive) {
          const lastWarning = currentGame.lastInputGapWarningFrame[playerIndex] ?? -1;
          if (targetFrame - lastWarning >= INPUT_GAP_WARN_INTERVAL_FRAMES) {
            currentGame.lastInputGapWarningFrame[playerIndex] = targetFrame;
          }
        }
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

  const resimulateFrom = (fromFrame: number, toFrame: number, delta: number): boolean => {
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

  const currentPending = pendingResync;
  if (currentPending && currentPending.receivedBytes >= currentPending.totalBytes) {
    applyResyncSnapshot(currentPending);
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

      if (transport && !pendingResync) {
        const outgoing = readPlayerInputFrame(inputSync, session.localPlayerIndex, inputFrameIndex);
        if (outgoing) {
          const packet = {
            playerIndex: session.localPlayerIndex,
            frame: inputFrameIndex,
            input: outgoing,
          };
          transport.send(encodeInputPacket(packet));
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
    },
  });
};

const startNetworkHost = (seed: string, options: NetworkStartOptions = {}): void => {
  const playerCount = 4;
  const inputDelayFrames = options.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
  const serverUrl = options.serverUrl ?? WS_SERVER_URL;
  const playerName = sanitizePlayerName(options.playerName ?? getPlayerNameValue(), 16);
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
    suppressCloseStatus: false,
  };

  const currentSocket = activeRoomSocket;
  if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
    currentSocket.close();
  }

  const { socket, transport } = createWebSocketTransport(serverUrl, (payload) => {
    const message = parseRoomServerMessage(payload);
    if (!message) {
      return;
    }
    const currentPendingResync = pendingResync;
    const currentSession = activeSession;
    if (!currentPendingResync && currentSession?.status === "paused") {
      scheduleResyncRetry();
    }
    handleRoomServerMessage(roomState, socket, message);
  });

  roomState.transport = transport;
  setActiveRoomState(roomState);
  setActiveRoomSocket(socket);

  scheduleConnectTimeout(roomState, socket, serverUrl);

  socket.addEventListener("open", () => {
    roomState.suppressCloseStatus = false;
    clearRoomTimeouts(roomState);
    sendRoomMessage(socket, {
      type: "create-room",
      playerName,
      playerCount,
      seed,
      inputDelayFrames,
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
      setActiveRoomSocket(null);
      setActiveRoomState(null);
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

const startNetworkClient = (roomCode: string, options: NetworkStartOptions = {}): void => {
  const serverUrl = options.serverUrl ?? WS_SERVER_URL;
  const inputDelayFrames = options.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
  const playerName = sanitizePlayerName(options.playerName ?? getPlayerNameValue(), 16);
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
    suppressCloseStatus: false,
  };

  const currentSocket = activeRoomSocket;
  if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
    currentSocket.close();
  }

  const { socket, transport } = createWebSocketTransport(serverUrl, (payload) => {
    const message = parseRoomServerMessage(payload);
    if (!message) {
      return;
    }
    handleRoomServerMessage(roomState, socket, message);
  });

  roomState.transport = transport;
  setActiveRoomState(roomState);
  setActiveRoomSocket(socket);

  scheduleConnectTimeout(roomState, socket, serverUrl);

  socket.addEventListener("open", () => {
    roomState.suppressCloseStatus = false;
    clearRoomTimeouts(roomState);
    sendRoomMessage(socket, {
      type: "join-room",
      code: normalizedCode,
      playerName,
    });
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
      setActiveRoomSocket(null);
      setActiveRoomState(null);
    }
  });
};

const handleRoomServerMessage = (
  roomState: RoomConnectionState,
  _socket: WebSocket,
  message: RoomServerMessage
): void => {
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
      const localPlayerId = message.players.find((player) => player.index === message.playerIndex)?.id ?? null;
      roomState.localPlayerId = localPlayerId;

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
      const localPlayerId = message.players.find((player) => player.index === message.playerIndex)?.id ?? null;
      roomState.localPlayerId = localPlayerId;

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
      roomState.pendingAction = null;
      const session = buildSessionFromStart(message, roomState);
      const inputDelayFrames = message.inputDelayFrames ?? roomState.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
      roomState.hasSentStart = true;
      void startGame(message.seed, {
        session,
        inputDelayFrames,
        transport: roomState.transport,
      });
      return;
    }
    case "room-closed":
      setRoomScreen?.("form");
      roomState.ui?.setStatus(`Room closed: ${message.reason}`, true);
      roomState.ui?.setActionsEnabled(true);
      console.warn(`[room] closed: ${message.reason}`);
      return;
    case "state-hash": {
      const currentSession = activeSession;
      if (!currentSession || message.playerId === currentSession.localId) {
        return;
      }
      if (
        message.frame < currentSession.currentFrame - STATE_HASH_HISTORY_FRAMES ||
        message.frame > currentSession.currentFrame + MAX_REMOTE_FRAME_AHEAD
      ) {
        return;
      }
      recordRemoteStateHash(message.playerId, message.frame, message.hash);
      return;
    }
    case "resync-state": {
      if (message.totalBytes <= 0 || message.totalBytes > 2 * 1024 * 1024) {
        roomState.ui?.setStatus("Resync snapshot rejected (too large).", true);
        setNetIndicator(netIndicator, "", false);
        return;
      }
      if (message.chunkSize <= 0 || message.chunkSize > 32 * 1024) {
        roomState.ui?.setStatus("Resync snapshot rejected (chunk size).", true);
        setNetIndicator(netIndicator, "", false);
        return;
      }
      clearResyncTimers();
      roomState.players = message.players;
      setResyncRequestFrame(message.frame);
      setResyncRetryCount(0);
      const newPendingResync: PendingResync = {
        snapshotId: message.snapshotId,
        frame: message.frame,
        seed: message.seed,
        players: message.players,
        totalBytes: message.totalBytes,
        chunkSize: message.chunkSize,
        buffer: new Uint8Array(message.totalBytes),
        received: new Set(),
        receivedBytes: 0,
        lastReceivedAt: Date.now(),
      };
      setPendingResync(newPendingResync);
      roomState.pendingAction = null;
      if (!hasStarted) {
        console.warn("[resync-state] Received resync but game hasn't started, ignoring");
        return;
      }
      const currentSession = activeSession;
      if (currentSession && currentSession.status === "running") {
        pauseSession(currentSession, "desync");
      }
      setNetIndicator(netIndicator, "Receiving snapshot...", true);
      roomState.ui?.setStatus("Receiving resync snapshot...");
      scheduleResyncTimeout();
      return;
    }
    case "resync-chunk": {
      const currentPending = pendingResync;
      if (!currentPending || currentPending.snapshotId !== message.snapshotId) {
        return;
      }
      if (message.data.length > Math.ceil((32 * 1024) / 3) * 4 + 16) {
        return;
      }
      const bytes = decodeBase64(message.data);
      const offset = Math.max(0, Math.floor(message.offset));
      if (currentPending.received.has(offset) || offset >= currentPending.totalBytes) {
        return;
      }
      const available = Math.min(bytes.length, currentPending.chunkSize, currentPending.totalBytes - offset);
      currentPending.buffer.set(bytes.subarray(0, available), offset);
      currentPending.received.add(offset);
      currentPending.receivedBytes += available;
      currentPending.lastReceivedAt = Date.now();
      scheduleResyncTimeout();
      if (currentPending.receivedBytes >= currentPending.totalBytes) {
        applyResyncSnapshot(currentPending);
      }
      return;
    }
    case "error": {
      clearRoomTimeouts(roomState);
      roomState.pendingAction = null;
      setRoomScreen?.("form");
      const errorMessage = formatRoomError(roomState, message);
      roomState.ui?.setStatus(errorMessage, true);

      if (roomStatusForm && roomStatusFormBox) {
        roomStatusForm.textContent = errorMessage;
        roomStatusForm.classList.add("error");
        roomStatusFormBox.classList.remove("hidden");
      }

      roomState.ui?.setActionsEnabled(true);
      return;
    }
    case "pong":
      return;
    case "resync-request": {
      const currentSession = activeSession;
      if (currentSession) {
        const isLocalRequester = message.requesterId === currentSession.localId;
        if (!currentSession.isHost || isLocalRequester) {
          pauseSession(currentSession, message.reason);
          setNetIndicator(netIndicator, "Resyncing...", true);
          roomState.ui?.setStatus("Resync requested. Waiting for host...");
        } else {
          roomState.ui?.setStatus("Sending resync snapshot...");
        }
        console.info(`[room] resync requested reason=${message.reason} requester=${message.requesterId}`);
        if (currentSession.isHost && message.requesterId && !isLocalRequester) {
          const useLiveSnapshot = message.reason === "desync";
          const currentGame = activeGame;
          const requestedFrame = useLiveSnapshot && currentGame ? currentGame.clock.frame : message.fromFrame;

          if (currentGame && useLiveSnapshot) {
            const connectedIndices = new Set(roomState.players.map((p) => p.index));
            for (let index = 0; index < currentGame.state.playerIds.length; index += 1) {
              const playerId = currentGame.state.playerIds[index];
              if (playerId !== undefined && connectedIndices.has(index)) {
                if (!isEntityAlive(currentGame.state.ecs, playerId)) {
                  console.info(
                    `[resync] Marking player ${index} as alive before sending snapshot (rejoin), ` +
                      `playerId=${playerId}`
                  );
                  currentGame.state.ecs.alive[playerId] = 1;
                }
              }
            }
          }

          console.info(
            `[resync] Host sending resync to ${message.requesterId}, ` +
              `reason=${message.reason}, frame=${requestedFrame}, live=${useLiveSnapshot}, ` +
              `roomState.players=${roomState.players.map((p) => `${p.id}:${p.index}`).join(", ")}`
          );
          sendResyncSnapshot(roomState, message.requesterId, requestedFrame, { useLiveSnapshot });
        } else if (isLocalRequester) {
          setPendingResync(null);
          setResyncRequestFrame(message.fromFrame);
          setResyncRetryCount(0);
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

const initMenu = (): void => {
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
    const currentGame = activeGame;
    const currentSession = activeSession;
    const craftingOpen = currentGame.state.crafting[currentSession.localPlayerIndex]?.isOpen ?? false;
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
  const setJoinLinkEnabled = (enabled: boolean): void => {
    if (copyJoinLinkButton) {
      copyJoinLinkButton.disabled = !enabled;
    }
  };
  const updateMultiplayerActions = (): void => {
    const nameValid = getPlayerNameValue().length > 0;
    const enabled = multiplayerActionsEnabled && nameValid;
    if (createRoomButton) {
      createRoomButton.disabled = !enabled;
    }
    if (joinRoomButton) {
      joinRoomButton.disabled = !enabled;
    }
  };

  const roomUi: RoomUiState | null =
    roomStatus && roomCodeDisplay && roomPlayerCount && createRoomButton && joinRoomButton && startRoomButton
      ? {
          setStatus: (text, isError = false) => {
            if (roomStatus) {
              roomStatus.textContent = `Status: ${text}`;
              roomStatus.classList.toggle("error", isError);
            }
          },
          setRoomInfo: (code, players, playerCount) => {
            if (roomCodeDisplay) {
              roomCodeDisplay.textContent = code ?? "--";
            }
            if (roomPlayerCount) {
              const total = playerCount > 0 ? playerCount : players.length;
              roomPlayerCount.textContent = `${players.length}/${total}`;
            }
            setHudRoomCode(code);
            setJoinLinkEnabled(Boolean(code));
            storeRoomCode(code ?? "");
          },
          setStartEnabled: (enabled) => {
            if (startRoomButton) {
              startRoomButton.disabled = !enabled;
              startRoomButton.classList.toggle("hidden", !enabled);
            }
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
          },
        }
      : null;

  let multiplayerMode: "create" | "join" = "create";
  const createOnlyElements = multiPanel?.querySelectorAll<HTMLElement>(".create-only") ?? [];
  const joinOnlyElements = multiPanel?.querySelectorAll<HTMLElement>(".join-only") ?? [];
  const setFormStatus = (text: string, isError = false): void => {
    if (!roomStatusForm) {
      return;
    }
    roomStatusForm.textContent = text || "";
    roomStatusForm.classList.toggle("error", isError);
    roomStatusFormBox?.classList.toggle("hidden", !text);
  };
  const setRoomStep = (step: "form" | "room"): void => {
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

  const setMultiplayerMode = (mode: "create" | "join"): void => {
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

  const setMode = (mode: "solo" | "multi"): void => {
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
    const storedName = sanitizePlayerName(readStoredPlayerName(), 16);
    if (storedName) {
      playerNameInput.value = storedName;
    }
    playerNameInput.addEventListener("input", () => {
      const sanitized = sanitizePlayerName(playerNameInput.value, 16);
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

  const ensurePlayerName = (): string | null => {
    const playerName = getPlayerNameValue();
    if (!playerName) {
      setFormStatus("Enter player name.", true);
      playerNameInput?.focus();
      return null;
    }
    storePlayerName(playerName);
    return playerName;
  };

  const handleStart = (): void => {
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
      playerName,
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
      playerName,
    });
  });

  startRoomButton?.addEventListener("click", () => {
    const currentRoomState = activeRoomState;
    if (!currentRoomState || currentRoomState.role !== "host") {
      return;
    }
    const currentSocket = activeRoomSocket;
    if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    sendRoomMessage(currentSocket, { type: "start-room" });
    currentRoomState.hasSentStart = true;
    roomUi?.setStatus("Starting match...");
  });

  leaveRoomButton?.addEventListener("click", () => {
    const currentSocket = activeRoomSocket;
    if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
      sendRoomMessage(currentSocket, { type: "leave-room" });
      currentSocket.close();
    } else if (currentSocket) {
      currentSocket.close();
    }
    setActiveRoomState(null);
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
        playerName,
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
        playerName,
      });
      return;
    }
  }
};

initMenu();
