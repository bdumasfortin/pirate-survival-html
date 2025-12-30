import type { GameState } from "../game/state";
import type { Vec2 } from "../core/types";
import type { Island } from "../world/types";
import {
  closestPointOnPolygon,
  findClosestIslandEdge,
  findContainingIsland,
  isPointInPolygon
} from "../world/island-geometry";

const trySlide = (position: Vec2, prev: Vec2, island: Island) => {
  const slideX = { x: position.x, y: prev.y };
  if (isPointInPolygon(slideX, island.points)) {
    return slideX;
  }

  const slideY = { x: prev.x, y: position.y };
  if (isPointInPolygon(slideY, island.points)) {
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

export const constrainPlayerToIslands = (state: GameState) => {
  const player = state.entities.find((entity) => entity.id === state.playerId);

  if (!player || state.world.islands.length === 0) {
    return;
  }

  const islands = state.world.islands;

  if (state.raft.isOnRaft) {
    const containing = findContainingIsland(player.position, islands);
    if (containing) {
      const next = pushPlayerOutOfIsland(player.position, player.radius, containing);
      player.position.x = next.x;
      player.position.y = next.y;
    }
    return;
  }

  const currentIsland = findContainingIsland(player.position, islands);

  if (currentIsland) {
    return;
  }

  const previousIsland = findContainingIsland(player.prevPosition, islands);
  const closestEdge = findClosestIslandEdge(player.position, islands);
  const targetIsland = previousIsland ?? closestEdge?.island ?? islands[0];

  if (previousIsland) {
    const slide = trySlide(player.position, player.prevPosition, previousIsland);
    if (slide) {
      player.position.x = slide.x;
      player.position.y = slide.y;
      return;
    }
  }

  const closest = closestPointOnPolygon(player.position, targetIsland.points);
  const toCenter = {
    x: targetIsland.center.x - closest.point.x,
    y: targetIsland.center.y - closest.point.y
  };
  const length = Math.hypot(toCenter.x, toCenter.y) || 1;
  const buffer = 0.5;

  player.position.x = closest.point.x + (toCenter.x / length) * (player.radius + buffer);
  player.position.y = closest.point.y + (toCenter.y / length) * (player.radius + buffer);
};
