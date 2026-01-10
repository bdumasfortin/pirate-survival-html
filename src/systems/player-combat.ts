import { ComponentMask, type EntityId, forEachEntity, isEntityAlive } from "../core/ecs";
import type { InputState } from "../core/input";
import { normalize } from "../core/math";
import {
  ATTACK_EFFECT_DURATION,
  PLAYER_ATTACK_CONE_SPREAD,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE,
} from "../game/combat-config";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity } from "../game/inventory";
import type { GameState } from "../game/state";
import { applyEnemyDamage } from "./enemies";

const ENEMY_MASK = ComponentMask.Enemy | ComponentMask.Position | ComponentMask.Radius;

const canUseSword = (state: GameState, playerId: EntityId) => {
  const ecs = state.ecs;
  const selectedIndex = getInventorySelectedIndex(ecs, playerId);
  const slotKind = getInventorySlotKind(ecs, playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(ecs, playerId, selectedIndex);
  return slotKind === "sword" && slotQuantity > 0;
};

const updateAttackEffect = (state: GameState, playerIndex: number, playerId: EntityId, input: InputState) => {
  const ecs = state.ecs;
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

  state.attackEffects[playerIndex] = {
    origin: {
      x: playerX,
      y: playerY,
    },
    angle,
    radius: coneRadius,
    spread: coneSpread,
    timer: ATTACK_EFFECT_DURATION,
    duration: ATTACK_EFFECT_DURATION,
  };

  return { x: playerX, y: playerY, reach: coneRadius };
};

const findAttackTarget = (state: GameState, originX: number, originY: number, reach: number) => {
  const ecs = state.ecs;
  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;

  forEachEntity(ecs, ENEMY_MASK, (id) => {
    const dx = ecs.position.x[id] - originX;
    const dy = ecs.position.y[id] - originY;
    const dist = Math.hypot(dx, dy);

    if (dist <= reach + ecs.radius[id] && dist < closestDistance) {
      closestDistance = dist;
      closestIndex = id;
    }
  });

  return closestIndex >= 0 ? closestIndex : null;
};

const updateAttackEffectTimer = (state: GameState, playerIndex: number, delta: number) => {
  const effect = state.attackEffects[playerIndex];
  if (!effect) {
    return;
  }

  effect.timer = Math.max(0, effect.timer - delta);
  if (effect.timer <= 0) {
    state.attackEffects[playerIndex] = null;
  }
};

export const updatePlayerCombat = (
  state: GameState,
  playerIndex: number,
  playerId: EntityId,
  input: InputState,
  delta: number
) => {
  const ecs = state.ecs;
  ecs.playerAttackTimer[playerId] = Math.max(0, ecs.playerAttackTimer[playerId] - delta);
  updateAttackEffectTimer(state, playerIndex, delta);

  if (!input.useQueued) {
    return;
  }

  if (!canUseSword(state, playerId)) {
    return;
  }

  input.useQueued = false;

  if (ecs.playerAttackTimer[playerId] > 0) {
    return;
  }

  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const attackOrigin = updateAttackEffect(state, playerIndex, playerId, input);
  const targetId = findAttackTarget(state, attackOrigin.x, attackOrigin.y, attackOrigin.reach);
  if (targetId !== null) {
    applyEnemyDamage(state, targetId, PLAYER_ATTACK_DAMAGE);
  }

  ecs.playerAttackTimer[playerId] = PLAYER_ATTACK_COOLDOWN;
};
