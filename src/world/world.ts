import type { EcsWorld } from "../core/ecs";
import { ComponentMask, createEntity, EntityTag } from "../core/ecs";
import type { Vec2 } from "../core/types";
import { itemKindToIndex } from "../game/item-kinds";
import { isPointInIsland } from "./island-geometry";
import { resourceNodeTypeToIndex } from "./resource-node-types";
import type {
  BiomeTierConfig,
  Island,
  IslandType,
  ProceduralWorldConfig,
  WorldConfig,
  WorldState,
  YieldRange,
} from "./types";
import type { IslandSpec } from "./world-config";
import {
  getProceduralBaseRadius,
  getSpawnZoneRadius,
  RESOURCE_NODE_CONFIGS_BY_TYPE,
  RESOURCE_PLACEMENT_CONFIG,
} from "./world-config";

type Rng = () => number;

const createRng = (seed: number): Rng => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const randomBetween = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

const smoothPoints = (points: Vec2[], passes: number) => {
  let current = points;
  for (let pass = 0; pass < passes; pass += 1) {
    const next: Vec2[] = [];
    for (let i = 0; i < current.length; i += 1) {
      const prev = current[(i - 1 + current.length) % current.length];
      const curr = current[i];
      const nextPoint = current[(i + 1) % current.length];
      next.push({
        x: (prev.x + curr.x + nextPoint.x) / 3,
        y: (prev.y + curr.y + nextPoint.y) / 3,
      });
    }
    current = next;
  }
  return current;
};

const getShapeConfig = (config: ProceduralWorldConfig) => config.islandShapeConfig;

const createIsland = (spec: IslandSpec, config: ProceduralWorldConfig): Island => {
  const { center, baseRadius, seed, type } = spec;
  const rng = createRng(seed);
  const {
    pointCountMin,
    pointCountMax,
    waveAMin,
    waveAMax,
    waveBMin,
    waveBMax,
    ampAMin,
    ampAMax,
    ampBMin,
    ampBMax,
    jitterMin,
    jitterMax,
    minRadiusRatio,
    smoothingPassesMin,
    smoothingPassesMax,
    leanMin,
    leanMax,
  } = getShapeConfig(config);
  const pointCount = Math.round(randomBetween(rng, pointCountMin, pointCountMax));
  const waveA = Math.max(1, Math.round(randomBetween(rng, waveAMin, waveAMax)));
  let waveB = Math.max(2, Math.round(randomBetween(rng, waveBMin, waveBMax)));
  if (waveB === waveA) {
    waveB += 1;
  }
  const ampA = baseRadius * randomBetween(rng, ampAMin, ampAMax);
  const ampB = baseRadius * randomBetween(rng, ampBMin, ampBMax);
  const jitter = baseRadius * randomBetween(rng, jitterMin, jitterMax);
  const minRadius = baseRadius * minRadiusRatio;
  const smoothingPasses = Math.round(randomBetween(rng, smoothingPassesMin, smoothingPassesMax));
  const lean = randomBetween(rng, leanMin, leanMax);
  const axisAngle = rng() * Math.PI * 2;
  const axisCos = Math.cos(axisAngle);
  const axisSin = Math.sin(axisAngle);
  const points: Vec2[] = [];
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;

  for (let i = 0; i < pointCount; i += 1) {
    const t = (i / pointCount) * Math.PI * 2;
    const wave = Math.sin(t * waveA + phaseA) * ampA + Math.sin(t * waveB + phaseB) * ampB;
    const noise = (rng() * 2 - 1) * jitter;
    const radius = Math.max(minRadius, baseRadius + wave + noise);
    let x = Math.cos(t) * radius;
    let y = Math.sin(t) * radius;
    const rx = x * axisCos + y * axisSin;
    const ry = -x * axisSin + y * axisCos;
    const scaledX = rx * lean;
    const scaledY = ry / lean;
    x = scaledX * axisCos - scaledY * axisSin;
    y = scaledX * axisSin + scaledY * axisCos;

    points.push({
      x: center.x + x,
      y: center.y + y,
    });
  }

  return { center, points: smoothPoints(points, smoothingPasses), type, seed };
};

const getIslandRadius = (island: Island) => {
  const sum = island.points.reduce((acc, point) => {
    return acc + Math.hypot(point.x - island.center.x, point.y - island.center.y);
  }, 0);
  return sum / island.points.length;
};

const rollYield = (rng: Rng, range: YieldRange) => {
  if (range.max <= range.min) {
    return range.min;
  }
  return Math.floor(rng() * (range.max - range.min + 1)) + range.min;
};

