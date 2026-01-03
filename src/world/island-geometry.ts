import type { Vec2 } from "../core/types";
import type { Island } from "./types";

type IslandBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type IslandGeometry = {
  bounds: IslandBounds;
  xs: Float32Array;
  ys: Float32Array;
};

const islandGeometryCache = new WeakMap<Island, IslandGeometry>();

const getIslandGeometry = (island: Island): IslandGeometry => {
  const cached = islandGeometryCache.get(island);
  if (cached) {
    return cached;
  }

  const { points } = island;
  const length = points.length;
  const xs = new Float32Array(length);
  const ys = new Float32Array(length);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < length; i += 1) {
    const point = points[i];
    xs[i] = point.x;
    ys[i] = point.y;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const geometry = { bounds: { minX, minY, maxX, maxY }, xs, ys };
  islandGeometryCache.set(island, geometry);
  return geometry;
};

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

const isPointInPolygonArrays = (point: Vec2, xs: Float32Array, ys: Float32Array) => {
  const length = xs.length;
  if (length === 0) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = length - 1; i < length; j = i, i += 1) {
    const xi = xs[i];
    const yi = ys[i];
    const xj = xs[j];
    const yj = ys[j];
    const intersects = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

export const isPointInIsland = (point: Vec2, island: Island) => {
  const { bounds, xs, ys } = getIslandGeometry(island);
  if (point.x < bounds.minX || point.x > bounds.maxX || point.y < bounds.minY || point.y > bounds.maxY) {
    return false;
  }
  return isPointInPolygonArrays(point, xs, ys);
};

const closestPointOnSegment = (point: Vec2, a: Vec2, b: Vec2, out: Vec2) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = ((point.x - a.x) * abx + (point.y - a.y) * aby) / (abx * abx + aby * aby || 1);
  const clamped = Math.max(0, Math.min(1, t));
  out.x = a.x + abx * clamped;
  out.y = a.y + aby * clamped;
  return out;
};

export const closestPointOnPolygon = (point: Vec2, polygon: Vec2[]) => {
  let closestX = polygon[0]?.x ?? 0;
  let closestY = polygon[0]?.y ?? 0;
  let closestDist = Number.POSITIVE_INFINITY;
  const candidate = { x: 0, y: 0 };

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    closestPointOnSegment(point, a, b, candidate);
    const dx = point.x - candidate.x;
    const dy = point.y - candidate.y;
    const dist = Math.hypot(dx, dy);

    if (dist < closestDist) {
      closestX = candidate.x;
      closestY = candidate.y;
      closestDist = dist;
    }
  }

  return { point: { x: closestX, y: closestY }, distance: closestDist };
};

export const findContainingIsland = (point: Vec2, islands: Island[]) =>
  islands.find((island) => isPointInIsland(point, island));

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
