import type { InventoryState } from "../game/inventory";
import type { ResourceKind } from "../world/world";

export const consumeSelectedItem = (inventory: InventoryState): ResourceKind | null => {
  const slot = inventory.slots[inventory.selectedIndex];

  if (!slot || slot.quantity <= 0 || !slot.kind) {
    return null;
  }

  const kind = slot.kind;
  slot.quantity -= 1;

  if (slot.quantity <= 0) {
    slot.quantity = 0;
    slot.kind = null;
  }

  return kind;
};
