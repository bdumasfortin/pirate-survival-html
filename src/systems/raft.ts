import { ComponentMask, destroyEntity, type EntityId, forEachEntity, isEntityAlive } from "../core/ecs";
import type { InputState } from "../core/input";
import { propKindFromIndex } from "../game/prop-kinds";
import { spawnProp } from "../game/props";
import { RAFT_INTERACTION_DISTANCE, RAFT_SHORE_BUFFER } from "../game/raft-config";
import type { GameState } from "../game/state";
import { getStructurePreviewRadius } from "../game/structure-items";
import { findClosestIslandEdge } from "../world/island-geometry";

const PROP_MASK = ComponentMask.Prop | ComponentMask.Position;

const findNearestRaft = (state: GameState, x: number, y: number) => {
  const ecs = state.ecs;
  let closestId: EntityId | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  forEachEntity(ecs, PROP_MASK, (id) => {
    if (propKindFromIndex(ecs.propKind[id]) !== "raft") {
      return;
    }
    const dx = x - ecs.position.x[id];
    const dy = y - ecs.position.y[id];
    const distance = Math.hypot(dx, dy);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestId = id;
    }
  });

  return closestId !== null ? { id: closestId, distance: closestDistance } : null;
};

export const updateRaft = (state: GameState, playerIndex: number, playerId: EntityId, input: InputState) => {
  const crafting = state.crafting[playerIndex];
  if (crafting?.isOpen) {
    return;
  }

  if (!input.interactQueued) {
    return;
  }

  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const islands = state.world.islands;
  const position = { x: ecs.position.x[playerId], y: ecs.position.y[playerId] };
  const radius = ecs.radius[playerId];

  if (ecs.playerIsOnRaft[playerId]) {
    const closest = findClosestIslandEdge(position, islands);
    if (!closest || closest.distance > RAFT_INTERACTION_DISTANCE) {
      return;
    }
    input.interactQueued = false;
    ecs.playerIsOnRaft[playerId] = 0;
    const toLand = {
      x: closest.island.center.x - closest.point.x,
      y: closest.island.center.y - closest.point.y,
    };
    const length = Math.hypot(toLand.x, toLand.y) || 1;
    const offset = radius + RAFT_SHORE_BUFFER;

    ecs.position.x[playerId] = closest.point.x + (toLand.x / length) * offset;
    ecs.position.y[playerId] = closest.point.y + (toLand.y / length) * offset;
    ecs.prevPosition.x[playerId] = ecs.position.x[playerId];
    ecs.prevPosition.y[playerId] = ecs.position.y[playerId];

    const toWater = {
      x: closest.point.x - closest.island.center.x,
      y: closest.point.y - closest.island.center.y,
    };
    const raftOffset = radius + RAFT_SHORE_BUFFER;
    const raftX = closest.point.x + (toWater.x / length) * raftOffset;
    const raftY = closest.point.y + (toWater.y / length) * raftOffset;
    const raftRadius = getStructurePreviewRadius("raft");
    spawnProp(ecs, "raft", { x: raftX, y: raftY }, { radius: raftRadius, rotation: ecs.playerAimAngle[playerId] });
    return;
  }

  const nearest = findNearestRaft(state, position.x, position.y);
  if (!nearest) {
    return;
  }
  const raftRadius = ecs.radius[nearest.id] || getStructurePreviewRadius("raft");
  if (nearest.distance > raftRadius + RAFT_INTERACTION_DISTANCE) {
    return;
  }

  input.interactQueued = false;
  const raftX = ecs.position.x[nearest.id];
  const raftY = ecs.position.y[nearest.id];
  destroyEntity(ecs, nearest.id);
  ecs.playerIsOnRaft[playerId] = 1;
  ecs.position.x[playerId] = raftX;
  ecs.position.y[playerId] = raftY;
  ecs.prevPosition.x[playerId] = ecs.position.x[playerId];
  ecs.prevPosition.y[playerId] = ecs.position.y[playerId];
};
