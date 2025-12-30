import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import type { Vec2 } from "../core/types";

const PLAYER_ATTACK_RANGE = 32;
const PLAYER_ATTACK_DAMAGE = 14;
const PLAYER_ATTACK_COOLDOWN = 0.4;
const ATTACK_EFFECT_DURATION = 0.12;
const CRAB_HIT_FLASH = 0.18;
const DAMAGE_FLASH_DURATION = 0.25;
let playerAttackTimer = 0;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

const normalize = (x: number, y: number) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

export const updateCrabs = (state: GameState, delta: number) => {
  const player = state.entities.find((entity) => entity.id === state.playerId);
  const stats = state.survival;

  if (!player) {
    return;
  }

  for (const crab of state.crabs) {
    crab.attackTimer = Math.max(0, crab.attackTimer - delta);
    crab.hitTimer = Math.max(0, crab.hitTimer - delta);

    const island = state.world.islands[crab.homeIslandIndex] ?? state.world.islands[0];
    const dx = player.position.x - crab.position.x;
    const dy = player.position.y - crab.position.y;
    const distance = Math.hypot(dx, dy);

    if (distance < crab.aggroRange) {
      const dir = normalize(dx, dy);
      crab.velocity.x = dir.x * crab.speed;
      crab.velocity.y = dir.y * crab.speed;
    } else {
      crab.wanderTimer -= delta;
      if (crab.wanderTimer <= 0) {
        crab.wanderAngle = Math.random() * Math.PI * 2;
        crab.wanderTimer = 1.5 + Math.random() * 2.5;
      }
      crab.velocity.x = Math.cos(crab.wanderAngle) * crab.speed * 0.4;
      crab.velocity.y = Math.sin(crab.wanderAngle) * crab.speed * 0.4;
    }

    crab.position.x += crab.velocity.x * delta;
    crab.position.y += crab.velocity.y * delta;

    if (island && !isPointInPolygon(crab.position, island.points)) {
      const toCenter = normalize(island.center.x - crab.position.x, island.center.y - crab.position.y);
      crab.position.x += toCenter.x * crab.speed * delta;
      crab.position.y += toCenter.y * crab.speed * delta;
    }

    const postDx = player.position.x - crab.position.x;
    const postDy = player.position.y - crab.position.y;
    const postDist = Math.hypot(postDx, postDy);
    const hitRange = crab.attackRange + player.radius;

    if (postDist <= hitRange && crab.attackTimer <= 0) {
      stats.health = clamp(stats.health - crab.damage, 0, stats.maxHealth);
      crab.attackTimer = crab.attackCooldown;
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
  const coneSpread = 0.9;
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
    target.hitTimer = CRAB_HIT_FLASH;

    if (target.health <= 0) {
      state.enemies.splice(closestIndex, 1);
    }
  }

  playerAttackTimer = PLAYER_ATTACK_COOLDOWN;
};










