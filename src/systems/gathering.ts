import { ComponentMask, destroyEntity, type EcsWorld, type EntityId, forEachEntity, isEntityAlive } from "../core/ecs";
import { consumeInteract, type InputState } from "../core/input";
import { nextInt, type RngState } from "../core/rng";
import { addToInventory } from "../game/inventory";
import { itemKindFromIndex } from "../game/item-kinds";
import type { GameState } from "../game/state";

export const GATHER_RANGE = 10;
const RESOURCE_MASK = ComponentMask.Resource | ComponentMask.Position | ComponentMask.Radius;

const rollYield = (rng: RngState, min: number, max: number) => nextInt(rng, min, max);

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
  const rng = state.rng;
  forEachEntity(ecs, RESOURCE_MASK, (id) => {
    if (ecs.resourceRemaining[id] > 0 || ecs.resourceRespawnTime[id] <= 0) {
      return;
    }

    ecs.resourceRespawnTimer[id] -= delta;
    if (ecs.resourceRespawnTimer[id] <= 0) {
      ecs.resourceRemaining[id] = rollYield(rng, ecs.resourceYieldMin[id], ecs.resourceYieldMax[id]);
      ecs.resourceRespawnTimer[id] = 0;
    }
  });
};

export const gatherNearbyResource = (state: GameState, playerId: EntityId, input: InputState) => {
  if (!consumeInteract(input)) {
    return;
  }

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

  const kind = itemKindFromIndex(ecs.resourceKind[targetId]);
  const added = addToInventory(ecs, playerId, kind, 1);
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
