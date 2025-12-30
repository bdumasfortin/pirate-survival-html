import type { ResourceKind } from "../world/types";

export type EquipmentSlotType = "helmet" | "cloak" | "chest" | "legs" | "boots" | "ring";

export type EquipmentState = {
  slots: Record<EquipmentSlotType, ResourceKind | null>;
};

export const EQUIPMENT_SLOT_ORDER: EquipmentSlotType[] = [
  "helmet",
  "cloak",
  "chest",
  "legs",
  "boots",
  "ring"
];

export const createEquipmentState = (): EquipmentState => ({
  slots: {
    helmet: null,
    cloak: null,
    chest: null,
    legs: null,
    boots: null,
    ring: null
  }
});

export const getEquipmentSlotForItem = (kind: ResourceKind): EquipmentSlotType | null => {
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