const getRandomPointInIsland = (island: Island, rng: Rng, reject?: (position: Vec2) => boolean) => {
  const islandRadius = getIslandRadius(island) * RESOURCE_PLACEMENT_CONFIG.radiusScale;
  const position: Vec2 | null = null;

  for (let attempt = 0; attempt < RESOURCE_PLACEMENT_CONFIG.attempts; attempt += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng());
    const candidate = {
      x: island.center.x + Math.cos(angle) * islandRadius * radius,
      y: island.center.y + Math.sin(angle) * islandRadius * radius,
    };

    if (isPointInIsland(candidate, island) && (!reject || !reject(candidate))) {
      return candidate;
    }
  }

  return position;
};

const RESOURCE_MASK = ComponentMask.Position | ComponentMask.Radius | ComponentMask.Tag | ComponentMask.Resource;

const spawnResourcesForIsland = (
  ecs: EcsWorld,
  island: Island,
  seed: number,
  baseRadius: number,
  reject?: (position: Vec2) => boolean
) => {
  const rng = createRng(seed);

  const configs = RESOURCE_NODE_CONFIGS_BY_TYPE[island.type];
  const islandRadius = getIslandRadius(island);
  const areaScale = Math.pow(islandRadius / baseRadius, 2);
  const scaledCounts = configs.map((config) => Math.max(1, Math.round(config.count * areaScale)));
  const totalCount = scaledCounts.reduce((sum, count) => sum + count, 0);
  const islandArea = Math.PI * islandRadius * islandRadius;
  const meanSpacing = totalCount > 0 ? Math.sqrt(islandArea / totalCount) : 0;
  const placed: Vec2[] = [];

  const isFarEnough = (position: Vec2, minSpacing: number) => {
    const minDistSq = minSpacing * minSpacing;
    for (const other of placed) {
      const dx = position.x - other.x;
      const dy = position.y - other.y;
      if (dx * dx + dy * dy < minDistSq) {
        return false;
      }
    }
    return true;
  };

  for (let configIndex = 0; configIndex < configs.length; configIndex += 1) {
    const config = configs[configIndex];
    const count = scaledCounts[configIndex] ?? config.count;
    const minSpacing = Math.max(config.radius * 2.2, meanSpacing * 0.6);
    for (let i = 0; i < count; i += 1) {
      let position = getRandomPointInIsland(island, rng, reject);
      if (!position) {
        continue;
      }
      for (let attempt = 0; attempt < RESOURCE_PLACEMENT_CONFIG.attempts; attempt += 1) {
        if (isFarEnough(position, minSpacing)) {
          break;
        }
        position = getRandomPointInIsland(island, rng, reject);
        if (!position) {
          break;
        }
      }
      if (!position) {
        continue;
      }
      placed.push(position);
      const remaining = rollYield(rng, config.yield);
      const id = createEntity(ecs, RESOURCE_MASK, EntityTag.Resource);
      ecs.position.x[id] = position.x;
      ecs.position.y[id] = position.y;
      ecs.radius[id] = config.radius;
      ecs.resourceNodeType[id] = resourceNodeTypeToIndex(config.nodeType);
      ecs.resourceKind[id] = itemKindToIndex(config.kind);
      ecs.resourceRotation[id] = rng() * Math.PI * 2;
      ecs.resourceYieldMin[id] = config.yield.min;
      ecs.resourceYieldMax[id] = config.yield.max;
      ecs.resourceRemaining[id] = remaining;
      ecs.resourceRespawnTime[id] = config.respawnTime;
      ecs.resourceRespawnTimer[id] = 0;
    }
  }
};

const getMaxRadiusRatio = (config: ProceduralWorldConfig) => {
  const configs = [config.islandShapeConfig];
  let maxAmplitude = 0;
  let maxLean = 0;
  let minLean = Number.POSITIVE_INFINITY;

  for (const config of configs) {
    maxAmplitude = Math.max(maxAmplitude, config.ampAMax + config.ampBMax + config.jitterMax);
    maxLean = Math.max(maxLean, config.leanMax);
    minLean = Math.min(minLean, config.leanMin);
  }

  const stretchMax = Math.max(maxLean, 1 / Math.max(0.01, minLean));
  return (1 + maxAmplitude) * stretchMax;
};

const getSeparationScore = (candidate: IslandSpec, existing: IslandSpec[], padding: number, maxRadiusRatio: number) => {
  const candidateRadius = candidate.baseRadius * maxRadiusRatio;
  let minGap = Number.POSITIVE_INFINITY;

  for (const other of existing) {
    const otherRadius = other.baseRadius * maxRadiusRatio;
    const distance = Math.hypot(candidate.center.x - other.center.x, candidate.center.y - other.center.y);
    const gap = distance - (candidateRadius + otherRadius + padding);
    minGap = Math.min(minGap, gap);
  }

  return minGap === Number.POSITIVE_INFINITY ? 0 : minGap;
};

