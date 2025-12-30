import type { Vec2 } from "../core/types";
import type { Island, ResourceNode, WorldState, YieldRange } from "./types";
import type { IslandSpec } from "./world-config";
import { ISLAND_SHAPE_CONFIG, RESOURCE_NODE_CONFIGS, RESOURCE_PLACEMENT_CONFIG, WORLD_ISLAND_SPECS } from "./world-config";
import { isPointInPolygon } from "./island-geometry";

const createRng = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

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

const rollYield = (rng: () => number, range: YieldRange) => {
  if (range.max <= range.min) {
    return range.min;
  }
  return Math.floor(rng() * (range.max - range.min + 1)) + range.min;
};

const getRandomPointInIsland = (island: Island, rng: () => number) => {
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

const createIslands = (specs: IslandSpec[]) => specs.map((spec) => createIsland(spec));

export const createWorld = (): WorldState => {
  const specs: IslandSpec[] = WORLD_ISLAND_SPECS;

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
