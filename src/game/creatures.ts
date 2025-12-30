import type { Vec2 } from "../core/types";
import type { Island, WorldState } from "../world/types";
import { isPointInPolygon } from "../world/island-geometry";
import type { Enemy } from "./enemies";
import {
  BEACH_BOSS_CRAB_COUNT,
  CRAB_BOSS_RADIUS_SCALE,
  CRAB_BOSS_STATS,
  CRAB_DEFAULT_STATS,
  CRAB_SPAWN_ATTEMPTS,
  CRAB_SPAWN_BASE_RADIUS,
  CRAB_SPAWN_RING_MAX,
  CRAB_SPAWN_RING_MIN,
  CRAB_SPAWN_RADIUS_SCALE,
  FOREST_WOLF_COUNT,
  KRAKEN_SPAWN_ATTEMPTS,
  KRAKEN_SPAWN_COUNT,
  KRAKEN_SPAWN_MAX_DISTANCE,
  KRAKEN_SPAWN_MIN_DISTANCE,
  KRAKEN_STATS,
  STANDARD_CRAB_COUNT,
  WOLF_DEFAULT_STATS,
  WOLF_SPAWN_RADIUS_SCALE,
  type CrabStats
} from "./creatures-config";

type Hunter = Enemy & {
  velocity: Vec2;
  damage: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  wanderAngle: number;
  wanderTimer: number;
  homeIslandIndex: number;
};

export type Crab = Hunter;
export type Wolf = Hunter;
export type Kraken = Enemy & {
  velocity: Vec2;
  damage: number;
  speed: number;
  attackCooldown: number;
  attackTimer: number;
  wanderAngle: number;
  wanderTimer: number;
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const isPointInAnyIsland = (point: Vec2, islands: Island[]) => islands.some((island) => isPointInPolygon(point, island.points));

const randomPointInIsland = (island: Island, radiusScale: number) => {
  let position = island.center;
  for (let attempt = 0; attempt < CRAB_SPAWN_ATTEMPTS; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const ring = randomBetween(CRAB_SPAWN_RING_MIN, CRAB_SPAWN_RING_MAX);
    const radius = ring * radiusScale;
    position = {
      x: island.center.x + Math.cos(angle) * CRAB_SPAWN_BASE_RADIUS * radius,
      y: island.center.y + Math.sin(angle) * CRAB_SPAWN_BASE_RADIUS * radius
    };

    if (isPointInPolygon(position, island.points)) {
      return position;
    }
  }

  return position;
};

const randomPointInSea = (origin: Vec2, islands: Island[]) => {
  let position = origin;

  for (let attempt = 0; attempt < KRAKEN_SPAWN_ATTEMPTS; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = randomBetween(KRAKEN_SPAWN_MIN_DISTANCE, KRAKEN_SPAWN_MAX_DISTANCE);
    position = {
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * radius
    };

    if (!isPointInAnyIsland(position, islands)) {
      return position;
    }
  }

  return position;
};

const createCrab = (id: number, position: Vec2, homeIslandIndex: number, stats: CrabStats, isBoss = false): Crab => ({
  id,
  kind: "crab",
  isBoss,
  position,
  velocity: { x: 0, y: 0 },
  radius: stats.radius,
  health: stats.health,
  maxHealth: stats.maxHealth,
  damage: stats.damage,
  speed: stats.speed,
  aggroRange: stats.aggroRange,
  attackRange: stats.attackRange,
  attackCooldown: stats.attackCooldown,
  attackTimer: 0,
  wanderAngle: Math.random() * Math.PI * 2,
  wanderTimer: randomBetween(stats.wanderTimerMin, stats.wanderTimerMax),
  homeIslandIndex,
  hitTimer: 0
});

const createWolf = (id: number, position: Vec2, homeIslandIndex: number, stats: CrabStats): Wolf => ({
  id,
  kind: "wolf",
  position,
  velocity: { x: 0, y: 0 },
  radius: stats.radius,
  health: stats.health,
  maxHealth: stats.maxHealth,
  damage: stats.damage,
  speed: stats.speed,
  aggroRange: stats.aggroRange,
  attackRange: stats.attackRange,
  attackCooldown: stats.attackCooldown,
  attackTimer: 0,
  wanderAngle: Math.random() * Math.PI * 2,
  wanderTimer: randomBetween(stats.wanderTimerMin, stats.wanderTimerMax),
  homeIslandIndex,
  hitTimer: 0
});

const createKraken = (id: number, position: Vec2): Kraken => ({
  id,
  kind: "kraken",
  position,
  velocity: { x: 0, y: 0 },
  radius: KRAKEN_STATS.radius,
  health: KRAKEN_STATS.health,
  maxHealth: KRAKEN_STATS.maxHealth,
  damage: KRAKEN_STATS.damage,
  speed: KRAKEN_STATS.speed,
  attackCooldown: KRAKEN_STATS.attackCooldown,
  attackTimer: 0,
  wanderAngle: Math.random() * Math.PI * 2,
  wanderTimer: randomBetween(KRAKEN_STATS.wanderTimerMin, KRAKEN_STATS.wanderTimerMax),
  hitTimer: 0
});

export const createEnemies = (world: WorldState): Enemy[] => {
  if (world.islands.length === 0) {
    return [];
  }

  const enemies: Enemy[] = [];
  let nextId = 1;

  world.islands.forEach((island, index) => {
    if (island.type === "standard") {
      for (let i = 0; i < STANDARD_CRAB_COUNT; i += 1) {
        const position = randomPointInIsland(island, CRAB_SPAWN_RADIUS_SCALE);
        enemies.push(createCrab(nextId, position, index, CRAB_DEFAULT_STATS));
        nextId += 1;
      }
      return;
    }

    if (island.type === "forest") {
      for (let i = 0; i < FOREST_WOLF_COUNT; i += 1) {
        const position = randomPointInIsland(island, WOLF_SPAWN_RADIUS_SCALE);
        enemies.push(createWolf(nextId, position, index, WOLF_DEFAULT_STATS));
        nextId += 1;
      }
      return;
    }

    for (let i = 0; i < BEACH_BOSS_CRAB_COUNT; i += 1) {
      const position = randomPointInIsland(island, CRAB_BOSS_RADIUS_SCALE);
      enemies.push(createCrab(nextId, position, index, CRAB_BOSS_STATS, true));
      nextId += 1;
    }
  });

  const spawnAnchor = world.islands[0]?.center ?? { x: 0, y: 0 };
  for (let i = 0; i < KRAKEN_SPAWN_COUNT; i += 1) {
    const position = randomPointInSea(spawnAnchor, world.islands);
    enemies.push(createKraken(nextId, position));
    nextId += 1;
  }

  return enemies;
};
