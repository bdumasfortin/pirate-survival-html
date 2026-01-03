import type { GameState } from "../game/state";
import { clamp, normalize } from "../core/math";
import { nextFloat, nextRange } from "../core/rng";
import { ComponentMask, destroyEntity, forEachEntity, isEntityAlive, type EntityId } from "../core/ecs";
import { ENEMY_KIND_TO_INDEX } from "../game/enemy-kinds";
import { closestPointOnPolygon, findContainingIsland, isPointInIsland } from "../world/island-geometry";
import { CRAB_HIT_FLASH_DURATION, DAMAGE_FLASH_DURATION } from "../game/combat-config";
import { KRAKEN_STATS } from "../game/creatures-config";
import { getEquippedItemCount } from "../game/equipment";
import { ARMOR_PER_PIECE, ARMOR_REGEN_DELAY } from "../game/survival-config";
import { dropEnemyLoot } from "../game/enemy-loot";

const WANDER_SPEED_SCALE = 0.4;
const CHASE_ACCEL_FACTOR = 6;
const CHASE_STOP_BUFFER = 6;
const ENEMY_MASK = ComponentMask.Enemy | ComponentMask.Position | ComponentMask.Velocity | ComponentMask.Radius;

type LivingPlayer = {
  playerId: EntityId;
  index: number;
  x: number;
  y: number;
  radius: number;
};

const buildLivingPlayers = (state: GameState) => {
  const ecs = state.ecs;
  const livingPlayers: LivingPlayer[] = [];
  for (let index = 0; index < state.playerIds.length; index += 1) {
    const playerId = state.playerIds[index];
    if (!isEntityAlive(ecs, playerId) || ecs.playerIsDead[playerId]) {
      continue;
    }
    livingPlayers.push({
      playerId,
      index,
      x: ecs.position.x[playerId],
      y: ecs.position.y[playerId],
      radius: ecs.radius[playerId]
    });
  }
  return livingPlayers;
};

const findClosestPlayer = (players: LivingPlayer[], x: number, y: number) => {
  let closest: LivingPlayer | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const player of players) {
    const dx = player.x - x;
    const dy = player.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = player;
    }
  }
  return closest;
};

const applyKrakenLandCorrection = (state: GameState, id: EntityId) => {
  const ecs = state.ecs;
  const containingIsland = findContainingIsland(
    { x: ecs.position.x[id], y: ecs.position.y[id] },
    state.world.islands
  );
  if (!containingIsland) {
    return;
  }

  const closest = closestPointOnPolygon(
    { x: ecs.position.x[id], y: ecs.position.y[id] },
    containingIsland.points
  );
  const dir = normalize(
    closest.point.x - containingIsland.center.x,
    closest.point.y - containingIsland.center.y
  );
  const offset = ecs.radius[id] + 2;
  ecs.position.x[id] = closest.point.x + dir.x * offset;
  ecs.position.y[id] = closest.point.y + dir.y * offset;
  ecs.enemyWanderAngle[id] = Math.atan2(dir.y, dir.x);
  ecs.enemyWanderTimer[id] = nextRange(state.rng, KRAKEN_STATS.wanderTimerMin, KRAKEN_STATS.wanderTimerMax);
};

const applyMonsterDamage = (state: GameState, playerIndex: number, playerId: EntityId, damage: number) => {
  const ecs = state.ecs;
  const maxArmor = getEquippedItemCount(ecs, playerId) * ARMOR_PER_PIECE;
  ecs.playerMaxArmor[playerId] = maxArmor;
  ecs.playerArmor[playerId] = clamp(ecs.playerArmor[playerId], 0, ecs.playerMaxArmor[playerId]);

  let remaining = damage;

  if (ecs.playerArmor[playerId] > 0) {
    const absorbed = Math.min(ecs.playerArmor[playerId], remaining);
    ecs.playerArmor[playerId] = clamp(ecs.playerArmor[playerId] - absorbed, 0, ecs.playerMaxArmor[playerId]);
    remaining -= absorbed;
  }

  if (remaining > 0) {
    ecs.playerHealth[playerId] = clamp(ecs.playerHealth[playerId] - remaining, 0, ecs.playerMaxHealth[playerId]);
  }

  ecs.playerArmorRegenTimer[playerId] = ARMOR_REGEN_DELAY;
  ecs.playerDamageFlashTimer[playerId] = DAMAGE_FLASH_DURATION;

  if (ecs.playerHealth[playerId] <= 0) {
    ecs.playerHealth[playerId] = 0;
    ecs.playerIsDead[playerId] = 1;
    ecs.playerDamageFlashTimer[playerId] = 0;
    if (state.attackEffects[playerIndex]) {
      state.attackEffects[playerIndex] = null;
    }
  }
};

export const applyEnemyDamage = (state: GameState, enemyId: EntityId, damage: number) => {
  const ecs = state.ecs;
  ecs.enemyHealth[enemyId] -= damage;
  ecs.enemyHitTimer[enemyId] = CRAB_HIT_FLASH_DURATION;

  if (ecs.enemyHealth[enemyId] > 0) {
    return false;
  }

  ecs.enemyHealth[enemyId] = 0;
  dropEnemyLoot(state, enemyId);
  destroyEntity(ecs, enemyId);
  return true;
};

