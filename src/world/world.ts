import type { Vec2 } from "../core/types";
import type { EcsWorld } from "../core/ecs";
import { ComponentMask, createEntity, EntityTag } from "../core/ecs";
import { resourceKindToIndex, resourceNodeTypeToIndex } from "./resource-kinds";
import type { Island, IslandType, WorldState, YieldRange } from "./types";
import type { IslandSpec } from "./world-config";
import {
  ISLAND_SHAPE_CONFIG,
  ISLAND_TYPE_WEIGHTS,
  RESOURCE_NODE_CONFIGS_BY_TYPE,
  RESOURCE_PLACEMENT_CONFIG,
  WORLD_GEN_CONFIG
} from "./world-config";
import { isPointInPolygon } from "./island-geometry";

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

const normalizeSeed = (seed: string | number) => {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  const value = String(seed).trim();
  if (value.length === 0) {
    return 0;
  }

  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10) >>> 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
        y: (prev.y + curr.y + nextPoint.y) / 3
      });
    }
    current = next;
  }
  return current;
};

const createIsland = (spec: IslandSpec): Island => {
  const { center, baseRadius, seed, type } = spec;
  const rng = createRng(seed);
  const { pointCount, waveA, waveB, ampA: ampRatioA, ampB: ampRatioB, jitter: jitterRatio, minRadius, smoothingPasses } =
    ISLAND_SHAPE_CONFIG;
  const points: Vec2[] = [];
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const ampA = baseRadius * ampRatioA;
  const ampB = baseRadius * ampRatioB;
  const jitter = baseRadius * jitterRatio;

  for (let i = 0; i < pointCount; i += 1) {
    const t = (i / pointCount) * Math.PI * 2;
    const wave = Math.sin(t * waveA + phaseA) * ampA + Math.sin(t * waveB + phaseB) * ampB;
    const noise = (rng() * 2 - 1) * jitter;
    const radius = Math.max(minRadius, baseRadius + wave + noise);

    points.push({
      x: center.x + Math.cos(t) * radius,
      y: center.y + Math.sin(t) * radius
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

const getRandomPointInIsland = (island: Island, rng: Rng) => {
  const islandRadius = getIslandRadius(island) * RESOURCE_PLACEMENT_CONFIG.radiusScale;
  let position: Vec2 = island.center;

  for (let attempt = 0; attempt < RESOURCE_PLACEMENT_CONFIG.attempts; attempt += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.sqrt(rng());
    position = {
      x: island.center.x + Math.cos(angle) * islandRadius * radius,
      y: island.center.y + Math.sin(angle) * islandRadius * radius
    };

    if (isPointInPolygon(position, island.points)) {
      return position;
    }
  }

  return position;
};

const RESOURCE_MASK = ComponentMask.Position | ComponentMask.Radius | ComponentMask.Tag | ComponentMask.Resource;

const spawnResourcesForIsland = (ecs: EcsWorld, island: Island, seed: number) => {
  const rng = createRng(seed);

  const configs = RESOURCE_NODE_CONFIGS_BY_TYPE[island.type];

  for (const config of configs) {
    for (let i = 0; i < config.count; i += 1) {
      const position = getRandomPointInIsland(island, rng);
      const remaining = rollYield(rng, config.yield);
      const id = createEntity(ecs, RESOURCE_MASK, EntityTag.Resource);
      ecs.position.x[id] = position.x;
      ecs.position.y[id] = position.y;
      ecs.radius[id] = config.radius;
      ecs.resourceNodeType[id] = resourceNodeTypeToIndex(config.nodeType);
      ecs.resourceKind[id] = resourceKindToIndex(config.kind);
      ecs.resourceRotation[id] = rng() * Math.PI * 2;
      ecs.resourceYieldMin[id] = config.yield.min;
      ecs.resourceYieldMax[id] = config.yield.max;
      ecs.resourceRemaining[id] = remaining;
      ecs.resourceRespawnTime[id] = config.respawnTime;
      ecs.resourceRespawnTimer[id] = 0;
    }
  }
};

const getMaxRadiusRatio = () => 1 + ISLAND_SHAPE_CONFIG.ampA + ISLAND_SHAPE_CONFIG.ampB + ISLAND_SHAPE_CONFIG.jitter;

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

const pickIslandType = (rng: Rng): IslandType => {
  const entries = Object.entries(ISLAND_TYPE_WEIGHTS) as [IslandType, number][];
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

const createIslandSpecs = (seed: number): IslandSpec[] => {
  const rng = createRng(seed);
  const {
    islandCount,
    spawnRadius,
    radiusMin,
    radiusMax,
    ringMin,
    ringMax,
    edgePadding,
    placementAttempts
  } = WORLD_GEN_CONFIG;
  const specs: IslandSpec[] = [
    {
      center: { x: 0, y: 0 },
      baseRadius: spawnRadius,
      seed: seed + 1,
      type: "standard"
    }
  ];

  const placeIsland = (baseRadius: number, islandSeed: number, type: IslandType) => {
    let placed = false;
    let ringOffset = 0;
    let attempts = 0;
    let candidate: IslandSpec = {
      center: { x: 0, y: 0 },
      baseRadius,
      seed: islandSeed,
      type
    };

    while (!placed) {
      const angle = rng() * Math.PI * 2;
      const ring = randomBetween(rng, ringMin, ringMax) + ringOffset;
      candidate = {
        center: {
          x: Math.cos(angle) * ring,
          y: Math.sin(angle) * ring
        },
        baseRadius,
        seed: islandSeed,
        type
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
    const bossRadius = randomBetween(rng, radiusMin, radiusMax);
    const bossSeed = Math.floor(rng() * 1_000_000_000) + seed + 113;
    placeIsland(bossRadius, bossSeed, "wolfBoss");
  }

  for (let i = specs.length; i < islandCount; i += 1) {
    const baseRadius = randomBetween(rng, radiusMin, radiusMax);
    const islandSeed = Math.floor(rng() * 1_000_000_000) + seed + i * 37;
    const type = pickIslandType(rng);
    placeIsland(baseRadius, islandSeed, type);
  }

  return specs;
};

const createIslands = (specs: IslandSpec[]) => specs.map((spec) => createIsland(spec));

export const createWorld = (seed: string | number): WorldState => {
  const normalizedSeed = normalizeSeed(seed);
  const specs = createIslandSpecs(normalizedSeed);

  const islands = createIslands(specs);

  return {
    islands
  };
};

export const spawnWorldResources = (ecs: EcsWorld, world: WorldState) => {
  world.islands.forEach((island) => {
    spawnResourcesForIsland(ecs, island, island.seed + 100);
  });
};
