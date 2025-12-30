import type { Vec2 } from "../core/types";
import type { Island, ResourceNode, WorldState, YieldRange } from "./types";
import type { IslandSpec } from "./world-config";
import { ISLAND_SHAPE_CONFIG, RESOURCE_NODE_CONFIGS, RESOURCE_PLACEMENT_CONFIG, WORLD_GEN_CONFIG } from "./world-config";
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
  const { center, baseRadius, seed } = spec;
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

  return { center, points: smoothPoints(points, smoothingPasses) };
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

const createResourcesForIsland = (island: Island, seed: number, startId: number) => {
  const rng = createRng(seed);
  const resources: ResourceNode[] = [];
  let id = startId;

  const configs = RESOURCE_NODE_CONFIGS;

  for (const config of configs) {
    for (let i = 0; i < config.count; i += 1) {
      const position = getRandomPointInIsland(island, rng);
      const remaining = rollYield(rng, config.yield);

      resources.push({
        id,
        nodeType: config.nodeType,
        kind: config.kind,
        position,
        rotation: rng() * Math.PI * 2,
        radius: config.radius,
        yield: config.yield,
        remaining,
        respawnTime: config.respawnTime,
        respawnTimer: 0
      });
      id += 1;
    }
  }

  return { resources, nextId: id };
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
      seed: seed + 1
    }
  ];

  for (let i = 1; i < islandCount; i += 1) {
    const baseRadius = randomBetween(rng, radiusMin, radiusMax);
    const islandSeed = Math.floor(rng() * 1_000_000_000) + seed + i * 37;
    let placed = false;
    let ringOffset = 0;
    let attempts = 0;

    while (!placed) {
      const angle = rng() * Math.PI * 2;
      const ring = randomBetween(rng, ringMin, ringMax) + ringOffset;
      const candidate: IslandSpec = {
        center: {
          x: Math.cos(angle) * ring,
          y: Math.sin(angle) * ring
        },
        baseRadius,
        seed: islandSeed
      };

      if (isIslandSeparated(candidate, specs, edgePadding)) {
        specs.push(candidate);
        placed = true;
      } else {
        attempts += 1;
        if (attempts >= placementAttempts) {
          ringOffset += edgePadding;
          attempts = 0;
        }
      }
    }
  }

  return specs;
};

const createIslands = (specs: IslandSpec[]) => specs.map((spec) => createIsland(spec));

export const createWorld = (seed: string | number): WorldState => {
  const normalizedSeed = normalizeSeed(seed);
  const specs = createIslandSpecs(normalizedSeed);

  const islands = createIslands(specs);
  const resources: ResourceNode[] = [];
  let nextId = 1;

  for (let i = 0; i < islands.length; i += 1) {
    const result = createResourcesForIsland(islands[i], specs[i].seed + 100, nextId);
    resources.push(...result.resources);
    nextId = result.nextId;
  }

  return {
    islands,
    resources
  };
};

