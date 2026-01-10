import type { EcsWorld } from "../core/ecs";
import { normalizeSeed } from "../core/seed";
import type {
  ProceduralWorldConfig,
  ProceduralWorldConfigOverrides,
  WorldConfig,
  WorldConfigInput,
  WorldPreset,
  WorldState,
} from "./types";
import { createProceduralWorld, spawnProceduralResources } from "./world";
import { ISLAND_TYPE_WEIGHTS, WORLD_GEN_CONFIG } from "./world-config";
import { createTestWorld, spawnTestResources } from "./world-test";

type WorldGenerator = {
  createWorld: (config: WorldConfig) => WorldState;
  spawnResources: (ecs: EcsWorld, world: WorldState) => void;
};

const DEFAULT_PROCEDURAL_CONFIG: ProceduralWorldConfig = {
  ...WORLD_GEN_CONFIG,
  islandTypeWeights: { ...ISLAND_TYPE_WEIGHTS },
};

const mergeProceduralConfig = (overrides?: ProceduralWorldConfigOverrides): ProceduralWorldConfig => {
  if (!overrides) {
    return {
      ...DEFAULT_PROCEDURAL_CONFIG,
      islandTypeWeights: { ...DEFAULT_PROCEDURAL_CONFIG.islandTypeWeights },
    };
  }

  return {
    ...DEFAULT_PROCEDURAL_CONFIG,
    ...overrides,
    islandTypeWeights: {
      ...DEFAULT_PROCEDURAL_CONFIG.islandTypeWeights,
      ...(overrides.islandTypeWeights ?? {}),
    },
  };
};

export const normalizeWorldConfig = (input: WorldConfigInput): WorldConfig => ({
  preset: input.preset ?? "procedural",
  seed: normalizeSeed(input.seed ?? 0),
  procedural: mergeProceduralConfig(input.procedural),
});

const proceduralGenerator: WorldGenerator = {
  createWorld: (config) => createProceduralWorld(config),
  spawnResources: (ecs, world) => spawnProceduralResources(ecs, world),
};

const testGenerator: WorldGenerator = {
  createWorld: (config) => createTestWorld(config),
  spawnResources: (ecs, world) => spawnTestResources(ecs, world),
};

const fallbackGenerator = proceduralGenerator;

const WORLD_GENERATORS: Record<WorldPreset, WorldGenerator> = {
  procedural: proceduralGenerator,
  test: testGenerator,
  creative: fallbackGenerator,
};

export const createWorld = (input: WorldConfigInput): WorldState => {
  const config = normalizeWorldConfig(input);
  const generator = WORLD_GENERATORS[config.preset];
  return generator.createWorld(config);
};

export const spawnWorldResources = (ecs: EcsWorld, world: WorldState) => {
  const generator = WORLD_GENERATORS[world.config.preset];
  generator.spawnResources(ecs, world);
};
