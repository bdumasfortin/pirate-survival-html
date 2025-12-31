import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import type { ResourceKind } from "../world/types";
import { clamp, normalize } from "../core/math";
import { nextFloat, nextRange } from "../core/rng";
import { ComponentMask, destroyEntity, forEachEntity, isEntityAlive } from "../core/ecs";
import { ENEMY_KIND_TO_INDEX } from "../game/enemy-kinds";
import { isPointInPolygon } from "../world/island-geometry";
import {
  ATTACK_EFFECT_DURATION,
  CRAB_HIT_FLASH_DURATION,
  DAMAGE_FLASH_DURATION,
  PLAYER_ATTACK_CONE_SPREAD,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE
} from "../game/combat-config";
import { GROUND_ITEM_DROP_OFFSET } from "../game/ground-items-config";
import { KRAKEN_STATS } from "../game/creatures-config";
import { getEquippedItemCount } from "../game/equipment";
import { spawnGroundItem } from "../game/ground-items";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity } from "../game/inventory";
import { ARMOR_PER_PIECE, ARMOR_REGEN_DELAY } from "../game/survival-config";

const WANDER_SPEED_SCALE = 0.4;
const ENEMY_MASK = ComponentMask.Enemy | ComponentMask.Position | ComponentMask.Velocity | ComponentMask.Radius;

const applyMonsterDamage = (state: GameState, damage: number) => {
  const stats = state.survival;
  const maxArmor = getEquippedItemCount(state.ecs, state.playerId) * ARMOR_PER_PIECE;
  stats.maxArmor = maxArmor;
  stats.armor = clamp(stats.armor, 0, stats.maxArmor);

  let remaining = damage;

  if (stats.armor > 0) {
    const absorbed = Math.min(stats.armor, remaining);
    stats.armor = clamp(stats.armor - absorbed, 0, stats.maxArmor);
    remaining -= absorbed;
  }

  if (remaining > 0) {
    stats.health = clamp(stats.health - remaining, 0, stats.maxHealth);
  }

  stats.armorRegenTimer = ARMOR_REGEN_DELAY;
  state.damageFlashTimer = DAMAGE_FLASH_DURATION;

  if (stats.health <= 0) {
    stats.health = 0;
    state.isDead = true;
    state.damageFlashTimer = 0;
    state.attackEffect = null;
  }
};

