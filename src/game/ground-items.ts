import type { Vec2 } from "../core/types";
import type { EcsWorld } from "../core/ecs";
import { ComponentMask, createEntity, EntityTag } from "../core/ecs";
import type { ResourceKind } from "../world/types";
import { resourceKindToIndex } from "../world/resource-kinds";

export const GROUND_ITEM_MASK = ComponentMask.GroundItem | ComponentMask.Position | ComponentMask.Tag;

export const spawnGroundItem = (
  ecs: EcsWorld,
  kind: ResourceKind,
  quantity: number,
  position: Vec2,
  droppedAt: number
) => {
  const id = createEntity(ecs, GROUND_ITEM_MASK, EntityTag.GroundItem);
  ecs.position.x[id] = position.x;
  ecs.position.y[id] = position.y;
  ecs.groundItemKind[id] = resourceKindToIndex(kind);
  ecs.groundItemQuantity[id] = quantity;
  ecs.groundItemDroppedAt[id] = droppedAt;
  return id;
};
