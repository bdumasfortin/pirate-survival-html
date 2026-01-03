import type { Vec2 } from "../core/types";
import type { WorldState } from "../world/types";

const MAP_SIZE = 360;
const MAP_PADDING = 18;

let mapOverlayEnabled = false;

type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };

const mapBoundsCache = new WeakMap<WorldState, WorldBounds>();

export const toggleMapOverlay = () => {
  mapOverlayEnabled = !mapOverlayEnabled;
};

export const setMapOverlayEnabled = (enabled: boolean) => {
  mapOverlayEnabled = enabled;
};

export const isMapOverlayEnabled = () => mapOverlayEnabled;

export const getMapLayout = (innerWidth: number, innerHeight: number) => {
  const panelX = (innerWidth - MAP_SIZE) / 2;
  const panelY = (innerHeight - MAP_SIZE) / 2;
  return {
    panelX,
    panelY,
    panelWidth: MAP_SIZE,
    panelHeight: MAP_SIZE,
    padding: MAP_PADDING
  };
};

export const getWorldBounds = (world: WorldState) => {
  const cached = mapBoundsCache.get(world);
  if (cached) {
    return cached;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const island of world.islands) {
    for (const point of island.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (world.islands.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const bounds = { minX, minY, maxX, maxY };
  mapBoundsCache.set(world, bounds);
  return bounds;
};

export const mapScreenToWorld = (
  world: WorldState,
  screenX: number,
  screenY: number,
  innerWidth: number,
  innerHeight: number
): Vec2 | null => {
  const layout = getMapLayout(innerWidth, innerHeight);
  const { panelX, panelY, panelWidth, panelHeight, padding } = layout;
  if (screenX < panelX || screenX > panelX + panelWidth || screenY < panelY || screenY > panelY + panelHeight) {
    return null;
  }

  const bounds = getWorldBounds(world);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const innerSizeX = panelWidth - padding * 2;
  const innerSizeY = panelHeight - padding * 2;
  const scale = Math.min(innerSizeX / width, innerSizeY / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const offsetX = panelX + padding + (innerSizeX - drawWidth) / 2;
  const offsetY = panelY + padding + (innerSizeY - drawHeight) / 2;

  if (screenX < offsetX || screenX > offsetX + drawWidth || screenY < offsetY || screenY > offsetY + drawHeight) {
    return null;
  }

  const worldX = (screenX - offsetX) / scale + bounds.minX;
  const worldY = (screenY - offsetY) / scale + bounds.minY;
  return { x: worldX, y: worldY };
};
