import type { GameState } from "../game/state";
import { clamp } from "../core/math";
import { DAMAGE_FLASH_DURATION } from "../game/combat-config";
import { HUNGER_DECAY_RATE, STARVATION_DAMAGE_RATE } from "../game/survival-config";

export const updateSurvival = (state: GameState, delta: number) => {
  if (state.damageFlashTimer > 0) {
    state.damageFlashTimer = Math.max(0, state.damageFlashTimer - delta);
  }

  if (state.isDead) {
    return;
  }

  const stats = state.survival;
  const prevHealth = stats.health;

  stats.hunger = clamp(stats.hunger - delta * HUNGER_DECAY_RATE, 0, stats.maxHunger);

  if (stats.hunger <= 0) {
    stats.health = clamp(stats.health - delta * STARVATION_DAMAGE_RATE, 0, stats.maxHealth);
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
