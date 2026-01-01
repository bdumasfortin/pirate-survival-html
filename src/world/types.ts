import type { Vec2 } from "../core/types";

export type IslandType = "standard" | "forest" | "beach" | "wolfBoss";

export type Island = {
  center: Vec2;
  points: Vec2[];
  type: IslandType;
  seed: number;
};

export type ResourceNodeType = "tree" | "rock" | "bush";

export type YieldRange = {
  min: number;
  max: number;
};

export type WorldState = {
  islands: Island[];
};
