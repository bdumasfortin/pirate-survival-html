import type { GameState } from "../game/state";
import type { Vec2 } from "../core/types";
import type { Island } from "../world/world";

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
};

const closestPointOnSegment = (point: Vec2, a: Vec2, b: Vec2) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = ((point.x - a.x) * abx + (point.y - a.y) * aby) / (abx * abx + aby * aby || 1);
  const clamped = Math.max(0, Math.min(1, t));
  return {
    x: a.x + abx * clamped,
    y: a.y + aby * clamped
  };
};

const closestPointOnPolygon = (point: Vec2, polygon: Vec2[]) => {
  let closest = polygon[0];
  let closestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const candidate = closestPointOnSegment(point, a, b);
    const dx = point.x - candidate.x;
    const dy = point.y - candidate.y;
    const dist = Math.hypot(dx, dy);

    if (dist < closestDist) {
      closest = candidate;
      closestDist = dist;
    }
  }

  return { point: closest, distance: closestDist };
};

const findContainingIsland = (point: Vec2, islands: Island[]) =>
  islands.find((island) => isPointInPolygon(point, island.points));

const findClosestIsland = (point: Vec2, islands: Island[]) => {
  let closest = islands[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const island of islands) {
    const result = closestPointOnPolygon(point, island.points);
    if (result.distance < closestDistance) {
      closestDistance = result.distance;
      closest = island;
    }
  }

  return closest;
};

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

export const constrainPlayerToIslands = (state: GameState) => {
  const player = state.entities.find((entity) => entity.id === state.playerId);

  if (!player || state.world.islands.length === 0) {
    return;
  }

  const islands = state.world.islands;
  const currentIsland = findContainingIsland(player.position, islands);

  if (currentIsland) {
    return;
  }

  const previousIsland = findContainingIsland(player.prevPosition, islands);
  const targetIsland = previousIsland ?? findClosestIsland(player.position, islands);

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
