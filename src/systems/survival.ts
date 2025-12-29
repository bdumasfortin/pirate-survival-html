import type { GameState } from "../game/state";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const updateSurvival = (state: GameState, delta: number) => {
  const stats = state.survival;

  stats.hunger = clamp(stats.hunger - delta * 0.6, 0, stats.maxHunger);
  stats.thirst = clamp(stats.thirst - delta * 0.9, 0, stats.maxThirst);

  if (stats.hunger <= 0 || stats.thirst <= 0) {
    stats.health = clamp(stats.health - delta * 2.5, 0, stats.maxHealth);
  }
};
