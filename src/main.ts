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
import { createHostSession, finalizeSessionStart, setSessionFrame } from "./net/session";
import { decodeInputPacket, encodeInputPacket, type InputPacket } from "./net/input-wire";
import { createLoopbackTransportPair, type Transport } from "./net/transport";

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
const LOOPBACK_LATENCY_MS = Math.max(0, Number.parseInt(URL_PARAMS.get("latencyMs") ?? "0", 10) || 0);
const LOOPBACK_JITTER_MS = Math.max(0, Number.parseInt(URL_PARAMS.get("jitterMs") ?? "0", 10) || 0);
const LOOPBACK_DROP_RATE = Math.min(1, Math.max(0, Number.parseFloat(URL_PARAMS.get("dropRate") ?? "0") || 0));
const INPUT_BUFFER_FRAMES = 240;
const ROLLBACK_BUFFER_FRAMES = 240;
const PLAYER_COUNT = 1;

const startGame = async (seed: string) => {
  if (hasStarted) {
    return;
  }

  hasStarted = true;
  setOverlayVisible(menuOverlay, false);
  setOverlayVisible(loadingOverlay, true);

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const session = createHostSession(seed, PLAYER_COUNT);
  finalizeSessionStart(session, 0, INPUT_DELAY_FRAMES);

  const state = createInitialState(session.seed ?? seed, session.expectedPlayerCount, session.localPlayerIndex);
  setHudSeed(session.seed ?? seed);
  const liveInput = createInputState();
  const frameInputs = Array.from({ length: session.expectedPlayerCount }, () => createInputState());
  const inputSync = createInputSyncState(session.expectedPlayerCount, session.localPlayerIndex, INPUT_BUFFER_FRAMES);
  const rollbackBuffer = createRollbackBuffer(ROLLBACK_BUFFER_FRAMES);
  let frame = session.startFrame;
  let pendingRollbackFrame: number | null = null;
  const remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }> = [];
  let transport: Transport | null = null;

  const enqueueRemoteInput = (playerIndex: number, remoteFrame: number, inputFrame: InputFrame) => {
    remoteInputQueue.push({ playerIndex, frame: remoteFrame, input: inputFrame });
  };

  if (import.meta.env.DEV) {
    const devWindow = window as typeof window & { enqueueRemoteInput?: typeof enqueueRemoteInput };
    devWindow.enqueueRemoteInput = enqueueRemoteInput;
  }

  if (NETWORK_MODE === "loopback") {
    const [localTransport, remoteTransport] = createLoopbackTransportPair({
      latencyMs: LOOPBACK_LATENCY_MS,
      jitterMs: LOOPBACK_JITTER_MS,
      dropRate: LOOPBACK_DROP_RATE
    });
    transport = localTransport;
    transport.onMessage((data) => {
      const packet = decodeInputPacket(data);
      if (packet) {
        enqueueRemoteInput(packet.playerIndex, packet.frame, packet.input);
      }
    });

    if (import.meta.env.DEV) {
      const devWindow = window as typeof window & { sendLoopbackPacket?: (packet: InputPacket) => void };
      devWindow.sendLoopbackPacket = (packet: InputPacket) => {
        remoteTransport.send(encodeInputPacket(packet));
      };
    }
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

      const inputFrameIndex = frame + INPUT_DELAY_FRAMES;
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

const initMenu = () => {
  if (SHOULD_RUN_DETERMINISM) {
    runDeterminismCheck();
    return;
  }

  if (!menuOverlay || !seedInput || !randomSeedButton || !startButton || !loadingOverlay) {
    const seed = generateRandomSeed();
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
