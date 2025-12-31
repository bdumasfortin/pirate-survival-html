import { type InputState } from "../core/input";
import type { GameState } from "../game/state";
import { getEquipmentSlotForItem, getEquipmentSlotKind, setEquipmentSlotKind } from "../game/equipment";
import { clamp } from "../core/math";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity, setInventorySlotQuantity } from "../game/inventory";
import { BERRY_RESTORE_RATIO, CRAB_MEAT_RESTORE_RATIO, ITEM_USE_COOLDOWN, WOLF_MEAT_RESTORE_RATIO } from "../game/use-config";

export const updateUseCooldown = (state: GameState, delta: number) => {
  if (state.useCooldown > 0) {
    state.useCooldown = Math.max(0, state.useCooldown - delta);
  }
};

export const useSelectedItem = (state: GameState, input: InputState) => {
  if (!input.useQueued) {
    return;
  }

  const ecs = state.ecs;
  const playerId = state.playerId;
  const selectedIndex = getInventorySelectedIndex(ecs, playerId);
  const slotKind = getInventorySlotKind(ecs, playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(ecs, playerId, selectedIndex);
  if (!slotKind || slotQuantity <= 0) {
    return;
  }

  input.useQueued = false;

  const equipSlot = getEquipmentSlotForItem(slotKind);
  if (equipSlot) {
    if (!getEquipmentSlotKind(ecs, playerId, equipSlot)) {
      setEquipmentSlotKind(ecs, playerId, equipSlot, slotKind);
      setInventorySlotQuantity(ecs, playerId, selectedIndex, slotQuantity - 1);
    }
    return;
  }

  if (slotKind !== "berries" && slotKind !== "crabmeat" && slotKind !== "wolfmeat") {
    return;
  }

  if (state.useCooldown > 0) {
    return;
  }

  const stats = state.survival;
  const restoreRatio = slotKind === "wolfmeat"
    ? WOLF_MEAT_RESTORE_RATIO
    : slotKind === "crabmeat"
      ? CRAB_MEAT_RESTORE_RATIO
      : BERRY_RESTORE_RATIO;
  const restore = stats.maxHunger * restoreRatio;
  stats.hunger = clamp(stats.hunger + restore, 0, stats.maxHunger);

  setInventorySlotQuantity(ecs, playerId, selectedIndex, slotQuantity - 1);

  state.useCooldown = ITEM_USE_COOLDOWN;
};
