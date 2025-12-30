import type { Vec2 } from "../core/types";
import type { ResourceKind, ResourceNodeType, YieldRange } from "./types";

export type IslandSpec = {
  center: Vec2;
  baseRadius: number;
  seed: number;
};

export const WORLD_GEN_CONFIG = {
  islandCount: 5,
  spawnRadius: 420,
  radiusMin: 260,
  radiusMax: 340,
  ringMin: 620,
  ringMax: 980,
  edgePadding: 80,
  placementAttempts: 80
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
