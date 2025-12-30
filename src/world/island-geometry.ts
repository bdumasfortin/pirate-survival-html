import type { Vec2 } from "../core/types";
import type { Island } from "./types";

export const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
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

export const closestPointOnPolygon = (point: Vec2, polygon: Vec2[]) => {
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

export const findContainingIsland = (point: Vec2, islands: Island[]) =>
  islands.find((island) => isPointInPolygon(point, island.points));

export const findClosestIslandEdge = (point: Vec2, islands: Island[]) => {
  if (islands.length === 0) {
    return null;
  }

  let closest = islands[0];
  let closestPoint = islands[0].points[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const island of islands) {
    const result = closestPointOnPolygon(point, island.points);
    if (result.distance < closestDistance) {
      closestDistance = result.distance;
      closestPoint = result.point;
      closest = island;
    }
  }

  return { island: closest, point: closestPoint, distance: closestDistance };
};
