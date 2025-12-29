import "./style.css";
import { createInputState, bindKeyboard, bindInventorySelection } from "./core/input";
import { startLoop } from "./core/loop";
import { createInitialState } from "./game/state";
import { updateMovement } from "./systems/movement";
import { constrainPlayerToIslands } from "./systems/collisions";
import { gatherNearbyResource, updateResourceRespawns } from "./systems/gathering";
import { render } from "./render/renderer";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;

if (!canvas) {
  throw new Error("Canvas element not found.");
}

const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("Canvas 2D context not available.");
}

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

const state = createInitialState();
const input = createInputState();

bindKeyboard(input);
bindInventorySelection(state.inventory);

const startGame = async () => {
  if (document.fonts && document.fonts.load) {
    try {
      await document.fonts.load("16px Zain");
    } catch {
      // Ignore font loading issues; fallback rendering will still work.
    }
  }

  startLoop({
    onUpdate: (delta) => {
      state.time += delta;
      updateMovement(state, input, delta);
      constrainPlayerToIslands(state);
      updateResourceRespawns(state, delta);
      gatherNearbyResource(state, input);
    },
    onRender: () => {
      render(ctx, state);
    }
  });
};

void startGame();
