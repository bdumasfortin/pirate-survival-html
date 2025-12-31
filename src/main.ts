import "./style.css";
import { createInputState, bindKeyboard, bindInventorySelection, bindMouse, bindCraftScroll, type InputState } from "./core/input";
import { createInputBuffer, loadInputFrame, storeInputFrame } from "./core/input-buffer";
import { isEntityAlive } from "./core/ecs";
import { startLoop } from "./core/loop";
import { CAMERA_ZOOM } from "./game/config";
import { createInitialState, type GameState } from "./game/state";
import { updateMovement } from "./systems/movement";
import { constrainPlayerToIslands } from "./systems/collisions";
import { updateCrafting } from "./systems/crafting";
import { updateCrabs, updatePlayerAttack } from "./systems/crabs";
import { updateInventorySelection } from "./systems/inventory-selection";
import { gatherNearbyResource, updateResourceRespawns } from "./systems/gathering";
import { updateRaft } from "./systems/raft";
import { updateSurvival } from "./systems/survival";
import { dropSelectedItem } from "./systems/drop-selected-item";
import { pickupGroundItems } from "./systems/ground-items";
import { updateUseCooldown, useSelectedItem } from "./systems/use-selected-item";
import { render } from "./render/renderer";
import { setHudSeed } from "./render/ui";

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

const updateMouseWorldPosition = (input: InputState, playerX: number, playerY: number) => {
  if (!input.mouseScreen) {
    return;
  }

  input.mouseWorld = {
    x: (input.mouseScreen.x - window.innerWidth / 2) / CAMERA_ZOOM + playerX,
    y: (input.mouseScreen.y - window.innerHeight / 2) / CAMERA_ZOOM + playerY
  };
};

const updateAimAngle = (state: GameState, input: InputState, playerX: number, playerY: number) => {
  if (!input.mouseWorld) {
    return;
  }

  const dx = input.mouseWorld.x - playerX;
  const dy = input.mouseWorld.y - playerY;
  if (Math.hypot(dx, dy) > 0.01) {
    state.aimAngle = Math.atan2(dy, dx);
  }
};

const clearQueuedUse = (input: InputState) => {
  if (input.useQueued) {
    input.useQueued = false;
  }
};

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
const INPUT_BUFFER_FRAMES = 240;

const startGame = async (seed: string) => {
  if (hasStarted) {
    return;
  }

  hasStarted = true;
  setOverlayVisible(menuOverlay, false);
  setOverlayVisible(loadingOverlay, true);

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const state = createInitialState(seed);
  setHudSeed(seed);
  const liveInput = createInputState();
  const frameInput = createInputState();
  const inputBuffer = createInputBuffer(INPUT_BUFFER_FRAMES);
  let frame = 0;

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
      state.time += delta;
      storeInputFrame(inputBuffer, frame, liveInput);
      loadInputFrame(inputBuffer, frame, frameInput);
      frame += 1;

      const input = frameInput;

      const playerId = state.playerId;
      if (isEntityAlive(state.ecs, playerId)) {
        const playerX = state.ecs.position.x[playerId];
        const playerY = state.ecs.position.y[playerId];
        updateMouseWorldPosition(input, playerX, playerY);
        updateAimAngle(state, input, playerX, playerY);
      }

      updateInventorySelection(state, input);

      if (!state.isDead) {
        updateMovement(state, input, delta);
        constrainPlayerToIslands(state);
        updateCrafting(state, input);
        if (!state.crafting.isOpen) {
          updateRaft(state, input);
        }
      }

      updateResourceRespawns(state, delta);

      if (!state.isDead) {
        gatherNearbyResource(state, input);
        updateUseCooldown(state, delta);
        if (!state.crafting.isOpen) {
          updatePlayerAttack(state, input, delta);
          useSelectedItem(state, input);
        }
        dropSelectedItem(state, input);
        pickupGroundItems(state);
      }

      updateCrabs(state, delta);
      updateSurvival(state, delta);

      clearQueuedUse(input);
    },
    onRender: () => {
      render(ctx, state);
    }
  });
};

const initMenu = () => {
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
