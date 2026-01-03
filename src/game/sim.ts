import type { InputState } from "../core/input";
import { isEntityAlive, type EntityId } from "../core/ecs";
import { CAMERA_ZOOM } from "./config";
import type { GameState } from "./state";
import { updateMovement } from "../systems/movement";
import { constrainPlayerToIslands } from "../systems/collisions";
import { updateCrafting } from "../systems/crafting";
import { updateEnemies } from "../systems/enemies";
import { updatePlayerCombat } from "../systems/player-combat";
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

  if (!input.mouseWorld) {
    input.mouseWorld = { x: 0, y: 0 };
  }
  input.mouseWorld.x = (input.mouseScreen.x - window.innerWidth / 2) / CAMERA_ZOOM + playerX;
  input.mouseWorld.y = (input.mouseScreen.y - window.innerHeight / 2) / CAMERA_ZOOM + playerY;
};

const updateAimAngle = (state: GameState, playerId: EntityId, input: InputState, playerX: number, playerY: number) => {
  if (!input.mouseWorld) {
    return;
  }

  const dx = input.mouseWorld.x - playerX;
  const dy = input.mouseWorld.y - playerY;
  if (Math.hypot(dx, dy) > 0.01) {
    state.ecs.playerAimAngle[playerId] = Math.atan2(dy, dx);
  }
};

const clearQueuedUse = (input: InputState) => {
  if (input.useQueued) {
    input.useQueued = false;
  }
};

export const simulateFrame = (state: GameState, inputs: InputState[], delta: number) => {
  state.time += delta;

  const ecs = state.ecs;

  for (let index = 0; index < state.playerIds.length; index += 1) {
    const playerId = state.playerIds[index];
    const input = inputs[index];
    if (!input) {
      continue;
    }
    if (!isEntityAlive(ecs, playerId)) {
      continue;
    }

    const playerX = ecs.position.x[playerId];
    const playerY = ecs.position.y[playerId];
    updateMouseWorldPosition(input, playerX, playerY);
    updateAimAngle(state, playerId, input, playerX, playerY);

    updateInventorySelection(state, playerId, input);

    if (!ecs.playerIsDead[playerId]) {
      updateMovement(state, playerId, input, delta);
      if (!input.mouseWorld) {
        const speed = Math.hypot(ecs.velocity.x[playerId], ecs.velocity.y[playerId]);
        if (speed > 0.01) {
          ecs.playerAimAngle[playerId] = ecs.playerMoveAngle[playerId];
        }
      }
      constrainPlayerToIslands(state, playerId);
      updateCrafting(state, index, playerId, input);
      if (!state.crafting[index]?.isOpen) {
        updateRaft(state, index, playerId, input);
      }
    }
  }

  updateResourceRespawns(state, delta);

  for (let index = 0; index < state.playerIds.length; index += 1) {
    const playerId = state.playerIds[index];
    const input = inputs[index];
    if (!input) {
      continue;
    }
    if (!isEntityAlive(ecs, playerId)) {
      continue;
    }

    if (!ecs.playerIsDead[playerId]) {
      gatherNearbyResource(state, playerId, input);
      updateUseCooldown(state, playerId, delta);
      if (!state.crafting[index]?.isOpen) {
        updatePlayerCombat(state, index, playerId, input, delta);
        useSelectedItem(state, playerId, input);
      }
      dropSelectedItem(state, playerId, input);
      pickupGroundItems(state, playerId);
    }
  }

  updateEnemies(state, delta);

  for (let index = 0; index < state.playerIds.length; index += 1) {
    const playerId = state.playerIds[index];
    if (!isEntityAlive(ecs, playerId)) {
      continue;
    }
    updateSurvival(state, index, playerId, delta);
  }

  for (const input of inputs) {
    if (input) {
      clearQueuedUse(input);
    }
  }
};
