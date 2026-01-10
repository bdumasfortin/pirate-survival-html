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

export type ResourcePlacementConfig = {
  radiusScale: number;
  attempts: number;
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
  islandShapeConfig: IslandShapeConfig;
  resourcePlacement: ResourcePlacementConfig;
  biomeTiers: BiomeTierConfig[];
};

export type ProceduralWorldConfigOverrides = Partial<
  Omit<ProceduralWorldConfig, "biomeTiers" | "islandShapeConfig" | "resourcePlacement">
> & {
  biomeTiers?: BiomeTierConfig[];
  islandShapeConfig?: Partial<IslandShapeConfig>;
  resourcePlacement?: Partial<ResourcePlacementConfig>;
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
