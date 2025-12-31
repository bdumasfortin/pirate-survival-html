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
  DEFAULT_ROOM_PLAYER_COUNT,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
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
const randomSeedButton = document.getElementById("seed-random") as HTMLButtonElement | null;
const startButton = document.getElementById("start-game") as HTMLButtonElement | null;

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

const getSeedValue = () => {
  const value = seedInput?.value.trim() ?? "";
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
const WS_PLAYER_COUNT = (() => {
  const parsed = Number.parseInt(URL_PARAMS.get("players") ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ROOM_PLAYER_COUNT;
  }
  return Math.max(ROOM_MIN_PLAYERS, Math.min(ROOM_MAX_PLAYERS, parsed));
})();
const WS_AUTO_START = URL_PARAMS.get("autostart") === "1";

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

const startNetworkHost = (seed: string) => {
  setOverlayVisible(menuOverlay, false);
  setOverlayVisible(loadingOverlay, true);

  const roomState: RoomConnectionState = {
    role: "host",
    roomCode: null,
    roomId: null,
    localPlayerIndex: null,
    localPlayerId: null,
    playerCount: WS_PLAYER_COUNT,
    inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
    seed,
    players: [],
    transport: null,
    hasSentStart: false
  };

  const { socket, transport } = createWebSocketTransport(WS_SERVER_URL, (payload) => {
    const message = parseRoomServerMessage(payload);
    if (!message) {
      return;
    }
    handleRoomServerMessage(roomState, socket, message);
  });

  roomState.transport = transport;

  socket.addEventListener("open", () => {
    sendRoomMessage(socket, {
      type: "create-room",
      playerCount: WS_PLAYER_COUNT,
      seed,
      inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES
    });
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

const startNetworkClient = (roomCode: string) => {
  setOverlayVisible(menuOverlay, false);
  setOverlayVisible(loadingOverlay, true);

  const normalizedCode = normalizeRoomCode(roomCode);
  if (!isValidRoomCode(normalizedCode)) {
    console.warn(`[net] invalid room code "${roomCode}"`);
    return;
  }

  const roomState: RoomConnectionState = {
    role: "client",
    roomCode: normalizedCode,
    roomId: null,
    localPlayerIndex: null,
    localPlayerId: null,
    playerCount: 0,
    inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
    seed: null,
    players: [],
    transport: null,
    hasSentStart: false
  };

  const { socket, transport } = createWebSocketTransport(WS_SERVER_URL, (payload) => {
    const message = parseRoomServerMessage(payload);
    if (!message) {
      return;
    }
    handleRoomServerMessage(roomState, socket, message);
  });

  roomState.transport = transport;

  socket.addEventListener("open", () => {
    sendRoomMessage(socket, { type: "join-room", code: normalizedCode });
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
      console.info(`[room] created code=${message.code} players=${message.playerCount}`);
      if (WS_AUTO_START && roomState.players.length >= roomState.playerCount && !roomState.hasSentStart) {
        sendRoomMessage(socket, { type: "start-room" });
        roomState.hasSentStart = true;
      }
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
      console.info(`[room] joined code=${message.code} players=${message.playerCount}`);
      return;
    }
    case "room-updated":
      roomState.players = message.players;
      if (roomState.role === "host" &&
        WS_AUTO_START &&
        roomState.players.length >= roomState.playerCount &&
        !roomState.hasSentStart) {
        sendRoomMessage(socket, { type: "start-room" });
        roomState.hasSentStart = true;
      }
      return;
    case "start": {
      if (hasStarted) {
        return;
      }
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
      console.warn(`[room] closed: ${message.reason}`);
      return;
    case "error":
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

  if (NETWORK_MODE === "ws" && WS_ROLE === "client") {
    const code = WS_ROOM_CODE ?? "";
    setOverlayVisible(menuOverlay, false);
    setOverlayVisible(loadingOverlay, true);
    startNetworkClient(code);
    return;
  }

  if (!menuOverlay || !seedInput || !randomSeedButton || !startButton || !loadingOverlay) {
    const seed = generateRandomSeed();
    if (NETWORK_MODE === "ws" && WS_ROLE === "host") {
      void startNetworkHost(seed);
      return;
    }
    void startGame(seed);
    return;
  }

  randomSeedButton.addEventListener("click", () => {
    const seed = generateRandomSeed();
    seedInput.value = seed;
    seedInput.focus();
    seedInput.select();
  });

  const handleStart = () => {
    const seed = getSeedValue();
    seedInput.value = seed;
    seedInput.disabled = true;
    randomSeedButton.disabled = true;
    startButton.disabled = true;
    if (NETWORK_MODE === "ws" && WS_ROLE === "host") {
      startNetworkHost(seed);
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
};

initMenu();
