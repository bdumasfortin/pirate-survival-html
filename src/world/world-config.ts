import type { Vec2 } from "../core/types";
import type { ItemKind } from "../game/item-kinds";
import type { IslandType, ResourceNodeType, YieldRange } from "./types";

export type IslandSpec = {
  center: Vec2;
  baseRadius: number;
  seed: number;
  type: IslandType;
};

const BASE_ISLAND_RADIUS_MIN = 220;
const BASE_ISLAND_RADIUS_MAX = 380;
const ISLAND_SIZE_SCALE = 3;

export const BASE_ISLAND_RADIUS = (BASE_ISLAND_RADIUS_MIN + BASE_ISLAND_RADIUS_MAX) / 2;
export const BOSS_ISLAND_RADIUS = BASE_ISLAND_RADIUS;
export const BEACH_ISLAND_RADIUS = BOSS_ISLAND_RADIUS;

export const WORLD_GEN_CONFIG = {
  islandCount: 55,
  spawnRadius: 420 * ISLAND_SIZE_SCALE,
  radiusMin: BASE_ISLAND_RADIUS_MIN * ISLAND_SIZE_SCALE,
  radiusMax: BASE_ISLAND_RADIUS_MAX * ISLAND_SIZE_SCALE,
  ringMin: 650 * ISLAND_SIZE_SCALE,
  ringMax: 2400 * ISLAND_SIZE_SCALE,
  edgePadding: 180 * ISLAND_SIZE_SCALE,
  placementAttempts: 120
};

export const ISLAND_TYPE_WEIGHTS: Record<IslandType, number> = {
  standard: 5,
  forest: 5,
  crabBoss: 1,
  wolfBoss: 0
};

export const ISLAND_SHAPE_CONFIG = {
  pointCountMin: 54,
  pointCountMax: 96,
  waveAMin: 2,
  waveAMax: 4,
  waveBMin: 4,
  waveBMax: 7,
  ampAMin: 0.08,
  ampAMax: 0.18,
  ampBMin: 0.04,
  ampBMax: 0.12,
  jitterMin: 0.02,
  jitterMax: 0.08,
  minRadiusRatio: 0.18,
  smoothingPassesMin: 1,
  smoothingPassesMax: 3,
  leanMin: 0.7,
  leanMax: 1.35
};

export const RESOURCE_PLACEMENT_CONFIG = {
  radiusScale: 0.78,
  attempts: 40
};

export type ResourceNodeConfig = {
  nodeType: ResourceNodeType;
  kind: ItemKind;
  radius: number;
  count: number;
  yield: YieldRange;
  respawnTime: number;
};

export const RESOURCE_NODE_CONFIGS: ResourceNodeConfig[] = [
  {
    nodeType: "tree",
    kind: "wood",
    radius: 40,
    count: 7,
    yield: { min: 3, max: 5 },
    respawnTime: 0
  },
  {
    nodeType: "rock",
    kind: "rock",
    radius: 8,
    count: 14,
    yield: { min: 1, max: 1 },
    respawnTime: 0
  },
  {
    nodeType: "bush",
    kind: "berries",
    radius: 14,
    count: 5,
    yield: { min: 2, max: 3 },
    respawnTime: 20
  }
];

export const RESOURCE_NODE_CONFIGS_BY_TYPE: Record<IslandType, ResourceNodeConfig[]> = {
  standard: RESOURCE_NODE_CONFIGS,
  forest: RESOURCE_NODE_CONFIGS,
  wolfBoss: RESOURCE_NODE_CONFIGS,
  crabBoss: RESOURCE_NODE_CONFIGS.filter((config) => config.nodeType === "rock")
};
