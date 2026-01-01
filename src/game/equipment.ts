import type { EcsWorld, EntityId } from "../core/ecs";
import { EQUIPMENT_SLOT_COUNT } from "../core/ecs";
import type { ItemKind } from "./item-kinds";
import { itemKindFromIndex, itemKindToIndex } from "./item-kinds";

export type EquipmentSlotType = "helmet" | "cloak" | "chest" | "legs" | "boots" | "ring";

export const EQUIPMENT_SLOT_ORDER: EquipmentSlotType[] = [
  "helmet",
  "cloak",
  "chest",
  "legs",
  "boots",
  "ring"
];

const EQUIPMENT_SLOT_INDEX: Record<EquipmentSlotType, number> = {
  helmet: 0,
  cloak: 1,
  chest: 2,
  legs: 3,
  boots: 4,
  ring: 5
};

const getSlotOffset = (entityId: EntityId, slotIndex: number) => entityId * EQUIPMENT_SLOT_COUNT + slotIndex;

export const getEquipmentSlotForItem = (kind: ItemKind): EquipmentSlotType | null => {
  switch (kind) {
    case "crabhelmet":
      return "helmet";
    case "wolfcloak":
      return "cloak";
    case "krakenring":
      return "ring";
    default:
      return null;
  }
};

export const getEquipmentSlotIndex = (slotType: EquipmentSlotType) => EQUIPMENT_SLOT_INDEX[slotType];

export const getEquipmentSlotKindIndex = (ecs: EcsWorld, entityId: EntityId, slotType: EquipmentSlotType) => {
  const offset = getSlotOffset(entityId, getEquipmentSlotIndex(slotType));
  return ecs.equipmentKind[offset];
};

export const getEquipmentSlotKind = (ecs: EcsWorld, entityId: EntityId, slotType: EquipmentSlotType): ItemKind | null => {
  const kindIndex = getEquipmentSlotKindIndex(ecs, entityId, slotType);
  return kindIndex === 0 ? null : itemKindFromIndex(kindIndex);
};

export const setEquipmentSlotKind = (ecs: EcsWorld, entityId: EntityId, slotType: EquipmentSlotType, kind: ItemKind | null) => {
  const offset = getSlotOffset(entityId, getEquipmentSlotIndex(slotType));
  ecs.equipmentKind[offset] = kind ? itemKindToIndex(kind) : 0;
};

export const getEquippedItemCount = (ecs: EcsWorld, entityId: EntityId) => {
  const base = entityId * EQUIPMENT_SLOT_COUNT;
  let count = 0;

  for (let index = 0; index < EQUIPMENT_SLOT_COUNT; index += 1) {
    if (ecs.equipmentKind[base + index] !== 0) {
      count += 1;
    }
  }

  return count;
};

