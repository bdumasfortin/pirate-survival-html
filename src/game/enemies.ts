import type { Vec2 } from "../core/types";

export type Enemy = {
  id: number;
  kind: "crab" | "wolf" | "kraken";
  isBoss?: boolean;
  position: Vec2;
  homePosition?: Vec2;
  velocity?: Vec2;
  radius: number;
  health: number;
  maxHealth: number;
  hitTimer: number;
};
