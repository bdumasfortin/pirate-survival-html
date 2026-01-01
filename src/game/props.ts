import type { Vec2 } from "../core/types";
import { ComponentMask, createEntity, EntityTag, type EcsWorld } from "../core/ecs";
import type { PropKind } from "./prop-kinds";
import { propKindToIndex } from "./prop-kinds";

export const PROP_MASK = ComponentMask.Prop | ComponentMask.Position | ComponentMask.Tag;

export const spawnProp = (ecs: EcsWorld, kind: PropKind, position: Vec2) => {
  const id = createEntity(ecs, PROP_MASK, EntityTag.Prop);
  ecs.position.x[id] = position.x;
  ecs.position.y[id] = position.y;
  ecs.propKind[id] = propKindToIndex(kind);
  return id;
};
