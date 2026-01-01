import type { GameState } from "../game/state";
import { clamp } from "../core/math";
import { DAMAGE_FLASH_DURATION } from "../game/combat-config";
import { getEquippedItemCount } from "../game/equipment";
import { INVENTORY_SLOT_COUNT } from "../core/ecs";
import { nextFloat } from "../core/rng";
import { spawnGroundItem } from "../game/ground-items";
import { getInventorySlotKind, getInventorySlotQuantity, clearInventorySlot } from "../game/inventory";
import { createSurvivalStats } from "../game/survival";
import {
  ARMOR_PER_PIECE,
  ARMOR_REGEN_RATE,
  HUNGER_DECAY_RATE,
  STARVATION_DAMAGE_RATE
} from "../game/survival-config";
import type { EntityId } from "../core/ecs";

const RESPAWN_DELAY_SECONDS = 3;
const RESPAWN_RADIUS = 28;
const DROP_ITEM_OFFSET = 16;

const getRespawnPosition = (playerIndex: number, playerCount: number) => {
  if (playerCount <= 1) {
    return { x: 0, y: 0 };
  }
  const angle = (playerIndex / playerCount) * Math.PI * 2;
  return {
    x: Math.cos(angle) * RESPAWN_RADIUS,
    y: Math.sin(angle) * RESPAWN_RADIUS
  };
};

const dropInventoryItems = (state: GameState, playerId: EntityId) => {
  const ecs = state.ecs;
  const baseX = ecs.position.x[playerId];
  const baseY = ecs.position.y[playerId];

  for (let slotIndex = 0; slotIndex < INVENTORY_SLOT_COUNT; slotIndex += 1) {
    const kind = getInventorySlotKind(ecs, playerId, slotIndex);
    const quantity = getInventorySlotQuantity(ecs, playerId, slotIndex);
    if (!kind || quantity <= 0) {
      continue;
    }

    const angle = nextFloat(state.rng) * Math.PI * 2;
    const offset = DROP_ITEM_OFFSET + slotIndex * 1.5;
    spawnGroundItem(
      ecs,
      kind,
      quantity,
      {
        x: baseX + Math.cos(angle) * offset,
        y: baseY + Math.sin(angle) * offset
      },
      state.time
    );
    clearInventorySlot(ecs, playerId, slotIndex);
  }
};

const respawnPlayer = (state: GameState, playerIndex: number, playerId: EntityId) => {
  const ecs = state.ecs;
  const spawn = getRespawnPosition(playerIndex, state.playerIds.length);
  ecs.position.x[playerId] = spawn.x;
  ecs.position.y[playerId] = spawn.y;
  ecs.prevPosition.x[playerId] = spawn.x;
  ecs.prevPosition.y[playerId] = spawn.y;
  ecs.velocity.x[playerId] = 0;
  ecs.velocity.y[playerId] = 0;
  ecs.playerUseCooldown[playerId] = 0;
  ecs.playerAttackTimer[playerId] = 0;
  ecs.playerIsOnRaft[playerId] = 0;
  ecs.playerDamageFlashTimer[playerId] = 0;

  const stats = createSurvivalStats();
  ecs.playerHealth[playerId] = stats.health;
  ecs.playerMaxHealth[playerId] = stats.maxHealth;
  ecs.playerHunger[playerId] = stats.hunger;
  ecs.playerMaxHunger[playerId] = stats.maxHunger;
  ecs.playerArmor[playerId] = stats.armor;
  ecs.playerMaxArmor[playerId] = stats.maxArmor;
  ecs.playerArmorRegenTimer[playerId] = stats.armorRegenTimer;

  ecs.playerRespawnTimer[playerId] = 0;
  ecs.playerIsDead[playerId] = 0;
  if (state.attackEffects[playerIndex]) {
    state.attackEffects[playerIndex] = null;
  }
};

export const updateSurvival = (state: GameState, playerIndex: number, playerId: EntityId, delta: number) => {
  const ecs = state.ecs;

  if (ecs.playerDamageFlashTimer[playerId] > 0) {
    ecs.playerDamageFlashTimer[playerId] = Math.max(0, ecs.playerDamageFlashTimer[playerId] - delta);
  }

  if (ecs.playerIsDead[playerId]) {
    if (ecs.playerRespawnTimer[playerId] <= 0) {
      ecs.playerRespawnTimer[playerId] = RESPAWN_DELAY_SECONDS;
      dropInventoryItems(state, playerId);
    }
    ecs.playerRespawnTimer[playerId] = Math.max(0, ecs.playerRespawnTimer[playerId] - delta);
    if (ecs.playerRespawnTimer[playerId] <= 0) {
      respawnPlayer(state, playerIndex, playerId);
    }
    return;
  }

  const prevHealth = ecs.playerHealth[playerId];

  const equippedCount = getEquippedItemCount(ecs, playerId);
  const maxArmor = equippedCount * ARMOR_PER_PIECE;
  ecs.playerMaxArmor[playerId] = maxArmor;
  ecs.playerArmor[playerId] = clamp(ecs.playerArmor[playerId], 0, ecs.playerMaxArmor[playerId]);

  if (ecs.playerArmorRegenTimer[playerId] > 0) {
    ecs.playerArmorRegenTimer[playerId] = Math.max(0, ecs.playerArmorRegenTimer[playerId] - delta);
  }

  ecs.playerHunger[playerId] = clamp(
    ecs.playerHunger[playerId] - delta * HUNGER_DECAY_RATE,
    0,
    ecs.playerMaxHunger[playerId]
  );

  if (ecs.playerHunger[playerId] <= 0) {
    ecs.playerHealth[playerId] = clamp(
      ecs.playerHealth[playerId] - delta * STARVATION_DAMAGE_RATE,
      0,
      ecs.playerMaxHealth[playerId]
    );
  }

  if (ecs.playerMaxArmor[playerId] > 0 &&
    ecs.playerArmor[playerId] < ecs.playerMaxArmor[playerId] &&
    ecs.playerArmorRegenTimer[playerId] <= 0) {
    ecs.playerArmor[playerId] = clamp(
      ecs.playerArmor[playerId] + delta * ARMOR_REGEN_RATE,
      0,
      ecs.playerMaxArmor[playerId]
    );
  }

  if (ecs.playerHealth[playerId] < prevHealth) {
    ecs.playerDamageFlashTimer[playerId] = DAMAGE_FLASH_DURATION;
  }

  if (ecs.playerHealth[playerId] <= 0) {
    ecs.playerHealth[playerId] = 0;
    ecs.playerIsDead[playerId] = 1;
    ecs.playerDamageFlashTimer[playerId] = 0;
    ecs.playerRespawnTimer[playerId] = RESPAWN_DELAY_SECONDS;
    dropInventoryItems(state, playerId);
    if (state.attackEffects[playerIndex]) {
      state.attackEffects[playerIndex] = null;
    }
  }
};
