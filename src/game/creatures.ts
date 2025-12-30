import type { Vec2 } from "../core/types";
import type { Island, WorldState } from "../world/types";
import { isPointInPolygon } from "../world/island-geometry";
import type { Enemy } from "./enemies";
import {
  CRAB_BOSS_RADIUS_SCALE,
  CRAB_BOSS_STATS,
  CRAB_DEFAULT_STATS,
  CRAB_SPAWN_ATTEMPTS,
  CRAB_SPAWN_BASE_RADIUS,
  CRAB_SPAWN_COUNT,
  CRAB_SPAWN_RADIUS_SCALE,
  CRAB_SPAWN_RING_MAX,
  CRAB_SPAWN_RING_MIN,
  type CrabStats
} from "./creatures-config";

export type Crab = Enemy & {
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

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const getLeftmostIslandIndex = (islands: Island[]) => islands.reduce((leftmostIndex, island, index) => {
  return island.center.x < islands[leftmostIndex].center.x ? index : leftmostIndex;
}, 0);

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

export const createCrabs = (world: WorldState): Crab[] => {
  if (world.islands.length === 0) {
    return [];
  }

  const spawnIslandIndex = 0;
  const spawnIsland = world.islands[spawnIslandIndex];
  const crabs: Crab[] = [];

  for (let i = 0; i < CRAB_SPAWN_COUNT; i += 1) {
    const position = randomPointInIsland(spawnIsland, CRAB_SPAWN_RADIUS_SCALE);
    crabs.push(createCrab(i + 1, position, spawnIslandIndex, CRAB_DEFAULT_STATS));
  }

  const bossIslandIndex = getLeftmostIslandIndex(world.islands);
  const bossIsland = world.islands[bossIslandIndex];
  const bossPosition = randomPointInIsland(bossIsland, CRAB_BOSS_RADIUS_SCALE);
  crabs.push(createCrab(CRAB_SPAWN_COUNT + 1, bossPosition, bossIslandIndex, CRAB_BOSS_STATS, true));

  return crabs;
};
