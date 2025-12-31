import "./style.css";
import { createInputState, bindKeyboard, bindInventorySelection, bindMouse, bindCraftScroll } from "./core/input";
import { applyRemoteInputFrame, createInputSyncState, loadPlayerInputFrame, storeLocalInputFrame } from "./core/input-sync";
import type { InputFrame } from "./core/input-buffer";
import { startLoop } from "./core/loop";
import { createInitialState } from "./game/state";
import { createRollbackBuffer, restoreRollbackFrame, storeRollbackSnapshot } from "./game/rollback";
import { simulateFrame } from "./game/sim";
import { runDeterminismCheck } from "./dev/determinism";
import { render } from "./render/renderer";
import { setHudSeed } from "./render/ui";
import { createHostSession, finalizeSessionStart, setSessionFrame } from "./net/session";

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

let hasStarted = false;
const SHOULD_RUN_DETERMINISM = import.meta.env.DEV && new URLSearchParams(window.location.search).has("determinism");
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
  finalizeSessionStart(session, 0, 0);

  const state = createInitialState(session.seed ?? seed);
  setHudSeed(session.seed ?? seed);
  const liveInput = createInputState();
  const frameInput = createInputState();
  const inputSync = createInputSyncState(session.expectedPlayerCount, session.localPlayerIndex, INPUT_BUFFER_FRAMES);
  const rollbackBuffer = createRollbackBuffer(ROLLBACK_BUFFER_FRAMES);
  let frame = session.startFrame;
  let pendingRollbackFrame: number | null = null;
  const remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }> = [];

  const enqueueRemoteInput = (playerIndex: number, remoteFrame: number, inputFrame: InputFrame) => {
    remoteInputQueue.push({ playerIndex, frame: remoteFrame, input: inputFrame });
  };

  if (import.meta.env.DEV) {
    const devWindow = window as typeof window & { enqueueRemoteInput?: typeof enqueueRemoteInput };
    devWindow.enqueueRemoteInput = enqueueRemoteInput;
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

  const resimulateFrom = (fromFrame: number, toFrame: number, delta: number) => {
    if (!restoreRollbackFrame(rollbackBuffer, state, fromFrame)) {
      return false;
    }

    for (let simFrame = fromFrame; simFrame < toFrame; simFrame += 1) {
      loadPlayerInputFrame(inputSync, session.localPlayerIndex, simFrame, frameInput);
      storeRollbackSnapshot(rollbackBuffer, simFrame, state);
      simulateFrame(state, frameInput, delta);
    }

    return true;
  };

  bindKeyboard(liveInput);
  bindMouse(liveInput);
  bindCraftScroll(liveInput, () => state.crafting.isOpen);
  bindInventorySelection(liveInput, () => !state.crafting.isOpen && !state.isDead);

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

      storeLocalInputFrame(inputSync, frame, liveInput);
      flushRemoteInputs();

      if (pendingRollbackFrame !== null && pendingRollbackFrame < frame) {
        const rollbackFrame = pendingRollbackFrame;
        pendingRollbackFrame = null;
        resimulateFrom(rollbackFrame, frame, delta);
      }

      loadPlayerInputFrame(inputSync, session.localPlayerIndex, frame, frameInput);
      storeRollbackSnapshot(rollbackBuffer, frame, state);
      simulateFrame(state, frameInput, delta);
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
