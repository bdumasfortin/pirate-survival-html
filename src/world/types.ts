import type { Vec2 } from "../core/types";

export type IslandType = "beach" | "woods" | "volcanic" | "calmBoss" | "wildBoss" | "volcanicBoss";

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

export type BiomeTierId = "calm" | "wild" | "volcanic";

export type WorldPreset = "procedural" | "test" | "creative";

export type BiomeTierConfig = {
  id: BiomeTierId;
  name: string;
  ringMin: number;
  ringMax: number;
  islandCount: number;
  bossType: IslandType;
  weights: Partial<Record<IslandType, number>>;
};

export type ProceduralWorldConfig = {
  spawnRadius: number;
  radiusMin: number;
  radiusMax: number;
  edgePadding: number;
  placementAttempts: number;
  arcMinAngle: number;
  arcMaxAngle: number;
  biomeTiers: BiomeTierConfig[];
};

export type ProceduralWorldConfigOverrides = Partial<Omit<ProceduralWorldConfig, "biomeTiers">> & {
  biomeTiers?: BiomeTierConfig[];
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
