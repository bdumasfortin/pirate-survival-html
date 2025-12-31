import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import type { ResourceKind } from "../world/types";
import { clamp, normalize } from "../core/math";
import { nextFloat, nextRange } from "../core/rng";
import { ComponentMask, destroyEntity, forEachEntity, isEntityAlive, type EntityId } from "../core/ecs";
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

type LivingPlayer = {
  playerId: EntityId;
  index: number;
  x: number;
  y: number;
  radius: number;
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

export const updateCrabs = (state: GameState, delta: number) => {
  const ecs = state.ecs;
  const rng = state.rng;
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

  const findClosestPlayer = (x: number, y: number) => {
    let closest: LivingPlayer | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const player of livingPlayers) {
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

  forEachEntity(ecs, ENEMY_MASK, (id) => {
    ecs.enemyHitTimer[id] = Math.max(0, ecs.enemyHitTimer[id] - delta);
    const target = livingPlayers.length > 0 ? findClosestPlayer(ecs.position.x[id], ecs.position.y[id]) : null;

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

      return;
    }

    if (ecs.enemyKind[id] !== ENEMY_KIND_TO_INDEX.crab && ecs.enemyKind[id] !== ENEMY_KIND_TO_INDEX.wolf) {
      return;
    }

    ecs.enemyAttackTimer[id] = Math.max(0, ecs.enemyAttackTimer[id] - delta);

    const islandIndex = ecs.enemyHomeIsland[id];
    const island = state.world.islands[islandIndex] ?? state.world.islands[0];
    const distance = target ? Math.hypot(target.x - ecs.position.x[id], target.y - ecs.position.y[id]) : Number.POSITIVE_INFINITY;

    if (target && distance < ecs.enemyAggroRange[id]) {
      const dir = normalize(target.x - ecs.position.x[id], target.y - ecs.position.y[id]);
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

    if (target) {
      const postDx = target.x - ecs.position.x[id];
      const postDy = target.y - ecs.position.y[id];
      const postDist = Math.hypot(postDx, postDy);
      const hitRange = ecs.enemyAttackRange[id] + target.radius;

      if (postDist <= hitRange && ecs.enemyAttackTimer[id] <= 0) {
        applyMonsterDamage(state, target.index, target.playerId, ecs.enemyDamage[id]);
        ecs.enemyAttackTimer[id] = ecs.enemyAttackCooldown[id];
      }
    }
  });
};

export const updatePlayerAttack = (
  state: GameState,
  playerIndex: number,
  playerId: EntityId,
  input: InputState,
  delta: number
) => {
  const ecs = state.ecs;
  ecs.playerAttackTimer[playerId] = Math.max(0, ecs.playerAttackTimer[playerId] - delta);

  const effect = state.attackEffects[playerIndex];
  if (effect) {
    effect.timer = Math.max(0, effect.timer - delta);
    if (effect.timer <= 0) {
      state.attackEffects[playerIndex] = null;
    }
  }

  if (!input.useQueued) {
    return;
  }

  const selectedIndex = getInventorySelectedIndex(ecs, playerId);
  const slotKind = getInventorySlotKind(ecs, playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(ecs, playerId, selectedIndex);
  if (slotKind !== "sword" || slotQuantity <= 0) {
    return;
  }

  input.useQueued = false;

  if (ecs.playerAttackTimer[playerId] > 0) {
    return;
  }

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

  state.attackEffects[playerIndex] = {
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

  ecs.playerAttackTimer[playerId] = PLAYER_ATTACK_COOLDOWN;
};
