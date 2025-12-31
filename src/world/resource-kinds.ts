import type { ResourceKind, ResourceNodeType } from "./types";

export const RESOURCE_KIND_TO_INDEX: Record<ResourceKind, number> = {
  wood: 1,
  rock: 2,
  berries: 3,
  raft: 4,
  sword: 5,
  crabmeat: 6,
  wolfmeat: 7,
  crabhelmet: 8,
  wolfcloak: 9,
  krakenring: 10
};

const RESOURCE_KIND_BY_INDEX: ResourceKind[] = [
  "wood",
  "rock",
  "berries",
  "raft",
  "sword",
  "crabmeat",
  "wolfmeat",
  "crabhelmet",
  "wolfcloak",
  "krakenring"
];

export const resourceKindToIndex = (kind: ResourceKind) => RESOURCE_KIND_TO_INDEX[kind];

export const resourceKindFromIndex = (index: number): ResourceKind =>
  RESOURCE_KIND_BY_INDEX[index - 1] ?? "wood";

export const RESOURCE_NODE_TYPE_TO_INDEX: Record<ResourceNodeType, number> = {
  tree: 1,
  rock: 2,
  bush: 3
};

const RESOURCE_NODE_TYPE_BY_INDEX: ResourceNodeType[] = ["tree", "rock", "bush"];

export const resourceNodeTypeToIndex = (kind: ResourceNodeType) => RESOURCE_NODE_TYPE_TO_INDEX[kind];

export const resourceNodeTypeFromIndex = (index: number): ResourceNodeType =>
  RESOURCE_NODE_TYPE_BY_INDEX[index - 1] ?? "tree";
