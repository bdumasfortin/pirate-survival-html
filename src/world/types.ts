import type { Vec2 } from "../core/types";

export type IslandType = "standard" | "forest" | "beach";

export type Island = {
  center: Vec2;
  points: Vec2[];
  type: IslandType;
};

export type ResourceKind = "wood" | "rock" | "berries" | "raft" | "sword" | "crabmeat" | "crabhelmet" | "wolfcloak" | "krakenring";
export type ResourceNodeType = "tree" | "rock" | "bush";

export type YieldRange = {
  min: number;
  max: number;
};

export type ResourceNode = {
  id: number;
  nodeType: ResourceNodeType;
  kind: ResourceKind;
  position: Vec2;
  rotation: number;
  radius: number;
  yield: YieldRange;
  remaining: number;
  respawnTime: number;
  respawnTimer: number;
};

export type WorldState = {
  islands: Island[];
  resources: ResourceNode[];
};
