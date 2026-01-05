export type ItemKind =
  | "wood"
  | "rock"
  | "berries"
  | "raft"
  | "sword"
  | "crabmeat"
  | "wolfmeat"
  | "crabhelmet"
  | "wolfcloak"
  | "krakenring";

export const ITEM_KIND_TO_INDEX: Record<ItemKind, number> = {
  wood: 1,
  rock: 2,
  berries: 3,
  raft: 4,
  sword: 5,
  crabmeat: 6,
  wolfmeat: 7,
  crabhelmet: 8,
  wolfcloak: 9,
  krakenring: 10,
};

const ITEM_KIND_BY_INDEX: ItemKind[] = [
  "wood",
  "rock",
  "berries",
  "raft",
  "sword",
  "crabmeat",
  "wolfmeat",
  "crabhelmet",
  "wolfcloak",
  "krakenring",
];

export const itemKindToIndex = (kind: ItemKind) => ITEM_KIND_TO_INDEX[kind];

export const itemKindFromIndex = (index: number): ItemKind => ITEM_KIND_BY_INDEX[index - 1] ?? "wood";
