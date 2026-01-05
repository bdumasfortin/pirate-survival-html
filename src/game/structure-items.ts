import type { ItemKind } from "./item-kinds";
import type { PropKind } from "./prop-kinds";

export type StructurePlacementSurface = "land" | "water";

export type StructureItemConfig = {
  previewRadius: number;
  surface: StructurePlacementSurface;
  propKind?: PropKind;
};

const STRUCTURE_ITEM_CONFIG: Partial<Record<ItemKind, StructureItemConfig>> = {
  raft: {
    previewRadius: 22,
    surface: "water",
    propKind: "raft",
  },
};

export const getStructureConfig = (kind: ItemKind) => STRUCTURE_ITEM_CONFIG[kind] ?? null;

export const isStructureItem = (kind: ItemKind | null): kind is ItemKind => Boolean(kind && getStructureConfig(kind));

export const getStructurePreviewRadius = (kind: ItemKind) => getStructureConfig(kind)?.previewRadius ?? 24;

export const getStructureSurface = (kind: ItemKind) => getStructureConfig(kind)?.surface ?? "land";

export const getStructurePropKind = (kind: ItemKind) => getStructureConfig(kind)?.propKind ?? null;