const updateKraken = (state: GameState, id: EntityId, target: LivingPlayer | null, delta: number) => {
  const ecs = state.ecs;
  const rng = state.rng;
  ecs.enemyAttackTimer[id] = Math.max(0, ecs.enemyAttackTimer[id] - delta);
  ecs.enemyWanderTimer[id] -= delta;

  if (ecs.enemyWanderTimer[id] <= 0) {
    ecs.enemyWanderAngle[id] = nextFloat(rng) * Math.PI * 2;
    ecs.enemyWanderTimer[id] = nextRange(rng, KRAKEN_STATS.wanderTimerMin, KRAKEN_STATS.wanderTimerMax);
  }

  ecs.velocity.x[id] = Math.cos(ecs.enemyWanderAngle[id]) * ecs.enemySpeed[id] * WANDER_SPEED_SCALE;
  ecs.velocity.y[id] = Math.sin(ecs.enemyWanderAngle[id]) * ecs.enemySpeed[id] * WANDER_SPEED_SCALE;
  ecs.position.x[id] += ecs.velocity.x[id] * delta;
  ecs.position.y[id] += ecs.velocity.y[id] * delta;

  applyKrakenLandCorrection(state, id);

  if (target) {
    const dx = target.x - ecs.position.x[id];
    const dy = target.y - ecs.position.y[id];
    const distance = Math.hypot(dx, dy);
    const hitRange = ecs.radius[id] + target.radius;

    if (distance <= hitRange && ecs.enemyAttackTimer[id] <= 0) {
      applyMonsterDamage(state, target.index, target.playerId, ecs.enemyDamage[id]);
      ecs.enemyAttackTimer[id] = ecs.enemyAttackCooldown[id];
    }
  }
};

const updateLandEnemy = (state: GameState, id: EntityId, target: LivingPlayer | null, delta: number) => {
  const ecs = state.ecs;
  const rng = state.rng;
  ecs.enemyAttackTimer[id] = Math.max(0, ecs.enemyAttackTimer[id] - delta);

  const islandIndex = ecs.enemyHomeIsland[id];
  const island = state.world.islands[islandIndex] ?? state.world.islands[0];
  const distance = target
    ? Math.hypot(target.x - ecs.position.x[id], target.y - ecs.position.y[id])
    : Number.POSITIVE_INFINITY;

  if (target && distance < ecs.enemyAggroRange[id]) {
    const dx = target.x - ecs.position.x[id];
    const dy = target.y - ecs.position.y[id];
    const hitRange = ecs.enemyAttackRange[id] + target.radius;
    const stopDistance = Math.max(4, hitRange - CHASE_STOP_BUFFER);
    const desiredSpeed = distance <= stopDistance ? 0 : ecs.enemySpeed[id];
    const dir = normalize(dx, dy);
    const desiredVx = dir.x * desiredSpeed;
    const desiredVy = dir.y * desiredSpeed;
    const maxDelta = ecs.enemySpeed[id] * CHASE_ACCEL_FACTOR * delta;
    const dvx = desiredVx - ecs.velocity.x[id];
    const dvy = desiredVy - ecs.velocity.y[id];
    const dvLen = Math.hypot(dvx, dvy);

    if (dvLen <= maxDelta || dvLen === 0) {
      ecs.velocity.x[id] = desiredVx;
      ecs.velocity.y[id] = desiredVy;
    } else {
      const scale = maxDelta / dvLen;
      ecs.velocity.x[id] += dvx * scale;
      ecs.velocity.y[id] += dvy * scale;
    }
  } else {
    ecs.enemyWanderTimer[id] -= delta;
    if (ecs.enemyWanderTimer[id] <= 0) {
      ecs.enemyWanderAngle[id] = nextFloat(rng) * Math.PI * 2;
      ecs.enemyWanderTimer[id] = 1.5 + nextFloat(rng) * 2.5;
    }
    ecs.velocity.x[id] = Math.cos(ecs.enemyWanderAngle[id]) * ecs.enemySpeed[id] * WANDER_SPEED_SCALE;
    ecs.velocity.y[id] = Math.sin(ecs.enemyWanderAngle[id]) * ecs.enemySpeed[id] * WANDER_SPEED_SCALE;
  }

  ecs.position.x[id] += ecs.velocity.x[id] * delta;
  ecs.position.y[id] += ecs.velocity.y[id] * delta;

  if (island && !isPointInIsland({ x: ecs.position.x[id], y: ecs.position.y[id] }, island)) {
    const toCenter = normalize(island.center.x - ecs.position.x[id], island.center.y - ecs.position.y[id]);
    ecs.position.x[id] += toCenter.x * ecs.enemySpeed[id] * delta;
    ecs.position.y[id] += toCenter.y * ecs.enemySpeed[id] * delta;
  }

  if (!target) {
    return;
  }

  const postDx = target.x - ecs.position.x[id];
  const postDy = target.y - ecs.position.y[id];
  const postDist = Math.hypot(postDx, postDy);
  const hitRange = ecs.enemyAttackRange[id] + target.radius;

  if (postDist <= hitRange && ecs.enemyAttackTimer[id] <= 0) {
    applyMonsterDamage(state, target.index, target.playerId, ecs.enemyDamage[id]);
    ecs.enemyAttackTimer[id] = ecs.enemyAttackCooldown[id];
  }
};

export const updateEnemies = (state: GameState, delta: number) => {
  const ecs = state.ecs;
  const livingPlayers = buildLivingPlayers(state);
  forEachEntity(ecs, ENEMY_MASK, (id) => {
    ecs.enemyHitTimer[id] = Math.max(0, ecs.enemyHitTimer[id] - delta);
    const target = livingPlayers.length > 0
      ? findClosestPlayer(livingPlayers, ecs.position.x[id], ecs.position.y[id])
      : null;

    if (ecs.enemyKind[id] === ENEMY_KIND_TO_INDEX.kraken) {
      updateKraken(state, id, target, delta);
      return;
    }

    if (ecs.enemyKind[id] !== ENEMY_KIND_TO_INDEX.crab && ecs.enemyKind[id] !== ENEMY_KIND_TO_INDEX.wolf) {
      return;
    }
    updateLandEnemy(state, id, target, delta);
  });
};
