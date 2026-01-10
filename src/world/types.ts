import type { Vec2 } from "../core/types";

export type IslandType = "standard" | "forest" | "crabBoss" | "wolfBoss";

export type Island = {
  center: Vec2;
  points: Vec2[];
  type: IslandType;
  seed: number;
};

export type ResourceNodeType = "tree" | "rock" | "bush";

export type YieldRange = {
  min: number;
  max: number;
};

export type WorldPreset = "procedural" | "test" | "creative";

export type ProceduralWorldConfig = {
  islandCount: number;
  spawnRadius: number;
  radiusMin: number;
  radiusMax: number;
  ringMin: number;
  ringMax: number;
  edgePadding: number;
  placementAttempts: number;
  islandTypeWeights: Record<IslandType, number>;
};

export type ProceduralWorldConfigOverrides = Partial<Omit<ProceduralWorldConfig, "islandTypeWeights">> & {
  islandTypeWeights?: Partial<Record<IslandType, number>>;
};

export type WorldConfig = {
  preset: WorldPreset;
  seed: number;
  procedural: ProceduralWorldConfig;
};

export type WorldConfigInput = {
  seed?: string | number;
  preset?: WorldPreset;
  procedural?: ProceduralWorldConfigOverrides;
};

export type WorldState = {
  config: WorldConfig;
  islands: Island[];
};
