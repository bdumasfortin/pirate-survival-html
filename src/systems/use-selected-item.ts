import { type InputState } from "../core/input";
import type { GameState } from "../game/state";
import { getEquipmentSlotForItem, getEquipmentSlotKind, setEquipmentSlotKind } from "../game/equipment";
import { clamp } from "../core/math";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity, setInventorySlotQuantity } from "../game/inventory";
import type { ResourceKind } from "../world/types";
import { BERRY_RESTORE_RATIO, CRAB_MEAT_RESTORE_RATIO, ITEM_USE_COOLDOWN, WOLF_MEAT_RESTORE_RATIO } from "../game/use-config";
import type { EntityId } from "../core/ecs";

const isConsumable = (kind: string) => kind === "berries" || kind === "crabmeat" || kind === "wolfmeat";
const CONSUMABLE_RESTORE: Partial<Record<ResourceKind, number>> = {
  berries: BERRY_RESTORE_RATIO,
  crabmeat: CRAB_MEAT_RESTORE_RATIO,
  wolfmeat: WOLF_MEAT_RESTORE_RATIO
};

export const updateUseCooldown = (state: GameState, playerId: EntityId, delta: number) => {
  const ecs = state.ecs;
  if (ecs.playerUseCooldown[playerId] > 0) {
    ecs.playerUseCooldown[playerId] = Math.max(0, ecs.playerUseCooldown[playerId] - delta);
  }
};

export const useSelectedItem = (state: GameState, playerId: EntityId, input: InputState) => {
  if (!input.useQueued) {
    return;
  }

  const ecs = state.ecs;
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

  if (!isConsumable(slotKind)) {
    return;
  }

  if (ecs.playerUseCooldown[playerId] > 0) {
    return;
  }

  const restoreRatio = CONSUMABLE_RESTORE[slotKind] ?? 0;
  const maxHunger = ecs.playerMaxHunger[playerId];
  const restore = maxHunger * restoreRatio;
  ecs.playerHunger[playerId] = clamp(ecs.playerHunger[playerId] + restore, 0, maxHunger);

  setInventorySlotQuantity(ecs, playerId, selectedIndex, slotQuantity - 1);

  ecs.playerUseCooldown[playerId] = ITEM_USE_COOLDOWN;
};
