import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import { isEntityAlive } from "../core/ecs";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity } from "../game/inventory";
import { RAFT_INTERACTION_DISTANCE, RAFT_SHORE_BUFFER } from "../game/raft-config";
import { findClosestIslandEdge } from "../world/island-geometry";

export const updateRaft = (state: GameState, input: InputState) => {
  if (state.crafting.isOpen) {
    return;
  }

  if (!input.useQueued) {
    return;
  }

  const selectedIndex = getInventorySelectedIndex(state.ecs, state.playerId);
  const slotKind = getInventorySlotKind(state.ecs, state.playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(state.ecs, state.playerId, selectedIndex);
  if (slotKind !== "raft" || slotQuantity <= 0) {
    return;
  }

  input.useQueued = false;

  const playerId = state.playerId;
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const islands = state.world.islands;
  const position = { x: ecs.position.x[playerId], y: ecs.position.y[playerId] };
  const radius = ecs.radius[playerId];
  const closest = findClosestIslandEdge(position, islands);
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
    const offset = radius + RAFT_SHORE_BUFFER;

    ecs.position.x[playerId] = closest.point.x + (toLand.x / length) * offset;
    ecs.position.y[playerId] = closest.point.y + (toLand.y / length) * offset;
    return;
  }

  state.raft.isOnRaft = true;
  const toWater = {
    x: closest.point.x - closest.island.center.x,
    y: closest.point.y - closest.island.center.y
  };
  const length = Math.hypot(toWater.x, toWater.y) || 1;
  const offset = radius + RAFT_SHORE_BUFFER;

  ecs.position.x[playerId] = closest.point.x + (toWater.x / length) * offset;
  ecs.position.y[playerId] = closest.point.y + (toWater.y / length) * offset;
};
