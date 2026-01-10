import type { Vec2 } from "../core/types";
import type { ItemKind } from "../game/item-kinds";
import type {
  BiomeTierConfig,
  IslandShapeConfig,
  IslandShapeOverrides,
  IslandType,
  ProceduralWorldConfig,
  ResourceNodeType,
  ResourcePlacementConfig,
  YieldRange,
} from "./types";

export type IslandSpec = {
  center: Vec2;
  baseRadius: number;
  seed: number;
  type: IslandType;
};

export const getProceduralBaseRadius = (config: Pick<ProceduralWorldConfig, "radiusMin" | "radiusMax">) =>
  (config.radiusMin + config.radiusMax) / 2;

export const getSpawnZoneRadius = (config: Pick<ProceduralWorldConfig, "spawnRadius">) => config.spawnRadius * 0.5;

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

export const ISLAND_SHAPE_CONFIG_BY_TYPE: IslandShapeOverrides = {};

export const RESOURCE_PLACEMENT_CONFIG: ResourcePlacementConfig = {
  radiusScale: 0.78,
  attempts: 40,
};

export const WORLD_GEN_CONFIG = {
  spawnRadius: 300,
  radiusMin: 350,
  radiusMax: 500,
  edgePadding: 10,
  placementAttempts: 350,
  arcMinAngle: -1.6,
  arcMaxAngle: 0.6,
  islandShapeConfig: { ...ISLAND_SHAPE_CONFIG },
  islandShapeOverrides: { ...ISLAND_SHAPE_CONFIG_BY_TYPE },
  resourcePlacement: { ...RESOURCE_PLACEMENT_CONFIG },
};

export const BIOME_TIERS: BiomeTierConfig[] = [
  {
    id: "calm",
    name: "Calm belt",
    ringMin: 450,
    ringMax: 2750,
    islandCount: 6,
    bossType: "calmBoss",
    weights: {
      beach: 1,
    },
  },
  {
    id: "wild",
    name: "Wild belt",
    ringMin: 3000,
    ringMax: 6230,
    islandCount: 10,
    bossType: "wildBoss",
    weights: {
      woods: 1,
    },
  },
  {
    id: "volcanic",
    name: "Volcanic belt",
    ringMin: 6500,
    ringMax: 8500,
    islandCount: 15,
    bossType: "volcanicBoss",
    weights: {
      volcanic: 1,
    },
  },
];

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
