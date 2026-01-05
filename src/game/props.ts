import { ComponentMask, createEntity, type EcsWorld, EntityTag } from "../core/ecs";
import type { Vec2 } from "../core/types";
import type { PropKind } from "./prop-kinds";
import { propKindToIndex } from "./prop-kinds";

export const PROP_MASK = ComponentMask.Prop | ComponentMask.Position | ComponentMask.Tag;
export const PROP_MASK_WITH_RADIUS = PROP_MASK | ComponentMask.Radius;

export const spawnProp = (
  ecs: EcsWorld,
  kind: PropKind,
  position: Vec2,
  options: { radius?: number; rotation?: number } = {}
) => {
  const mask = options.radius !== undefined ? PROP_MASK_WITH_RADIUS : PROP_MASK;
  const id = createEntity(ecs, mask, EntityTag.Prop);
  ecs.position.x[id] = position.x;
  ecs.position.y[id] = position.y;
  if (options.radius !== undefined) {
    ecs.radius[id] = options.radius;
  }
  if (options.rotation !== undefined) {
    ecs.resourceRotation[id] = options.rotation;
  }
  ecs.propKind[id] = propKindToIndex(kind);
  return id;
};
