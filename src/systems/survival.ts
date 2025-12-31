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

export const updateSurvival = (state: GameState, delta: number) => {
  if (state.damageFlashTimer > 0) {
    state.damageFlashTimer = Math.max(0, state.damageFlashTimer - delta);
  }

  if (state.isDead) {
    return;
  }

  const stats = state.survival;
  const prevHealth = stats.health;

  const equippedCount = getEquippedItemCount(state.ecs, state.playerId);
  const maxArmor = equippedCount * ARMOR_PER_PIECE;
  stats.maxArmor = maxArmor;
  stats.armor = clamp(stats.armor, 0, stats.maxArmor);

  if (stats.armorRegenTimer > 0) {
    stats.armorRegenTimer = Math.max(0, stats.armorRegenTimer - delta);
  }

  stats.hunger = clamp(stats.hunger - delta * HUNGER_DECAY_RATE, 0, stats.maxHunger);

  if (stats.hunger <= 0) {
    stats.health = clamp(stats.health - delta * STARVATION_DAMAGE_RATE, 0, stats.maxHealth);
  }

  if (stats.maxArmor > 0 && stats.armor < stats.maxArmor && stats.armorRegenTimer <= 0) {
    stats.armor = clamp(stats.armor + delta * ARMOR_REGEN_RATE, 0, stats.maxArmor);
  }

  if (stats.health < prevHealth) {
    state.damageFlashTimer = DAMAGE_FLASH_DURATION;
  }

  if (stats.health <= 0) {
    stats.health = 0;
    state.isDead = true;
    state.damageFlashTimer = 0;
    state.attackEffect = null;
  }
};
