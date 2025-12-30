import type { ResourceKind } from "../world/types";

export type InventorySlot = {
  kind: ResourceKind | null;
  quantity: number;
};

export type InventoryState = {
  slots: InventorySlot[];
  selectedIndex: number;
};

export const STACK_LIMIT = 20;

export const createInventory = (): InventoryState => ({
  slots: Array.from({ length: 9 }, () => ({ kind: null, quantity: 0 })),
  selectedIndex: 0
});

export const addToInventory = (inventory: InventoryState, kind: ResourceKind, amount: number) => {
  if (amount <= 0) {
    return 0;
  }

  let remaining = amount;
  const slots = inventory.slots;

  const fillSlot = (slot: InventorySlot, allowEmpty: boolean) => {
    if (remaining <= 0) {
      return;
    }

    if (slot.kind === null) {
      if (!allowEmpty) {
        return;
      }
      slot.kind = kind;
    }

    if (slot.kind !== kind) {
      return;
    }

    const space = STACK_LIMIT - slot.quantity;
    if (space <= 0) {
      return;
    }

    const toAdd = Math.min(space, remaining);
    slot.quantity += toAdd;
    remaining -= toAdd;
  };

  for (const slot of slots) {
    if (slot.kind === kind && slot.quantity < STACK_LIMIT) {
      fillSlot(slot, false);
    }
  }

  for (const slot of slots) {
    if (slot.kind === null) {
      fillSlot(slot, true);
    }
  }

  return amount - remaining;
};

export const getTotalOfKind = (inventory: InventoryState, kind: ResourceKind) =>
  inventory.slots.reduce((total, slot) => {
    if (slot.kind === kind) {
      return total + slot.quantity;
    }
    return total;
  }, 0);

export const getAvailableSpace = (inventory: InventoryState, kind: ResourceKind) =>
  inventory.slots.reduce((space, slot) => {
    if (slot.kind === kind) {
      return space + (STACK_LIMIT - slot.quantity);
    }
    if (slot.kind === null) {
      return space + STACK_LIMIT;
    }
    return space;
  }, 0);

export const removeFromInventory = (inventory: InventoryState, kind: ResourceKind, amount: number) => {
  if (amount <= 0) {
    return 0;
  }

  let remaining = amount;

  for (const slot of inventory.slots) {
    if (slot.kind !== kind || remaining <= 0) {
      continue;
    }

    const take = Math.min(slot.quantity, remaining);
    slot.quantity -= take;
    remaining -= take;

    if (slot.quantity <= 0) {
      slot.quantity = 0;
      slot.kind = null;
    }
  }

  return amount - remaining;
};
