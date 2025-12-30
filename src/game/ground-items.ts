import type { Vec2 } from "../core/types";
import type { ResourceKind } from "../world/types";

export type GroundItem = {
  id: number;
  kind: ResourceKind;
  position: Vec2;
  quantity: number;
  droppedAt: number;
};
