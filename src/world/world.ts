import type { EcsWorld } from "../core/ecs";
import { ComponentMask, createEntity, EntityTag } from "../core/ecs";
import type { Vec2 } from "../core/types";
import { itemKindToIndex } from "../game/item-kinds";
import { isPointInIsland } from "./island-geometry";
import { resourceNodeTypeToIndex } from "./resource-node-types";
import type { Island, IslandType, ProceduralWorldConfig, WorldConfig, WorldState, YieldRange } from "./types";
import type { IslandSpec } from "./world-config";
import {
  BASE_ISLAND_RADIUS,
  BEACH_ISLAND_RADIUS,
  BOSS_ISLAND_RADIUS,
  ISLAND_SHAPE_CONFIG,
  RESOURCE_NODE_CONFIGS_BY_TYPE,
  RESOURCE_PLACEMENT_CONFIG,
  SPAWN_ZONE_RADIUS,
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

const createIsland = (spec: IslandSpec): Island => {
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
  } = ISLAND_SHAPE_CONFIG;
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

const spawnResourcesForIsland = (ecs: EcsWorld, island: Island, seed: number, reject?: (position: Vec2) => boolean) => {
  const rng = createRng(seed);

  const configs = RESOURCE_NODE_CONFIGS_BY_TYPE[island.type];
  const islandRadius = getIslandRadius(island);
  const areaScale = Math.pow(islandRadius / BASE_ISLAND_RADIUS, 2);
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

const getMaxRadiusRatio = () => {
  const amplitudeMax = ISLAND_SHAPE_CONFIG.ampAMax + ISLAND_SHAPE_CONFIG.ampBMax + ISLAND_SHAPE_CONFIG.jitterMax;
  const stretchMax = Math.max(ISLAND_SHAPE_CONFIG.leanMax, 1 / ISLAND_SHAPE_CONFIG.leanMin);
  return (1 + amplitudeMax) * stretchMax;
};

const isIslandSeparated = (candidate: IslandSpec, existing: IslandSpec[], padding: number) => {
  const maxRadiusRatio = getMaxRadiusRatio();
  const candidateRadius = candidate.baseRadius * maxRadiusRatio;

  for (const other of existing) {
    const otherRadius = other.baseRadius * maxRadiusRatio;
    const distance = Math.hypot(candidate.center.x - other.center.x, candidate.center.y - other.center.y);

    if (distance < candidateRadius + otherRadius + padding) {
      return false;
    }
  }

  return true;
};

const pickIslandType = (rng: Rng, weights: Record<IslandType, number>): IslandType => {
  const entries = Object.entries(weights) as [IslandType, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const roll = rng() * total;
  let acc = 0;

  for (const [type, weight] of entries) {
    acc += weight;
    if (roll <= acc) {
      return type;
    }
  }

  return "standard";
};

const createIslandSpecs = (seed: number, config: ProceduralWorldConfig): IslandSpec[] => {
  const rng = createRng(seed);
  const { islandCount, spawnRadius, radiusMin, radiusMax, ringMin, ringMax, edgePadding, placementAttempts } = config;
  const specs: IslandSpec[] = [
    {
      center: { x: 0, y: 0 },
      baseRadius: spawnRadius,
      seed: seed + 1,
      type: "standard",
    },
  ];

  const placeIsland = (baseRadius: number, islandSeed: number, type: IslandType) => {
    let placed = false;
    let ringOffset = 0;
    let attempts = 0;
    let candidate: IslandSpec = {
      center: { x: 0, y: 0 },
      baseRadius,
      seed: islandSeed,
      type,
    };

    while (!placed) {
      const angle = rng() * Math.PI * 2;
      const ring = randomBetween(rng, ringMin, ringMax) + ringOffset;
      candidate = {
        center: {
          x: Math.cos(angle) * ring,
          y: Math.sin(angle) * ring,
        },
        baseRadius,
        seed: islandSeed,
        type,
      };

      if (isIslandSeparated(candidate, specs, edgePadding)) {
        placed = true;
      } else {
        attempts += 1;
        if (attempts >= placementAttempts) {
          ringOffset += edgePadding;
          attempts = 0;
        }
      }
    }

    specs.push(candidate);
  };

  if (islandCount > 1) {
    const bossRadius = BOSS_ISLAND_RADIUS;
    const bossSeed = Math.floor(rng() * 1_000_000_000) + seed + 113;
    placeIsland(bossRadius, bossSeed, "wolfBoss");
  }

  for (let i = specs.length; i < islandCount; i += 1) {
    const islandSeed = Math.floor(rng() * 1_000_000_000) + seed + i * 37;
    const type = pickIslandType(rng, config.islandTypeWeights);
    const baseRadius = type === "crabBoss" ? BEACH_ISLAND_RADIUS : randomBetween(rng, radiusMin, radiusMax);
    placeIsland(baseRadius, islandSeed, type);
  }

  return specs;
};

const createIslands = (specs: IslandSpec[]) => specs.map((spec) => createIsland(spec));

export const createProceduralWorld = (config: WorldConfig): WorldState => {
  const specs = createIslandSpecs(config.seed, config.procedural);
  const islands = createIslands(specs);

  return {
    config,
    islands,
  };
};

export const spawnProceduralResources = (ecs: EcsWorld, world: WorldState) => {
  const spawnIsland = world.islands[0];
  const spawnCenter = spawnIsland?.center ?? { x: 0, y: 0 };
  const spawnRadiusSq = SPAWN_ZONE_RADIUS * SPAWN_ZONE_RADIUS;
  const rejectSpawnZone = (position: Vec2) => {
    const dx = position.x - spawnCenter.x;
    const dy = position.y - spawnCenter.y;
    return dx * dx + dy * dy < spawnRadiusSq;
  };

  world.islands.forEach((island, index) => {
    const reject = index === 0 ? rejectSpawnZone : undefined;
    spawnResourcesForIsland(ecs, island, island.seed + 100, reject);
  });
};
