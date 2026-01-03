import type { Vec2 } from "../core/types";
import type { EcsWorld } from "../core/ecs";
import { nextFloat, nextRange, type RngState } from "../core/rng";
import { ComponentMask, createEntity, EntityTag } from "../core/ecs";
import { enemyKindToIndex } from "./enemy-kinds";
import type { Island, WorldState } from "../world/types";
import { isPointInIsland } from "../world/island-geometry";
import { BASE_ISLAND_RADIUS, SPAWN_ZONE_RADIUS } from "../world/world-config";
import {
  BEACH_BOSS_CRAB_COUNT,
  CRAB_BEACH_RING_MAX,
  CRAB_BEACH_RING_MIN,
  CRAB_BOSS_RADIUS_SCALE,
  CRAB_BOSS_STATS,
  CRAB_DEFAULT_STATS,
  CRAB_SPAWN_ATTEMPTS,
  CRAB_SPAWN_RADIUS_SCALE,
  FOREST_WOLF_COUNT,
  KRAKEN_SPAWN_ATTEMPTS,
  KRAKEN_SPAWN_COUNT,
  KRAKEN_SPAWN_MAX_DISTANCE,
  KRAKEN_SPAWN_MIN_DISTANCE,
  KRAKEN_STATS,
  STANDARD_CRAB_COUNT,
  WOLF_INLAND_RING_MAX,
  WOLF_INLAND_RING_MIN,
  WOLF_BOSS_COUNT,
  WOLF_BOSS_RADIUS_SCALE,
  WOLF_BOSS_STATS,
  WOLF_DEFAULT_STATS,
  WOLF_SPAWN_RADIUS_SCALE,
  type CreatureStats
} from "./creatures-config";

const isPointInAnyIsland = (point: Vec2, islands: Island[]) => islands.some((island) => isPointInIsland(point, island));

const getIslandRadius = (island: Island) => {
  if (island.points.length === 0) {
    return 0;
  }
  const sum = island.points.reduce((acc, point) => {
    return acc + Math.hypot(point.x - island.center.x, point.y - island.center.y);
  }, 0);
  return sum / island.points.length;
};

const getIslandAreaScale = (island: Island) => {
  const radius = getIslandRadius(island);
  if (radius <= 0) {
    return 1;
  }
  return Math.pow(radius / BASE_ISLAND_RADIUS, 2);
};

const scaleCreatureCount = (count: number, areaScale: number) => Math.max(1, Math.round(count * areaScale));

const randomPointInIsland = (
  rng: RngState,
  island: Island,
  radiusScale: number,
  ringMin: number,
  ringMax: number,
  reject?: (position: Vec2) => boolean
) => {
  let position: Vec2 | null = null;
  const islandRadius = getIslandRadius(island);
  for (let attempt = 0; attempt < CRAB_SPAWN_ATTEMPTS; attempt += 1) {
    const angle = nextFloat(rng) * Math.PI * 2;
    const ring = nextRange(rng, ringMin, ringMax);
    const radius = ring * islandRadius * radiusScale;
    const candidate = {
      x: island.center.x + Math.cos(angle) * radius,
      y: island.center.y + Math.sin(angle) * radius
    };

    if (isPointInIsland(candidate, island) && (!reject || !reject(candidate))) {
      return candidate;
    }
  }

  return position;
};

const isFarEnough = (position: Vec2, others: Vec2[], minSpacing: number) => {
  const minDistSq = minSpacing * minSpacing;
  for (const other of others) {
    const dx = position.x - other.x;
    const dy = position.y - other.y;
    if (dx * dx + dy * dy < minDistSq) {
      return false;
    }
  }
  return true;
};

const placeCreaturePosition = (
  rng: RngState,
  island: Island,
  radiusScale: number,
  ringMin: number,
  ringMax: number,
  positions: Vec2[],
  minSpacing: number,
  reject?: (position: Vec2) => boolean
) => {
  let position = randomPointInIsland(rng, island, radiusScale, ringMin, ringMax, reject);
  if (!position) {
    return null;
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (isFarEnough(position, positions, minSpacing)) {
      break;
    }
    position = randomPointInIsland(rng, island, radiusScale, ringMin, ringMax, reject);
    if (!position) {
      return null;
    }
  }
  positions.push(position);
  return position;
};

