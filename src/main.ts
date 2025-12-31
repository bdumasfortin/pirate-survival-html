import "./style.css";
import { createInputState, bindKeyboard, bindInventorySelection, bindMouse, bindCraftScroll } from "./core/input";
import { applyRemoteInputFrame, createInputSyncState, loadPlayerInputFrame, readPlayerInputFrame, storeLocalInputFrame } from "./core/input-sync";
import type { InputFrame } from "./core/input-buffer";
import { startLoop } from "./core/loop";
import { createInitialState } from "./game/state";
import { createRollbackBuffer, restoreRollbackFrame, storeRollbackSnapshot } from "./game/rollback";
import { simulateFrame } from "./game/sim";
import { runDeterminismCheck } from "./dev/determinism";
import { render } from "./render/renderer";
import { setHudSeed } from "./render/ui";
import { createClientSession, createHostSession, finalizeSessionStart, setSessionFrame, type SessionState } from "./net/session";
import { decodeInputPacket, encodeInputPacket, type InputPacket } from "./net/input-wire";
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
const PLAYER_COUNT = 1;
const WS_SERVER_URL = URL_PARAMS.get("ws") ??
  (window.location.protocol === "https:"
    ? `wss://${window.location.hostname}:8787`
    : `ws://${window.location.hostname}:8787`);
const WS_ROOM_CODE = URL_PARAMS.get("room");
const WS_ROLE = (URL_PARAMS.get("role") ?? (WS_ROOM_CODE ? "client" : "host")).toLowerCase();
let activeRoomState: RoomConnectionState | null = null;
let activeRoomSocket: WebSocket | null = null;

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

  const sessionSeed = session.seed ?? seed;
  const state = createInitialState(sessionSeed, session.expectedPlayerCount, session.localPlayerIndex);
  setHudSeed(sessionSeed);
  const liveInput = createInputState();
  const frameInputs = Array.from({ length: session.expectedPlayerCount }, () => createInputState());
  const inputSync = createInputSyncState(session.expectedPlayerCount, session.localPlayerIndex, INPUT_BUFFER_FRAMES);
  const rollbackBuffer = createRollbackBuffer(ROLLBACK_BUFFER_FRAMES);
  let frame = session.startFrame;
  let pendingRollbackFrame: number | null = null;
  const remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }> = [];
  let transport: Transport | null = options.transport ?? null;

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
      if (packet) {
        enqueueRemoteInput(packet.playerIndex, packet.frame, packet.input);
      }
    });
  }

  const flushRemoteInputs = () => {
    if (remoteInputQueue.length === 0) {
      return;
    }

    for (const entry of remoteInputQueue) {
      const rollbackFrame = applyRemoteInputFrame(inputSync, entry.playerIndex, frame, entry.frame, entry.input);
      if (rollbackFrame !== null) {
        pendingRollbackFrame = pendingRollbackFrame === null ? rollbackFrame : Math.min(pendingRollbackFrame, rollbackFrame);
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

      const inputFrameIndex = frame + inputDelayFrames;
      storeLocalInputFrame(inputSync, inputFrameIndex, liveInput);

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

      if (pendingRollbackFrame !== null && pendingRollbackFrame < frame) {
        const rollbackFrame = pendingRollbackFrame;
        pendingRollbackFrame = null;
        resimulateFrom(rollbackFrame, frame, delta);
      }

      loadFrameInputs(frame);
      storeRollbackSnapshot(rollbackBuffer, frame, state);
      simulateFrame(state, frameInputs, delta);
      frame += 1;
      setSessionFrame(session, frame);
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
    case "error":
      roomState.ui?.setStatus(`Error: ${message.message}`, true);
      roomState.ui?.setActionsEnabled(true);
      console.warn(`[room] error ${message.code}: ${message.message}`);
      return;
    case "pong":
    case "resync-request":
    case "resync-state":
      return;
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
