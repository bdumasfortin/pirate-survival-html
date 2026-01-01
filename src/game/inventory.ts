import type { EcsWorld, EntityId } from "../core/ecs";
import { INVENTORY_SLOT_COUNT } from "../core/ecs";
import type { ItemKind } from "./item-kinds";
import { itemKindFromIndex, itemKindToIndex } from "./item-kinds";

export const STACK_LIMIT = 20;

const getSlotOffset = (entityId: EntityId, slotIndex: number) => entityId * INVENTORY_SLOT_COUNT + slotIndex;

export const getInventorySelectedIndex = (ecs: EcsWorld, entityId: EntityId) => ecs.inventorySelected[entityId];

export const setInventorySelectedIndex = (ecs: EcsWorld, entityId: EntityId, index: number) => {
  ecs.inventorySelected[entityId] = index;
};

export const getInventorySlotKindIndex = (ecs: EcsWorld, entityId: EntityId, slotIndex: number) =>
  ecs.inventoryKind[getSlotOffset(entityId, slotIndex)];

export const getInventorySlotQuantity = (ecs: EcsWorld, entityId: EntityId, slotIndex: number) =>
  ecs.inventoryQuantity[getSlotOffset(entityId, slotIndex)];

export const getInventorySlotKind = (ecs: EcsWorld, entityId: EntityId, slotIndex: number): ItemKind | null => {
  const kindIndex = getInventorySlotKindIndex(ecs, entityId, slotIndex);
  return kindIndex === 0 ? null : itemKindFromIndex(kindIndex);
};

export const clearInventorySlot = (ecs: EcsWorld, entityId: EntityId, slotIndex: number) => {
  const offset = getSlotOffset(entityId, slotIndex);
  ecs.inventoryKind[offset] = 0;
  ecs.inventoryQuantity[offset] = 0;
};

export const setInventorySlotQuantity = (ecs: EcsWorld, entityId: EntityId, slotIndex: number, quantity: number) => {
  const offset = getSlotOffset(entityId, slotIndex);
  if (quantity <= 0) {
    ecs.inventoryKind[offset] = 0;
    ecs.inventoryQuantity[offset] = 0;
    return;
  }

  ecs.inventoryQuantity[offset] = quantity;
};

export const addToInventory = (ecs: EcsWorld, entityId: EntityId, kind: ItemKind, amount: number) => {
  if (amount <= 0) {
    return 0;
  }

  let remaining = amount;
  const kindIndex = itemKindToIndex(kind);
  const base = entityId * INVENTORY_SLOT_COUNT;

  const fillSlot = (slotIndex: number, allowEmpty: boolean) => {
    if (remaining <= 0) {
      return;
    }

    const offset = base + slotIndex;
    const slotKind = ecs.inventoryKind[offset];
    if (slotKind === 0) {
      if (!allowEmpty) {
        return;
      }
      ecs.inventoryKind[offset] = kindIndex;
    }

    if (ecs.inventoryKind[offset] !== kindIndex) {
      return;
    }

    const space = STACK_LIMIT - ecs.inventoryQuantity[offset];
    if (space <= 0) {
      return;
    }

    const toAdd = Math.min(space, remaining);
    ecs.inventoryQuantity[offset] += toAdd;
    remaining -= toAdd;
  };

  for (let slotIndex = 0; slotIndex < INVENTORY_SLOT_COUNT; slotIndex += 1) {
    const offset = base + slotIndex;
    if (ecs.inventoryKind[offset] === kindIndex && ecs.inventoryQuantity[offset] < STACK_LIMIT) {
      fillSlot(slotIndex, false);
    }
  }

  for (let slotIndex = 0; slotIndex < INVENTORY_SLOT_COUNT; slotIndex += 1) {
    const offset = base + slotIndex;
    if (ecs.inventoryKind[offset] === 0) {
      fillSlot(slotIndex, true);
    }
  }

  return amount - remaining;
};

export const getTotalOfKind = (ecs: EcsWorld, entityId: EntityId, kind: ItemKind) => {
  const kindIndex = itemKindToIndex(kind);
  const base = entityId * INVENTORY_SLOT_COUNT;
  let total = 0;

  for (let slotIndex = 0; slotIndex < INVENTORY_SLOT_COUNT; slotIndex += 1) {
    const offset = base + slotIndex;
    if (ecs.inventoryKind[offset] === kindIndex) {
      total += ecs.inventoryQuantity[offset];
    }
  }

  return total;
};

export const getAvailableSpace = (ecs: EcsWorld, entityId: EntityId, kind: ItemKind) => {
  const kindIndex = itemKindToIndex(kind);
  const base = entityId * INVENTORY_SLOT_COUNT;
  let space = 0;

  for (let slotIndex = 0; slotIndex < INVENTORY_SLOT_COUNT; slotIndex += 1) {
    const offset = base + slotIndex;
    const slotKind = ecs.inventoryKind[offset];
    if (slotKind === kindIndex) {
      space += STACK_LIMIT - ecs.inventoryQuantity[offset];
      continue;
    }
    if (slotKind === 0) {
      space += STACK_LIMIT;
    }
  }

  return space;
};

export const removeFromInventory = (ecs: EcsWorld, entityId: EntityId, kind: ItemKind, amount: number) => {
  if (amount <= 0) {
    return 0;
  }

  const kindIndex = itemKindToIndex(kind);
  const base = entityId * INVENTORY_SLOT_COUNT;
  let remaining = amount;

  for (let slotIndex = 0; slotIndex < INVENTORY_SLOT_COUNT; slotIndex += 1) {
    if (remaining <= 0) {
      break;
    }

    const offset = base + slotIndex;
    if (ecs.inventoryKind[offset] !== kindIndex) {
      continue;
    }

    const take = Math.min(ecs.inventoryQuantity[offset], remaining);
    ecs.inventoryQuantity[offset] -= take;
    remaining -= take;

    if (ecs.inventoryQuantity[offset] <= 0) {
      ecs.inventoryQuantity[offset] = 0;
      ecs.inventoryKind[offset] = 0;
    }
  }

  return amount - remaining;
};
