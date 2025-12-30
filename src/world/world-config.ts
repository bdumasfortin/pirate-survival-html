import type { Vec2 } from "../core/types";
import type { IslandType, ResourceKind, ResourceNodeType, YieldRange } from "./types";

export type IslandSpec = {
  center: Vec2;
  baseRadius: number;
  seed: number;
  type: IslandType;
};

export const WORLD_GEN_CONFIG = {
  islandCount: 100,
  spawnRadius: 420,
  radiusMin: 220,
  radiusMax: 380,
  ringMin: 650,
  ringMax: 2400,
  edgePadding: 120,
  placementAttempts: 120
};

export const ISLAND_TYPE_WEIGHTS: Record<IslandType, number> = {
  standard: 5,
  forest: 5,
  beach: 1
};

export const ISLAND_SHAPE_CONFIG = {
  pointCount: 72,
  waveA: 3,
  waveB: 5,
  ampA: 0.12,
  ampB: 0.06,
  jitter: 0.04,
  minRadius: 60,
  smoothingPasses: 2
};

export const RESOURCE_PLACEMENT_CONFIG = {
  radiusScale: 0.78,
  attempts: 40
};

export type ResourceNodeConfig = {
  nodeType: ResourceNodeType;
  kind: ResourceKind;
  radius: number;
  count: number;
  yield: YieldRange;
  respawnTime: number;
};

export const RESOURCE_NODE_CONFIGS: ResourceNodeConfig[] = [
  {
    nodeType: "tree",
    kind: "wood",
    radius: 20,
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
  beach: RESOURCE_NODE_CONFIGS.filter((config) => config.nodeType === "rock")
};
