import type { GameState } from "../game/state";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const DAMAGE_FLASH_DURATION = 0.25;

export const updateSurvival = (state: GameState, delta: number) => {
  if (state.damageFlashTimer > 0) {
    state.damageFlashTimer = Math.max(0, state.damageFlashTimer - delta);
  }

  if (state.isDead) {
    return;
  }

  const stats = state.survival;
  const prevHealth = stats.health;

  stats.hunger = clamp(stats.hunger - delta * 0.6, 0, stats.maxHunger);

  if (stats.hunger <= 0) {
    stats.health = clamp(stats.health - delta * 2.5, 0, stats.maxHealth);
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
