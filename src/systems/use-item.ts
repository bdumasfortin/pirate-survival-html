import type { EcsWorld, EntityId } from "../core/ecs";
import type { ResourceKind } from "../world/types";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity, setInventorySlotQuantity } from "../game/inventory";

export const consumeSelectedItem = (ecs: EcsWorld, entityId: EntityId): ResourceKind | null => {
  const selectedIndex = getInventorySelectedIndex(ecs, entityId);
  const slotKind = getInventorySlotKind(ecs, entityId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(ecs, entityId, selectedIndex);

  if (!slotKind || slotQuantity <= 0) {
    return null;
  }

  const kind = slotKind;
  setInventorySlotQuantity(ecs, entityId, selectedIndex, slotQuantity - 1);

  return kind;
};
