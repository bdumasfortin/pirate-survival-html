import type { ResourceNodeType } from "./types";

export const RESOURCE_NODE_TYPE_TO_INDEX: Record<ResourceNodeType, number> = {
  tree: 1,
  rock: 2,
  bush: 3,
};

const RESOURCE_NODE_TYPE_BY_INDEX: ResourceNodeType[] = ["tree", "rock", "bush"];

export const resourceNodeTypeToIndex = (kind: ResourceNodeType) => RESOURCE_NODE_TYPE_TO_INDEX[kind];

export const resourceNodeTypeFromIndex = (index: number): ResourceNodeType =>
  RESOURCE_NODE_TYPE_BY_INDEX[index - 1] ?? "tree";
