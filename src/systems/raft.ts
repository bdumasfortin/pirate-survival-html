import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import { RAFT_INTERACTION_DISTANCE, RAFT_SHORE_BUFFER } from "../game/raft-config";
import { findClosestIslandEdge } from "../world/island-geometry";

export const updateRaft = (state: GameState, input: InputState) => {
  if (!input.useQueued) {
    return;
  }

  const slot = state.inventory.slots[state.inventory.selectedIndex];
  if (!slot || slot.kind !== "raft" || slot.quantity <= 0) {
    return;
  }

  input.useQueued = false;

  const player = state.entities.find((entity) => entity.id === state.playerId);
  if (!player) {
    return;
  }

  const islands = state.world.islands;
  const closest = findClosestIslandEdge(player.position, islands);
  if (!closest || closest.distance > RAFT_INTERACTION_DISTANCE) {
    return;
  }

  if (state.raft.isOnRaft) {
    state.raft.isOnRaft = false;
    const toLand = {
      x: closest.island.center.x - closest.point.x,
      y: closest.island.center.y - closest.point.y
    };
    const length = Math.hypot(toLand.x, toLand.y) || 1;
    const offset = player.radius + RAFT_SHORE_BUFFER;

    player.position.x = closest.point.x + (toLand.x / length) * offset;
    player.position.y = closest.point.y + (toLand.y / length) * offset;
    return;
  }

  state.raft.isOnRaft = true;
  const toWater = {
    x: closest.point.x - closest.island.center.x,
    y: closest.point.y - closest.island.center.y
  };
  const length = Math.hypot(toWater.x, toWater.y) || 1;
  const offset = player.radius + RAFT_SHORE_BUFFER;

  player.position.x = closest.point.x + (toWater.x / length) * offset;
  player.position.y = closest.point.y + (toWater.y / length) * offset;
};
