import { type InputState } from "../core/input";
import type { GameState } from "../game/state";
import { getEquipmentSlotForItem } from "../game/equipment";
import { clamp } from "../core/math";
import { BERRY_RESTORE_RATIO, CRAB_MEAT_RESTORE_RATIO, ITEM_USE_COOLDOWN, WOLF_MEAT_RESTORE_RATIO } from "../game/use-config";

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
  if (!slot || slot.quantity <= 0 || !slot.kind) {
    return;
  }

  input.useQueued = false;

  const equipSlot = getEquipmentSlotForItem(slot.kind);
  if (equipSlot) {
    if (!state.equipment.slots[equipSlot]) {
      state.equipment.slots[equipSlot] = slot.kind;
      slot.quantity -= 1;
      if (slot.quantity <= 0) {
        slot.quantity = 0;
        slot.kind = null;
      }
    }
    return;
  }

  if (slot.kind !== "berries" && slot.kind !== "crabmeat" && slot.kind !== "wolfmeat") {
    return;
  }

  if (useCooldown > 0) {
    return;
  }

  const stats = state.survival;
  const restoreRatio = slot.kind === "wolfmeat"
    ? WOLF_MEAT_RESTORE_RATIO
    : slot.kind === "crabmeat"
      ? CRAB_MEAT_RESTORE_RATIO
      : BERRY_RESTORE_RATIO;
  const restore = stats.maxHunger * restoreRatio;
  stats.hunger = clamp(stats.hunger + restore, 0, stats.maxHunger);

  slot.quantity -= 1;
  if (slot.quantity <= 0) {
    slot.quantity = 0;
    slot.kind = null;
  }

  useCooldown = ITEM_USE_COOLDOWN;
};