export const updateCrabs = (state: GameState, delta: number) => {
  const playerId = state.playerId;
  const ecs = state.ecs;
  const rng = state.rng;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const playerX = ecs.position.x[playerId];
  const playerY = ecs.position.y[playerId];
  const playerRadius = ecs.radius[playerId];

  forEachEntity(ecs, ENEMY_MASK, (id) => {
    ecs.enemyHitTimer[id] = Math.max(0, ecs.enemyHitTimer[id] - delta);

    if (ecs.enemyKind[id] === ENEMY_KIND_TO_INDEX.kraken) {
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

      const dx = playerX - ecs.position.x[id];
      const dy = playerY - ecs.position.y[id];
      const distance = Math.hypot(dx, dy);
      const hitRange = ecs.radius[id] + playerRadius;

      if (distance <= hitRange && ecs.enemyAttackTimer[id] <= 0) {
        applyMonsterDamage(state, ecs.enemyDamage[id]);
        ecs.enemyAttackTimer[id] = ecs.enemyAttackCooldown[id];
      }

      return;
    }

    if (ecs.enemyKind[id] !== ENEMY_KIND_TO_INDEX.crab && ecs.enemyKind[id] !== ENEMY_KIND_TO_INDEX.wolf) {
      return;
    }

    ecs.enemyAttackTimer[id] = Math.max(0, ecs.enemyAttackTimer[id] - delta);

    const islandIndex = ecs.enemyHomeIsland[id];
    const island = state.world.islands[islandIndex] ?? state.world.islands[0];
    const dx = playerX - ecs.position.x[id];
    const dy = playerY - ecs.position.y[id];
    const distance = Math.hypot(dx, dy);

    if (distance < ecs.enemyAggroRange[id]) {
      const dir = normalize(dx, dy);
      ecs.velocity.x[id] = dir.x * ecs.enemySpeed[id];
      ecs.velocity.y[id] = dir.y * ecs.enemySpeed[id];
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

    if (island && !isPointInPolygon({ x: ecs.position.x[id], y: ecs.position.y[id] }, island.points)) {
      const toCenter = normalize(island.center.x - ecs.position.x[id], island.center.y - ecs.position.y[id]);
      ecs.position.x[id] += toCenter.x * ecs.enemySpeed[id] * delta;
      ecs.position.y[id] += toCenter.y * ecs.enemySpeed[id] * delta;
    }

    const postDx = playerX - ecs.position.x[id];
    const postDy = playerY - ecs.position.y[id];
    const postDist = Math.hypot(postDx, postDy);
    const hitRange = ecs.enemyAttackRange[id] + playerRadius;

    if (postDist <= hitRange && ecs.enemyAttackTimer[id] <= 0) {
      applyMonsterDamage(state, ecs.enemyDamage[id]);
      ecs.enemyAttackTimer[id] = ecs.enemyAttackCooldown[id];
    }
  });
};

export const updatePlayerAttack = (state: GameState, input: InputState, delta: number) => {
  state.playerAttackTimer = Math.max(0, state.playerAttackTimer - delta);

  if (state.attackEffect) {
    state.attackEffect.timer = Math.max(0, state.attackEffect.timer - delta);
    if (state.attackEffect.timer <= 0) {
      state.attackEffect = null;
    }
  }

  if (!input.useQueued) {
    return;
  }

  const selectedIndex = getInventorySelectedIndex(state.ecs, state.playerId);
  const slotKind = getInventorySlotKind(state.ecs, state.playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(state.ecs, state.playerId, selectedIndex);
  if (slotKind !== "sword" || slotQuantity <= 0) {
    return;
  }

  input.useQueued = false;

  if (state.playerAttackTimer > 0) {
    return;
  }

  const playerId = state.playerId;
  const ecs = state.ecs;
  const rng = state.rng;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const playerX = ecs.position.x[playerId];
  const playerY = ecs.position.y[playerId];
  const playerVelX = ecs.velocity.x[playerId];
  const playerVelY = ecs.velocity.y[playerId];
  const playerRadius = ecs.radius[playerId];

  const mouseWorld = input.mouseWorld;
  const aimVector = mouseWorld
    ? { x: mouseWorld.x - playerX, y: mouseWorld.y - playerY }
    : { x: playerVelX, y: playerVelY };
  const dir = Math.hypot(aimVector.x, aimVector.y) > 1 ? normalize(aimVector.x, aimVector.y) : { x: 1, y: 0 };
  const angle = Math.atan2(dir.y, dir.x);
  const coneRadius = playerRadius + PLAYER_ATTACK_RANGE;
  const coneSpread = PLAYER_ATTACK_CONE_SPREAD;
  const attackReach = coneRadius;

  state.attackEffect = {
    origin: {
      x: playerX,
      y: playerY
    },
    angle,
    radius: coneRadius,
    spread: coneSpread,
    timer: ATTACK_EFFECT_DURATION,
    duration: ATTACK_EFFECT_DURATION
  };

  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;

  forEachEntity(ecs, ENEMY_MASK, (id) => {
    const dx = ecs.position.x[id] - playerX;
    const dy = ecs.position.y[id] - playerY;
    const dist = Math.hypot(dx, dy);

    if (dist <= attackReach + ecs.radius[id] && dist < closestDistance) {
      closestDistance = dist;
      closestIndex = id;
    }
  });

  if (closestIndex >= 0) {
    const targetId = closestIndex;
    ecs.enemyHealth[targetId] -= PLAYER_ATTACK_DAMAGE;
    ecs.enemyHitTimer[targetId] = CRAB_HIT_FLASH_DURATION;

    if (ecs.enemyHealth[targetId] <= 0) {
      const dropItem = (kind: ResourceKind, offsetScale = 1) => {
        const angle = nextFloat(rng) * Math.PI * 2;
        const offset = GROUND_ITEM_DROP_OFFSET * offsetScale;
        spawnGroundItem(
          ecs,
          kind,
          1,
          {
            x: ecs.position.x[targetId] + Math.cos(angle) * offset,
            y: ecs.position.y[targetId] + Math.sin(angle) * offset
          },
          state.time
        );
      };

      switch (ecs.enemyKind[targetId]) {
        case ENEMY_KIND_TO_INDEX.crab:
          dropItem("crabmeat");
          if (ecs.enemyIsBoss[targetId]) {
            dropItem("crabhelmet", 1.2);
          }
          break;
        case ENEMY_KIND_TO_INDEX.wolf:
          dropItem("wolfmeat");
          if (ecs.enemyIsBoss[targetId]) {
            dropItem("wolfcloak", 1.2);
          }
          break;
        case ENEMY_KIND_TO_INDEX.kraken:
          dropItem("krakenring");
          break;
        default:
          break;
      }

      destroyEntity(ecs, targetId);
    }
  }

  state.playerAttackTimer = PLAYER_ATTACK_COOLDOWN;
};
