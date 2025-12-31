import { consumeInteract, type InputState } from "../core/input";
import { ComponentMask, destroyEntity, forEachEntity, isEntityAlive, type EcsWorld, type EntityId } from "../core/ecs";
import { addToInventory } from "../game/inventory";
import type { GameState } from "../game/state";
import { resourceKindFromIndex } from "../world/resource-kinds";

export const GATHER_RANGE = 10;
const RESOURCE_MASK = ComponentMask.Resource | ComponentMask.Position | ComponentMask.Radius;

const rollYield = (min: number, max: number) => {
  if (max <= min) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const getNearestGatherableResource = (
  ecs: EcsWorld,
  playerPos: { x: number; y: number },
  playerRadius: number
): EntityId | null => {
  let nearestId: EntityId | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;

  forEachEntity(ecs, RESOURCE_MASK, (id) => {
    if (ecs.resourceRemaining[id] <= 0) {
      return;
    }

    const dx = playerPos.x - ecs.position.x[id];
    const dy = playerPos.y - ecs.position.y[id];
    const dist = Math.hypot(dx, dy);
    const reach = playerRadius + ecs.radius[id] + GATHER_RANGE;

    if (dist <= reach && dist < nearestDist) {
      nearestId = id;
      nearestDist = dist;
    }
  });

  return nearestId;
};

export const updateResourceRespawns = (state: GameState, delta: number) => {
  const ecs = state.ecs;
  forEachEntity(ecs, RESOURCE_MASK, (id) => {
    if (ecs.resourceRemaining[id] > 0 || ecs.resourceRespawnTime[id] <= 0) {
      return;
    }

    ecs.resourceRespawnTimer[id] -= delta;
    if (ecs.resourceRespawnTimer[id] <= 0) {
      ecs.resourceRemaining[id] = rollYield(ecs.resourceYieldMin[id], ecs.resourceYieldMax[id]);
      ecs.resourceRespawnTimer[id] = 0;
    }
  });
};

export const gatherNearbyResource = (state: GameState, input: InputState) => {
  if (!consumeInteract(input)) {
    return;
  }

  const playerId = state.playerId;
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const position = { x: ecs.position.x[playerId], y: ecs.position.y[playerId] };
  const radius = ecs.radius[playerId];
  const targetId = getNearestGatherableResource(ecs, position, radius);
  if (targetId === null) {
    return;
  }

  const kind = resourceKindFromIndex(ecs.resourceKind[targetId]);
  const added = addToInventory(state.inventory, kind, 1);
  if (added <= 0) {
    return;
  }

  ecs.resourceRemaining[targetId] -= added;
  if (ecs.resourceRemaining[targetId] > 0) {
    return;
  }

  if (ecs.resourceRespawnTime[targetId] > 0) {
    ecs.resourceRespawnTimer[targetId] = ecs.resourceRespawnTime[targetId];
    return;
  }

  destroyEntity(ecs, targetId);
};
