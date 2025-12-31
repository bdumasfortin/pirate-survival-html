import type { Vec2 } from "../core/types";
import type { EcsWorld } from "../core/ecs";
import { nextFloat, nextRange, type RngState } from "../core/rng";
import { ComponentMask, createEntity, EntityTag } from "../core/ecs";
import { enemyKindToIndex } from "./enemy-kinds";
import type { Island, WorldState } from "../world/types";
import { isPointInPolygon } from "../world/island-geometry";
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
  WOLF_BOSS_COUNT,
  WOLF_BOSS_RADIUS_SCALE,
  WOLF_BOSS_STATS,
  WOLF_DEFAULT_STATS,
  WOLF_SPAWN_RADIUS_SCALE,
  type CreatureStats
} from "./creatures-config";

const isPointInAnyIsland = (point: Vec2, islands: Island[]) => islands.some((island) => isPointInPolygon(point, island.points));

const randomPointInIsland = (rng: RngState, island: Island, radiusScale: number) => {
  let position = island.center;
  for (let attempt = 0; attempt < CRAB_SPAWN_ATTEMPTS; attempt += 1) {
    const angle = nextFloat(rng) * Math.PI * 2;
    const ring = nextRange(rng, CRAB_SPAWN_RING_MIN, CRAB_SPAWN_RING_MAX);
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

const randomPointInSea = (rng: RngState, origin: Vec2, islands: Island[]) => {
  let position = origin;

  for (let attempt = 0; attempt < KRAKEN_SPAWN_ATTEMPTS; attempt += 1) {
    const angle = nextFloat(rng) * Math.PI * 2;
    const radius = nextRange(rng, KRAKEN_SPAWN_MIN_DISTANCE, KRAKEN_SPAWN_MAX_DISTANCE);
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

const ENEMY_MASK = ComponentMask.Position |
  ComponentMask.Velocity |
  ComponentMask.Radius |
  ComponentMask.Tag |
  ComponentMask.Enemy;

const spawnCrab = (ecs: EcsWorld, rng: RngState, position: Vec2, homeIslandIndex: number, stats: CreatureStats, isBoss = false) => {
  const id = createEntity(ecs, ENEMY_MASK, EntityTag.Enemy);
  ecs.position.x[id] = position.x;
  ecs.position.y[id] = position.y;
  ecs.velocity.x[id] = 0;
  ecs.velocity.y[id] = 0;
  ecs.radius[id] = stats.radius;
  ecs.enemyKind[id] = enemyKindToIndex("crab");
  ecs.enemyIsBoss[id] = isBoss ? 1 : 0;
  ecs.enemyHealth[id] = stats.health;
  ecs.enemyMaxHealth[id] = stats.maxHealth;
  ecs.enemyDamage[id] = stats.damage;
  ecs.enemySpeed[id] = stats.speed;
  ecs.enemyAggroRange[id] = stats.aggroRange;
  ecs.enemyAttackRange[id] = stats.attackRange;
  ecs.enemyAttackCooldown[id] = stats.attackCooldown;
  ecs.enemyAttackTimer[id] = 0;
  ecs.enemyWanderAngle[id] = nextFloat(rng) * Math.PI * 2;
  ecs.enemyWanderTimer[id] = nextRange(rng, stats.wanderTimerMin, stats.wanderTimerMax);
  ecs.enemyHomeIsland[id] = homeIslandIndex;
  ecs.enemyHitTimer[id] = 0;
};

const spawnWolf = (ecs: EcsWorld, rng: RngState, position: Vec2, homeIslandIndex: number, stats: CreatureStats, isBoss = false) => {
  const id = createEntity(ecs, ENEMY_MASK, EntityTag.Enemy);
  ecs.position.x[id] = position.x;
  ecs.position.y[id] = position.y;
  ecs.velocity.x[id] = 0;
  ecs.velocity.y[id] = 0;
  ecs.radius[id] = stats.radius;
  ecs.enemyKind[id] = enemyKindToIndex("wolf");
  ecs.enemyIsBoss[id] = isBoss ? 1 : 0;
  ecs.enemyHealth[id] = stats.health;
  ecs.enemyMaxHealth[id] = stats.maxHealth;
  ecs.enemyDamage[id] = stats.damage;
  ecs.enemySpeed[id] = stats.speed;
  ecs.enemyAggroRange[id] = stats.aggroRange;
  ecs.enemyAttackRange[id] = stats.attackRange;
  ecs.enemyAttackCooldown[id] = stats.attackCooldown;
  ecs.enemyAttackTimer[id] = 0;
  ecs.enemyWanderAngle[id] = nextFloat(rng) * Math.PI * 2;
  ecs.enemyWanderTimer[id] = nextRange(rng, stats.wanderTimerMin, stats.wanderTimerMax);
  ecs.enemyHomeIsland[id] = homeIslandIndex;
  ecs.enemyHitTimer[id] = 0;
};

const spawnKraken = (ecs: EcsWorld, rng: RngState, position: Vec2) => {
  const id = createEntity(ecs, ENEMY_MASK, EntityTag.Enemy);
  ecs.position.x[id] = position.x;
  ecs.position.y[id] = position.y;
  ecs.velocity.x[id] = 0;
  ecs.velocity.y[id] = 0;
  ecs.radius[id] = KRAKEN_STATS.radius;
  ecs.enemyKind[id] = enemyKindToIndex("kraken");
  ecs.enemyIsBoss[id] = 0;
  ecs.enemyHealth[id] = KRAKEN_STATS.health;
  ecs.enemyMaxHealth[id] = KRAKEN_STATS.maxHealth;
  ecs.enemyDamage[id] = KRAKEN_STATS.damage;
  ecs.enemySpeed[id] = KRAKEN_STATS.speed;
  ecs.enemyAggroRange[id] = 0;
  ecs.enemyAttackRange[id] = 0;
  ecs.enemyAttackCooldown[id] = KRAKEN_STATS.attackCooldown;
  ecs.enemyAttackTimer[id] = 0;
  ecs.enemyWanderAngle[id] = nextFloat(rng) * Math.PI * 2;
  ecs.enemyWanderTimer[id] = nextRange(rng, KRAKEN_STATS.wanderTimerMin, KRAKEN_STATS.wanderTimerMax);
  ecs.enemyHomeIsland[id] = -1;
  ecs.enemyHitTimer[id] = 0;
};

export const createEnemies = (ecs: EcsWorld, world: WorldState, rng: RngState) => {
  if (world.islands.length === 0) {
    return;
  }

  world.islands.forEach((island, index) => {
    if (island.type === "standard") {
      for (let i = 0; i < STANDARD_CRAB_COUNT; i += 1) {
        const position = randomPointInIsland(rng, island, CRAB_SPAWN_RADIUS_SCALE);
        spawnCrab(ecs, rng, position, index, CRAB_DEFAULT_STATS);
      }
      return;
    }

    if (island.type === "forest") {
      for (let i = 0; i < FOREST_WOLF_COUNT; i += 1) {
        const position = randomPointInIsland(rng, island, WOLF_SPAWN_RADIUS_SCALE);
        spawnWolf(ecs, rng, position, index, WOLF_DEFAULT_STATS);
      }
      return;
    }

    if (island.type === "wolfBoss") {
      for (let i = 0; i < WOLF_BOSS_COUNT; i += 1) {
        const position = randomPointInIsland(rng, island, WOLF_BOSS_RADIUS_SCALE);
        spawnWolf(ecs, rng, position, index, WOLF_BOSS_STATS, true);
      }
      return;
    }

    for (let i = 0; i < BEACH_BOSS_CRAB_COUNT; i += 1) {
      const position = randomPointInIsland(rng, island, CRAB_BOSS_RADIUS_SCALE);
      spawnCrab(ecs, rng, position, index, CRAB_BOSS_STATS, true);
    }
  });

  const spawnAnchor = world.islands[0]?.center ?? { x: 0, y: 0 };
  for (let i = 0; i < KRAKEN_SPAWN_COUNT; i += 1) {
    const position = randomPointInSea(rng, spawnAnchor, world.islands);
    spawnKraken(ecs, rng, position);
  }
};
