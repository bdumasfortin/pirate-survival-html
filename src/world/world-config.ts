import type { Vec2 } from "../core/types";
import type { ItemKind } from "../game/item-kinds";
import type { BiomeTierConfig, IslandType, ResourceNodeType, YieldRange } from "./types";

export type IslandSpec = {
  center: Vec2;
  baseRadius: number;
  seed: number;
  type: IslandType;
};

const BASE_ISLAND_RADIUS_MIN = 120;
const BASE_ISLAND_RADIUS_MAX = 180;
const ISLAND_SIZE_SCALE = 1;

export const BASE_ISLAND_RADIUS = (BASE_ISLAND_RADIUS_MIN + BASE_ISLAND_RADIUS_MAX) / 2;
export const BOSS_ISLAND_RADIUS = BASE_ISLAND_RADIUS;
export const SPAWN_ZONE_RADIUS = BASE_ISLAND_RADIUS * 0.5;

export const WORLD_GEN_CONFIG = {
  spawnRadius: Math.round(BASE_ISLAND_RADIUS * 1.3),
  radiusMin: BASE_ISLAND_RADIUS_MIN * ISLAND_SIZE_SCALE,
  radiusMax: BASE_ISLAND_RADIUS_MAX * ISLAND_SIZE_SCALE,
  edgePadding: 90 * ISLAND_SIZE_SCALE,
  placementAttempts: 160,
  arcMinAngle: 0,
  arcMaxAngle: Math.PI / 2,
};

export const BIOME_TIERS: BiomeTierConfig[] = [
  {
    id: "calm",
    name: "Calm belt",
    ringMin: 700,
    ringMax: 1400,
    islandCount: 5,
    bossType: "calmBoss",
    weights: {
      beach: 1,
    },
  },
  {
    id: "wild",
    name: "Wild belt",
    ringMin: 1500,
    ringMax: 2500,
    islandCount: 7,
    bossType: "wildBoss",
    weights: {
      woods: 1,
    },
  },
  {
    id: "volcanic",
    name: "Volcanic belt",
    ringMin: 2600,
    ringMax: 3600,
    islandCount: 10,
    bossType: "volcanicBoss",
    weights: {
      volcanic: 1,
    },
  },
];

export type IslandShapeConfig = {
  pointCountMin: number;
  pointCountMax: number;
  waveAMin: number;
  waveAMax: number;
  waveBMin: number;
  waveBMax: number;
  ampAMin: number;
  ampAMax: number;
  ampBMin: number;
  ampBMax: number;
  jitterMin: number;
  jitterMax: number;
  minRadiusRatio: number;
  smoothingPassesMin: number;
  smoothingPassesMax: number;
  leanMin: number;
  leanMax: number;
};

export const ISLAND_SHAPE_CONFIG: IslandShapeConfig = {
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
  leanMax: 1.35,
};

export const ISLAND_SHAPE_CONFIG_BY_TYPE: Partial<Record<IslandType, Partial<IslandShapeConfig>>> = {
  beach: {
    jitterMin: 0.015,
    jitterMax: 0.05,
    smoothingPassesMin: 2,
  },
  woods: {
    pointCountMin: 60,
    pointCountMax: 110,
    jitterMin: 0.03,
    jitterMax: 0.09,
  },
  volcanic: {
    waveAMin: 3,
    waveAMax: 5,
    waveBMin: 6,
    waveBMax: 9,
    ampAMin: 0.1,
    ampAMax: 0.22,
    ampBMin: 0.06,
    ampBMax: 0.16,
    jitterMin: 0.05,
    jitterMax: 0.12,
    smoothingPassesMin: 1,
    smoothingPassesMax: 2,
    minRadiusRatio: 0.14,
  },
  calmBoss: {
    smoothingPassesMin: 2,
    smoothingPassesMax: 4,
  },
  wildBoss: {
    pointCountMin: 64,
    pointCountMax: 120,
    jitterMin: 0.04,
    jitterMax: 0.1,
  },
  volcanicBoss: {
    waveAMin: 3,
    waveAMax: 6,
    waveBMin: 7,
    waveBMax: 10,
    ampAMin: 0.12,
    ampAMax: 0.24,
    ampBMin: 0.08,
    ampBMax: 0.18,
    jitterMin: 0.06,
    jitterMax: 0.14,
    smoothingPassesMin: 1,
    smoothingPassesMax: 2,
    minRadiusRatio: 0.12,
  },
};

export const RESOURCE_PLACEMENT_CONFIG = {
  radiusScale: 0.78,
  attempts: 40,
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
    respawnTime: 0,
  },
  {
    nodeType: "rock",
    kind: "rock",
    radius: 4.5,
    count: 8,
    yield: { min: 1, max: 1 },
    respawnTime: 0,
  },
  {
    nodeType: "bush",
    kind: "berries",
    radius: 14,
    count: 5,
    yield: { min: 2, max: 3 },
    respawnTime: 20,
  },
];

const ROCK_ONLY_RESOURCES = RESOURCE_NODE_CONFIGS.filter((config) => config.nodeType === "rock");

export const RESOURCE_NODE_CONFIGS_BY_TYPE: Record<IslandType, ResourceNodeConfig[]> = {
  beach: RESOURCE_NODE_CONFIGS,
  woods: RESOURCE_NODE_CONFIGS,
  volcanic: ROCK_ONLY_RESOURCES,
  calmBoss: ROCK_ONLY_RESOURCES,
  wildBoss: RESOURCE_NODE_CONFIGS,
  volcanicBoss: ROCK_ONLY_RESOURCES,
};
