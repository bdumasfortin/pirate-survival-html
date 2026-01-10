import type { Vec2 } from "../core/types";
import type { ItemKind } from "../game/item-kinds";
import type { IslandType, ProceduralWorldConfig, ResourceNodeType, YieldRange } from "./types";
import worldConfigData from "./world-config.json";

export type IslandSpec = {
  center: Vec2;
  baseRadius: number;
  seed: number;
  type: IslandType;
};

export const getProceduralBaseRadius = (config: Pick<ProceduralWorldConfig, "radiusMin" | "radiusMax">) =>
  (config.radiusMin + config.radiusMax) / 2;

export const getSpawnZoneRadius = (config: Pick<ProceduralWorldConfig, "spawnRadius">) => config.spawnRadius * 0.5;

export const WORLD_GEN_CONFIG = worldConfigData as ProceduralWorldConfig;

export const BIOME_TIERS = WORLD_GEN_CONFIG.biomeTiers;

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
