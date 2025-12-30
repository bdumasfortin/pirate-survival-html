import type { Vec2 } from "../core/types";

export type Island = {
  center: Vec2;
  points: Vec2[];
};

export type ResourceKind = "wood" | "rock" | "berries" | "raft" | "sword";
export type ResourceNodeType = "tree" | "rock" | "bush";

export type YieldRange = {
  min: number;
  max: number;
};

export type ResourceNode = {
  id: number;
  nodeType: ResourceNodeType;
  kind: ResourceKind;
  position: Vec2;
  rotation: number;
  radius: number;
  yield: YieldRange;
  remaining: number;
  respawnTime: number;
  respawnTimer: number;
};

export type WorldState = {
  islands: Island[];
  resources: ResourceNode[];
};

type IslandSpec = {
  center: Vec2;
  baseRadius: number;
  seed: number;
};

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
  const pointCount = 72;
  const points: Vec2[] = [];
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const ampA = baseRadius * 0.12;
  const ampB = baseRadius * 0.06;
  const jitter = baseRadius * 0.04;

  for (let i = 0; i < pointCount; i += 1) {
    const t = (i / pointCount) * Math.PI * 2;
    const wave = Math.sin(t * 3 + phaseA) * ampA + Math.sin(t * 5 + phaseB) * ampB;
    const noise = (rng() * 2 - 1) * jitter;
    const radius = Math.max(60, baseRadius + wave + noise);

    points.push({
      x: center.x + Math.cos(t) * radius,
      y: center.y + Math.sin(t) * radius
    });
  }

  return { center, points: smoothPoints(points, 2) };
};

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
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
  const islandRadius = getIslandRadius(island) * 0.78;
  let position: Vec2 = island.center;

  for (let attempt = 0; attempt < 40; attempt += 1) {
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

  const configs = [
    {
      nodeType: "tree" as const,
      kind: "wood" as const,
      radius: 20,
      count: 7,
      yield: { min: 3, max: 5 },
      respawnTime: 0
    },
    {
      nodeType: "rock" as const,
      kind: "rock" as const,
      radius: 8,
      count: 14,
      yield: { min: 1, max: 1 },
      respawnTime: 0
    },
    {
      nodeType: "bush" as const,
      kind: "berries" as const,
      radius: 14,
      count: 5,
      yield: { min: 2, max: 3 },
      respawnTime: 20
    }
  ];

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
  const specs: IslandSpec[] = [
    { center: { x: 0, y: 0 }, baseRadius: 420, seed: 11 },
    { center: { x: 820, y: -200 }, baseRadius: 300, seed: 21 },
    { center: { x: -760, y: 140 }, baseRadius: 310, seed: 31 },
    { center: { x: 120, y: 860 }, baseRadius: 280, seed: 41 },
    { center: { x: -520, y: -780 }, baseRadius: 290, seed: 51 }
  ];

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
