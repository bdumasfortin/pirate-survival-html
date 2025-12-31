import type { GameState } from "../game/state";
import { clamp } from "../core/math";
import { DAMAGE_FLASH_DURATION } from "../game/combat-config";
import { getEquippedItemCount } from "../game/equipment";
import {
  ARMOR_PER_PIECE,
  ARMOR_REGEN_RATE,
  HUNGER_DECAY_RATE,
  STARVATION_DAMAGE_RATE
} from "../game/survival-config";
import type { EntityId } from "../core/ecs";

export const updateSurvival = (state: GameState, playerIndex: number, playerId: EntityId, delta: number) => {
  const ecs = state.ecs;

  if (ecs.playerDamageFlashTimer[playerId] > 0) {
    ecs.playerDamageFlashTimer[playerId] = Math.max(0, ecs.playerDamageFlashTimer[playerId] - delta);
  }

  if (ecs.playerIsDead[playerId]) {
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
    if (state.attackEffects[playerIndex]) {
      state.attackEffects[playerIndex] = null;
    }
  }
};