const randomPointInSea = (rng: RngState, origin: Vec2, islands: Island[], minDistance: number, maxDistance: number) => {
  let position = origin;

  for (let attempt = 0; attempt < KRAKEN_SPAWN_ATTEMPTS; attempt += 1) {
    const angle = nextFloat(rng) * Math.PI * 2;
    const radius = nextRange(rng, minDistance, maxDistance);
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
    const areaScale = getIslandAreaScale(island);
    const islandRadius = getIslandRadius(island);
    const islandArea = Math.PI * islandRadius * islandRadius;
    const positions: Vec2[] = [];
    if (island.type === "standard") {
      const count = scaleCreatureCount(STANDARD_CRAB_COUNT, areaScale);
      const meanSpacing = count > 0 ? Math.sqrt(islandArea / count) : 0;
      const minSpacing = Math.max(CRAB_DEFAULT_STATS.radius * 4, meanSpacing * 0.6);
      for (let i = 0; i < count; i += 1) {
        const position = placeCreaturePosition(
          rng,
          island,
          CRAB_SPAWN_RADIUS_SCALE,
          CRAB_BEACH_RING_MIN,
          CRAB_BEACH_RING_MAX,
          positions,
          minSpacing,
          reject
        );
        if (!position) {
          continue;
        }
        spawnCrab(ecs, rng, position, index, CRAB_DEFAULT_STATS);
      }
      return;
    }

    if (island.type === "forest") {
      const count = scaleCreatureCount(FOREST_WOLF_COUNT, areaScale);
      const meanSpacing = count > 0 ? Math.sqrt(islandArea / count) : 0;
      const minSpacing = Math.max(WOLF_DEFAULT_STATS.radius * 4, meanSpacing * 0.6);
      for (let i = 0; i < count; i += 1) {
        const position = placeCreaturePosition(
          rng,
          island,
          WOLF_SPAWN_RADIUS_SCALE,
          WOLF_INLAND_RING_MIN,
          WOLF_INLAND_RING_MAX,
          positions,
          minSpacing,
          reject
        );
        if (!position) {
          continue;
        }
        spawnWolf(ecs, rng, position, index, WOLF_DEFAULT_STATS);
      }

      const crabCount = scaleCreatureCount(STANDARD_CRAB_COUNT, areaScale);
      const crabMeanSpacing = crabCount > 0 ? Math.sqrt(islandArea / crabCount) : 0;
      const crabMinSpacing = Math.max(CRAB_DEFAULT_STATS.radius * 4, crabMeanSpacing * 0.6);
      for (let i = 0; i < crabCount; i += 1) {
        const position = placeCreaturePosition(
          rng,
          island,
          CRAB_SPAWN_RADIUS_SCALE,
          CRAB_BEACH_RING_MIN,
          CRAB_BEACH_RING_MAX,
          positions,
          crabMinSpacing,
          reject
        );
        if (!position) {
          continue;
        }
        spawnCrab(ecs, rng, position, index, CRAB_DEFAULT_STATS);
      }
      return;
    }

    if (island.type === "wolfBoss") {
      const count = scaleCreatureCount(WOLF_BOSS_COUNT, areaScale);
      const meanSpacing = count > 0 ? Math.sqrt(islandArea / count) : 0;
      const minSpacing = Math.max(WOLF_BOSS_STATS.radius * 3, meanSpacing * 0.6);
      for (let i = 0; i < count; i += 1) {
        const position = placeCreaturePosition(
          rng,
          island,
          WOLF_BOSS_RADIUS_SCALE,
          WOLF_INLAND_RING_MIN,
          WOLF_INLAND_RING_MAX,
          positions,
          minSpacing,
          reject
        );
        if (!position) {
          continue;
        }
        spawnWolf(ecs, rng, position, index, WOLF_BOSS_STATS, true);
      }
      return;
    }

    const count = BEACH_BOSS_CRAB_COUNT;
    const meanSpacing = count > 0 ? Math.sqrt(islandArea / count) : 0;
    const minSpacing = Math.max(CRAB_BOSS_STATS.radius * 3, meanSpacing * 0.6);
    for (let i = 0; i < count; i += 1) {
      const position = placeCreaturePosition(
        rng,
        island,
        CRAB_BOSS_RADIUS_SCALE,
        CRAB_BEACH_RING_MIN,
        CRAB_BEACH_RING_MAX,
        positions,
        minSpacing,
        reject
      );
      if (!position) {
        continue;
      }
      spawnCrab(ecs, rng, position, index, CRAB_BOSS_STATS, true);
    }
  });

  const spawnAnchor = spawnIsland?.center ?? { x: 0, y: 0 };
  const spawnRadius = spawnIsland ? getIslandRadius(spawnIsland) : BASE_ISLAND_RADIUS;
  const distanceScale = spawnRadius / BASE_ISLAND_RADIUS;
  const minDistance = KRAKEN_SPAWN_MIN_DISTANCE * distanceScale;
  const maxDistance = KRAKEN_SPAWN_MAX_DISTANCE * distanceScale;
  for (let i = 0; i < KRAKEN_SPAWN_COUNT; i += 1) {
    const position = randomPointInSea(rng, spawnAnchor, world.islands, minDistance, maxDistance);
    spawnKraken(ecs, rng, position);
  }
};
