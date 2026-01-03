import type { GameState } from "../game/state";
import type { Vec2 } from "../core/types";
import type { Island } from "../world/types";
import { isEntityAlive, type EntityId } from "../core/ecs";
import {
  closestPointOnPolygon,
  findClosestIslandEdge,
  findContainingIsland,
  isPointInIsland
} from "../world/island-geometry";

const trySlide = (position: Vec2, prev: Vec2, island: Island) => {
  const slideX = { x: position.x, y: prev.y };
  if (isPointInIsland(slideX, island)) {
    return slideX;
  }

  const slideY = { x: prev.x, y: position.y };
  if (isPointInIsland(slideY, island)) {
    return slideY;
  }

  return null;
};

const pushPlayerOutOfIsland = (position: Vec2, radius: number, island: Island) => {
  const closest = closestPointOnPolygon(position, island.points);
  const toWater = {
    x: closest.point.x - island.center.x,
    y: closest.point.y - island.center.y
  };
  const length = Math.hypot(toWater.x, toWater.y) || 1;
  const buffer = 0.5;

  return {
    x: closest.point.x + (toWater.x / length) * (radius + buffer),
    y: closest.point.y + (toWater.y / length) * (radius + buffer)
  };
};

export const constrainPlayerToIslands = (state: GameState, playerId: EntityId) => {
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId) || state.world.islands.length === 0) {
    return;
  }

  const islands = state.world.islands;
  const position = { x: ecs.position.x[playerId], y: ecs.position.y[playerId] };
  const prevPosition = { x: ecs.prevPosition.x[playerId], y: ecs.prevPosition.y[playerId] };
  const radius = ecs.radius[playerId];

  if (ecs.playerIsOnRaft[playerId]) {
    const containing = findContainingIsland(position, islands);
    if (containing) {
      const next = pushPlayerOutOfIsland(position, radius, containing);
      ecs.position.x[playerId] = next.x;
      ecs.position.y[playerId] = next.y;
    }
    return;
  }

  const currentIsland = findContainingIsland(position, islands);

  if (currentIsland) {
    return;
  }

  const previousIsland = findContainingIsland(prevPosition, islands);
  const closestEdge = findClosestIslandEdge(position, islands);
  const targetIsland = previousIsland ?? closestEdge?.island ?? islands[0];

  if (previousIsland) {
    const slide = trySlide(position, prevPosition, previousIsland);
    if (slide) {
      ecs.position.x[playerId] = slide.x;
      ecs.position.y[playerId] = slide.y;
      return;
    }
  }

  const closest = closestPointOnPolygon(position, targetIsland.points);
  const toCenter = {
    x: targetIsland.center.x - closest.point.x,
    y: targetIsland.center.y - closest.point.y
  };
  const length = Math.hypot(toCenter.x, toCenter.y) || 1;
  const buffer = 0.5;

  ecs.position.x[playerId] = closest.point.x + (toCenter.x / length) * (radius + buffer);
  ecs.position.y[playerId] = closest.point.y + (toCenter.y / length) * (radius + buffer);
};
