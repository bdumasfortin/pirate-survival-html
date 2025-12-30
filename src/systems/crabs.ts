import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import type { Crab, Kraken, Wolf } from "../game/creatures";
import type { ResourceKind } from "../world/types";
import { clamp, normalize } from "../core/math";
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

const WANDER_SPEED_SCALE = 0.4;

let playerAttackTimer = 0;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

export const updateCrabs = (state: GameState, delta: number) => {
  for (const enemy of state.enemies) {
    enemy.hitTimer = Math.max(0, enemy.hitTimer - delta);
  }

  const player = state.entities.find((entity) => entity.id === state.playerId);
  const stats = state.survival;

  if (!player) {
    return;
  }

  for (const enemy of state.enemies) {
    if (enemy.kind === "kraken") {
      const kraken = enemy as Kraken;
      kraken.attackTimer = Math.max(0, kraken.attackTimer - delta);
      kraken.wanderTimer -= delta;

      if (kraken.wanderTimer <= 0) {
        kraken.wanderAngle = Math.random() * Math.PI * 2;
        kraken.wanderTimer = randomBetween(KRAKEN_STATS.wanderTimerMin, KRAKEN_STATS.wanderTimerMax);
      }

      kraken.velocity.x = Math.cos(kraken.wanderAngle) * kraken.speed * WANDER_SPEED_SCALE;
      kraken.velocity.y = Math.sin(kraken.wanderAngle) * kraken.speed * WANDER_SPEED_SCALE;
      kraken.position.x += kraken.velocity.x * delta;
      kraken.position.y += kraken.velocity.y * delta;

      const dx = player.position.x - kraken.position.x;
      const dy = player.position.y - kraken.position.y;
      const distance = Math.hypot(dx, dy);
      const hitRange = kraken.radius + player.radius;

      if (distance <= hitRange && kraken.attackTimer <= 0) {
        stats.health = clamp(stats.health - kraken.damage, 0, stats.maxHealth);
        kraken.attackTimer = kraken.attackCooldown;
        state.damageFlashTimer = DAMAGE_FLASH_DURATION;

        if (stats.health <= 0) {
          stats.health = 0;
          state.isDead = true;
          state.damageFlashTimer = 0;
          state.attackEffect = null;
        }
      }

      continue;
    }

    if (enemy.kind !== "crab" && enemy.kind !== "wolf") {
      continue;
    }

    const creature = enemy as Crab | Wolf;
    creature.attackTimer = Math.max(0, creature.attackTimer - delta);

    const island = state.world.islands[creature.homeIslandIndex] ?? state.world.islands[0];
    const dx = player.position.x - creature.position.x;
    const dy = player.position.y - creature.position.y;
    const distance = Math.hypot(dx, dy);

    if (distance < creature.aggroRange) {
      const dir = normalize(dx, dy);
      creature.velocity.x = dir.x * creature.speed;
      creature.velocity.y = dir.y * creature.speed;
    } else {
      creature.wanderTimer -= delta;
      if (creature.wanderTimer <= 0) {
        creature.wanderAngle = Math.random() * Math.PI * 2;
        creature.wanderTimer = 1.5 + Math.random() * 2.5;
      }
      creature.velocity.x = Math.cos(creature.wanderAngle) * creature.speed * WANDER_SPEED_SCALE;
      creature.velocity.y = Math.sin(creature.wanderAngle) * creature.speed * WANDER_SPEED_SCALE;
    }

    creature.position.x += creature.velocity.x * delta;
    creature.position.y += creature.velocity.y * delta;

    if (island && !isPointInPolygon(creature.position, island.points)) {
      const toCenter = normalize(island.center.x - creature.position.x, island.center.y - creature.position.y);
      creature.position.x += toCenter.x * creature.speed * delta;
      creature.position.y += toCenter.y * creature.speed * delta;
    }

    const postDx = player.position.x - creature.position.x;
    const postDy = player.position.y - creature.position.y;
    const postDist = Math.hypot(postDx, postDy);
    const hitRange = creature.attackRange + player.radius;

    if (postDist <= hitRange && creature.attackTimer <= 0) {
      stats.health = clamp(stats.health - creature.damage, 0, stats.maxHealth);
      creature.attackTimer = creature.attackCooldown;
      state.damageFlashTimer = DAMAGE_FLASH_DURATION;

      if (stats.health <= 0) {
        stats.health = 0;
        state.isDead = true;
        state.damageFlashTimer = 0;
        state.attackEffect = null;
      }
    }
  }
};

export const updatePlayerAttack = (state: GameState, input: InputState, delta: number) => {
  playerAttackTimer = Math.max(0, playerAttackTimer - delta);

  if (state.attackEffect) {
    state.attackEffect.timer = Math.max(0, state.attackEffect.timer - delta);
    if (state.attackEffect.timer <= 0) {
      state.attackEffect = null;
    }
  }

  if (!input.useQueued) {
    return;
  }

  const slot = state.inventory.slots[state.inventory.selectedIndex];
  if (!slot || slot.kind !== "sword" || slot.quantity <= 0) {
    return;
  }

  input.useQueued = false;

  if (playerAttackTimer > 0) {
    return;
  }

  const player = state.entities.find((entity) => entity.id === state.playerId);
  if (!player) {
    return;
  }

  const mouseWorld = input.mouseWorld;
  const aimVector = mouseWorld
    ? { x: mouseWorld.x - player.position.x, y: mouseWorld.y - player.position.y }
    : { x: player.velocity.x, y: player.velocity.y };
  const dir = Math.hypot(aimVector.x, aimVector.y) > 1 ? normalize(aimVector.x, aimVector.y) : { x: 1, y: 0 };
  const angle = Math.atan2(dir.y, dir.x);
  const coneRadius = player.radius + PLAYER_ATTACK_RANGE;
  const coneSpread = PLAYER_ATTACK_CONE_SPREAD;
  const attackReach = coneRadius;

  state.attackEffect = {
    origin: {
      x: player.position.x,
      y: player.position.y
    },
    angle,
    radius: coneRadius,
    spread: coneSpread,
    timer: ATTACK_EFFECT_DURATION,
    duration: ATTACK_EFFECT_DURATION
  };

  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < state.enemies.length; i += 1) {
    const enemy = state.enemies[i];
    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= attackReach + enemy.radius && dist < closestDistance) {
      closestDistance = dist;
      closestIndex = i;
    }
  }

  if (closestIndex >= 0) {
    const target = state.enemies[closestIndex];
    target.health -= PLAYER_ATTACK_DAMAGE;
    target.hitTimer = CRAB_HIT_FLASH_DURATION;

    if (target.health <= 0) {
      const dropItem = (kind: ResourceKind, offsetScale = 1) => {
        const angle = Math.random() * Math.PI * 2;
        const offset = GROUND_ITEM_DROP_OFFSET * offsetScale;
        state.groundItems.push({
          id: state.nextGroundItemId++,
          kind,
          quantity: 1,
          position: {
            x: target.position.x + Math.cos(angle) * offset,
            y: target.position.y + Math.sin(angle) * offset
          },
          droppedAt: state.time
        });
      };

      switch (target.kind) {
        case "crab":
          dropItem("crabmeat");
          if (target.isBoss) {
            dropItem("crabhelmet", 1.2);
          }
          break;
        case "wolf":
          dropItem("wolfcloak");
          break;
        case "kraken":
          dropItem("krakenring");
          break;
        default:
          break;
      }

      state.enemies.splice(closestIndex, 1);
    }
  }

  playerAttackTimer = PLAYER_ATTACK_COOLDOWN;
};
