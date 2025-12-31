import type { InputState } from "../core/input";
import { isEntityAlive } from "../core/ecs";
import { CAMERA_ZOOM } from "./config";
import type { GameState } from "./state";
import { updateMovement } from "../systems/movement";
import { constrainPlayerToIslands } from "../systems/collisions";
import { updateCrafting } from "../systems/crafting";
import { updateCrabs, updatePlayerAttack } from "../systems/crabs";
import { updateInventorySelection } from "../systems/inventory-selection";
import { gatherNearbyResource, updateResourceRespawns } from "../systems/gathering";
import { updateRaft } from "../systems/raft";
import { updateSurvival } from "../systems/survival";
import { dropSelectedItem } from "../systems/drop-selected-item";
import { pickupGroundItems } from "../systems/ground-items";
import { updateUseCooldown, useSelectedItem } from "../systems/use-selected-item";

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

export const simulateFrame = (state: GameState, input: InputState, delta: number) => {
  state.time += delta;

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
};
