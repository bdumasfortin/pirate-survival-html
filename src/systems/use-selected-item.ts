import { type InputState } from "../core/input";
import type { GameState } from "../game/state";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const USE_COOLDOWN = 0.33;
let useCooldown = 0;

export const updateUseCooldown = (delta: number) => {
  if (useCooldown > 0) {
    useCooldown = Math.max(0, useCooldown - delta);
  }
};

export const useSelectedItem = (state: GameState, input: InputState) => {
  if (!input.useQueued) {
    return;
  }

  const slot = state.inventory.slots[state.inventory.selectedIndex];
  if (!slot || slot.quantity <= 0 || slot.kind !== "berries") {
    return;
  }

  input.useQueued = false;

  if (useCooldown > 0) {
    return;
  }

  const stats = state.survival;
  const restore = stats.maxHunger * 0.5;
  stats.hunger = clamp(stats.hunger + restore, 0, stats.maxHunger);

  slot.quantity -= 1;
  if (slot.quantity <= 0) {
    slot.quantity = 0;
    slot.kind = null;
  }

  useCooldown = USE_COOLDOWN;
};
