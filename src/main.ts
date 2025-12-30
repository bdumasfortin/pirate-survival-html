import "./style.css";
import { createInputState, bindKeyboard, bindInventorySelection, bindMouse, bindCraftScroll } from "./core/input";
import { startLoop } from "./core/loop";
import { CAMERA_ZOOM } from "./game/config";
import { createInitialState } from "./game/state";
import { updateMovement } from "./systems/movement";
import { constrainPlayerToIslands } from "./systems/collisions";
import { updateCrafting } from "./systems/crafting";
import { updateCrabs, updatePlayerAttack } from "./systems/crabs";
import { gatherNearbyResource, updateResourceRespawns } from "./systems/gathering";
import { updateRaft } from "./systems/raft";
import { updateSurvival } from "./systems/survival";
import { dropSelectedItem } from "./systems/drop-selected-item";
import { updateUseCooldown, useSelectedItem } from "./systems/use-selected-item";
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
bindMouse(input);
bindCraftScroll(input, () => state.crafting.isOpen);
bindInventorySelection(state.inventory, () => !state.crafting.isOpen && !state.isDead);

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

      const player = state.entities.find((entity) => entity.id === state.playerId);
      if (player && input.mouseScreen) {
        input.mouseWorld = {
          x: (input.mouseScreen.x - window.innerWidth / 2) / CAMERA_ZOOM + player.position.x,
          y: (input.mouseScreen.y - window.innerHeight / 2) / CAMERA_ZOOM + player.position.y
        };
      }

      if (player && input.mouseWorld) {
        const dx = input.mouseWorld.x - player.position.x;
        const dy = input.mouseWorld.y - player.position.y;
        if (Math.hypot(dx, dy) > 0.01) {
          state.aimAngle = Math.atan2(dy, dx);
        }
      }

      if (!state.isDead) {
        updateMovement(state, input, delta);
        updateRaft(state, input);
        constrainPlayerToIslands(state);
        updateCrafting(state, input);
      }

      updateResourceRespawns(state, delta);

      if (!state.isDead) {
        gatherNearbyResource(state, input);
        updateUseCooldown(delta);
        updatePlayerAttack(state, input, delta);
        useSelectedItem(state, input);
        dropSelectedItem(state, input);
      }

      updateCrabs(state, delta);
      updateSurvival(state, delta);
    },
    onRender: () => {
      render(ctx, state);
    }
  });
};

void startGame();
