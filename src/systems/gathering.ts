import { consumeInteract, type InputState } from "../core/input";
import { addToInventory } from "../game/inventory";
import type { GameState } from "../game/state";
import { isEntityAlive } from "../core/ecs";
import type { ResourceNode, YieldRange } from "../world/types";

export const GATHER_RANGE = 10;

const rollYield = (range: YieldRange) => {
  if (range.max <= range.min) {
    return range.min;
  }
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
};

export const getNearestGatherableResource = (
  playerPos: { x: number; y: number },
  playerRadius: number,
  resources: ResourceNode[]
) => {
  let nearest: ResourceNode | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;

  for (const resource of resources) {
    if (resource.remaining <= 0) {
      continue;
    }

    const dx = playerPos.x - resource.position.x;
    const dy = playerPos.y - resource.position.y;
    const dist = Math.hypot(dx, dy);
    const reach = playerRadius + resource.radius + GATHER_RANGE;

    if (dist <= reach && dist < nearestDist) {
      nearest = resource;
      nearestDist = dist;
    }
  }

  return nearest;
};

export const updateResourceRespawns = (state: GameState, delta: number) => {
  for (const resource of state.world.resources) {
    if (resource.remaining > 0 || resource.respawnTime <= 0) {
      continue;
    }

    resource.respawnTimer -= delta;
    if (resource.respawnTimer <= 0) {
      resource.remaining = rollYield(resource.yield);
      resource.respawnTimer = 0;
    }
  }
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
  const target = getNearestGatherableResource(position, radius, state.world.resources);
  if (!target) {
    return;
  }

  const added = addToInventory(state.inventory, target.kind, 1);
  if (added <= 0) {
    return;
  }

  target.remaining -= added;
  if (target.remaining > 0) {
    return;
  }

  if (target.respawnTime > 0) {
    target.respawnTimer = target.respawnTime;
    return;
  }

  const index = state.world.resources.findIndex((resource) => resource.id === target.id);
  if (index >= 0) {
    state.world.resources.splice(index, 1);
  }
};
