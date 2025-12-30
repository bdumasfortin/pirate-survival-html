import type { GameState } from "../game/state";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const updateSurvival = (state: GameState, delta: number) => {
  if (state.isDead) {
    return;
  }

  const stats = state.survival;

  stats.hunger = clamp(stats.hunger - delta * 0.6, 0, stats.maxHunger);

  if (stats.hunger <= 0) {
    stats.health = clamp(stats.health - delta * 2.5, 0, stats.maxHealth);
  }

  if (stats.health <= 0) {
    stats.health = 0;
    state.isDead = true;
    state.attackEffect = null;
  }
};