const pickIslandType = (rng: Rng, weights: Partial<Record<IslandType, number>>, fallback: IslandType): IslandType => {
  const entries = Object.entries(weights).filter(([, weight]) => (weight ?? 0) > 0) as [IslandType, number][];
  if (entries.length === 0) {
    return fallback;
  }
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const roll = rng() * total;
  let acc = 0;

  for (const [type, weight] of entries) {
    acc += weight;
    if (roll <= acc) {
      return type;
    }
  }

  return fallback;
};

const getTierCounts = (tier: BiomeTierConfig) => {
  const total = Math.max(0, Math.floor(tier.islandCount));
  const spawnCount = tier.id === "calm" ? 1 : 0;
  const bossCount = 1;
  const nonBossCount = Math.max(0, total - spawnCount - bossCount);
  return { total, spawnCount, bossCount, nonBossCount };
};

const createIslandSpecs = (seed: number, config: ProceduralWorldConfig): IslandSpec[] => {
  const rng = createRng(seed);
  const { spawnRadius, radiusMin, radiusMax, edgePadding, placementAttempts, arcMinAngle, arcMaxAngle, biomeTiers } =
    config;
  const maxRadiusRatio = getMaxRadiusRatio(config);
  const specs: IslandSpec[] = [
    {
      center: { x: 0, y: 0 },
      baseRadius: spawnRadius,
      seed: seed + 1,
      type: "beach",
    },
  ];

  const placeIsland = (baseRadius: number, islandSeed: number, type: IslandType, ringMin: number, ringMax: number) => {
    const paddingLevels = [edgePadding, edgePadding * 0.6, edgePadding * 0.3, 0];
    const sizeScales = [1, 0.85, 0.7];

    for (const sizeScale of sizeScales) {
      const scaledRadius = baseRadius * sizeScale;
      for (const padding of paddingLevels) {
        for (let attempt = 0; attempt < placementAttempts; attempt += 1) {
          const angle = randomBetween(rng, arcMinAngle, arcMaxAngle);
          const ring = randomBetween(rng, ringMin, ringMax);
          const candidate: IslandSpec = {
            center: {
              x: Math.cos(angle) * ring,
              y: Math.sin(angle) * ring,
            },
            baseRadius: scaledRadius,
            seed: islandSeed,
            type,
          };

          if (getSeparationScore(candidate, specs, padding, maxRadiusRatio) >= 0) {
            specs.push(candidate);
            return;
          }
        }
      }
    }
  };

  const sortedTiers = [...biomeTiers].sort((a, b) => a.ringMin - b.ringMin);

  for (let tierIndex = 0; tierIndex < sortedTiers.length; tierIndex += 1) {
    const tier = sortedTiers[tierIndex];
    const bossSeed = Math.floor(rng() * 1_000_000_000) + seed + 113 + tierIndex * 71;
    const bossRadius = randomBetween(rng, radiusMin, radiusMax);
    placeIsland(bossRadius, bossSeed, tier.bossType, tier.ringMin, tier.ringMax);
  }

  for (let tierIndex = 0; tierIndex < sortedTiers.length; tierIndex += 1) {
    const tier = sortedTiers[tierIndex];
    const counts = getTierCounts(tier);
    const fallbackType = (Object.keys(tier.weights)[0] as IslandType | undefined) ?? "beach";
    for (let i = 0; i < counts.nonBossCount; i += 1) {
      const islandSeed = Math.floor(rng() * 1_000_000_000) + seed + (tierIndex + 1) * 10_000 + i * 37;
      const type = pickIslandType(rng, tier.weights, fallbackType);
      const baseRadius = randomBetween(rng, radiusMin, radiusMax);
      placeIsland(baseRadius, islandSeed, type, tier.ringMin, tier.ringMax);
    }
  }

  return specs;
};

const createIslands = (specs: IslandSpec[], config: ProceduralWorldConfig) =>
  specs.map((spec) => createIsland(spec, config));

export const createProceduralWorld = (config: WorldConfig): WorldState => {
  const specs = createIslandSpecs(config.seed, config.procedural);
  const islands = createIslands(specs, config.procedural);

  return {
    config,
    islands,
  };
};

export const spawnProceduralResources = (ecs: EcsWorld, world: WorldState) => {
  const spawnIsland = world.islands[0];
  const spawnCenter = spawnIsland?.center ?? { x: 0, y: 0 };
  const baseRadius = getProceduralBaseRadius(world.config.procedural);
  const spawnZoneRadius = getSpawnZoneRadius(world.config.procedural);
  const spawnRadiusSq = spawnZoneRadius * spawnZoneRadius;
  const rejectSpawnZone = (position: Vec2) => {
    const dx = position.x - spawnCenter.x;
    const dy = position.y - spawnCenter.y;
    return dx * dx + dy * dy < spawnRadiusSq;
  };

  world.islands.forEach((island, index) => {
    const reject = index === 0 ? rejectSpawnZone : undefined;
    spawnResourcesForIsland(ecs, island, island.seed + 100, baseRadius, reject);
  });
};
