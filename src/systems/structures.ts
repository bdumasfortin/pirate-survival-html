import type { InputState } from "../core/input";
import { ComponentMask, forEachEntity, isEntityAlive, type EntityId } from "../core/ecs";
import type { GameState } from "../game/state";
import type { ItemKind } from "../game/item-kinds";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity, setInventorySlotQuantity } from "../game/inventory";
import { getStructurePreviewRadius, getStructurePropKind, getStructureSurface, isStructureItem } from "../game/structure-items";
import { spawnProp } from "../game/props";
import { findContainingIsland } from "../world/island-geometry";

const STRUCTURE_PLACEMENT_DISTANCE = 6;

const isPlacementSurfaceValid = (state: GameState, kind: ItemKind, x: number, y: number) => {
  const isOnLand = Boolean(findContainingIsland({ x, y }, state.world.islands));
  const surface = getStructureSurface(kind);
  if (surface === "land") {
    return isOnLand;
  }
  return !isOnLand;
};

const isStructurePlacementValid = (state: GameState, playerId: EntityId, kind: ItemKind, x: number, y: number, radius: number) => {
  const ecs = state.ecs;
  if (ecs.playerIsOnRaft[playerId]) {
    return false;
  }
  if (!isPlacementSurfaceValid(state, kind, x, y)) {
    return false;
  }

  for (const otherId of state.playerIds) {
    if (otherId === playerId || !isEntityAlive(ecs, otherId)) {
      continue;
    }
    const dx = x - ecs.position.x[otherId];
    const dy = y - ecs.position.y[otherId];
    if (Math.hypot(dx, dy) < radius + ecs.radius[otherId]) {
      return false;
    }
  }

  let blocked = false;
  const blockingMask = ComponentMask.Position | ComponentMask.Radius;
  const blockingBits = ComponentMask.Resource | ComponentMask.Prop | ComponentMask.Enemy;
  forEachEntity(ecs, blockingMask, (id) => {
    if (blocked) {
      return;
    }
    if ((ecs.mask[id] & blockingBits) === 0) {
      return;
    }
    const dx = x - ecs.position.x[id];
    const dy = y - ecs.position.y[id];
    if (Math.hypot(dx, dy) < radius + ecs.radius[id]) {
      blocked = true;
    }
  });

  return !blocked;
};

export const updateStructurePlacement = (
  state: GameState,
  playerIndex: number,
  playerId: EntityId,
  input: InputState
) => {
  if (!input.useQueued) {
    return;
  }

  const crafting = state.crafting[playerIndex];
  if (crafting?.isOpen) {
    return;
  }

  const ecs = state.ecs;
  const selectedIndex = getInventorySelectedIndex(ecs, playerId);
  const slotKind = getInventorySlotKind(ecs, playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(ecs, playerId, selectedIndex);
  if (!slotKind || slotQuantity <= 0 || !isStructureItem(slotKind)) {
    return;
  }

  input.useQueued = false;

  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const previewRadius = getStructurePreviewRadius(slotKind);
  const aimAngle = ecs.playerAimAngle[playerId];
  const distance = ecs.radius[playerId] + previewRadius + STRUCTURE_PLACEMENT_DISTANCE;
  const previewX = ecs.position.x[playerId] + Math.cos(aimAngle) * distance;
  const previewY = ecs.position.y[playerId] + Math.sin(aimAngle) * distance;

  if (!isStructurePlacementValid(state, playerId, slotKind, previewX, previewY, previewRadius)) {
    return;
  }

  const propKind = getStructurePropKind(slotKind);
  if (!propKind) {
    return;
  }

  spawnProp(ecs, propKind, { x: previewX, y: previewY }, { radius: previewRadius, rotation: aimAngle });
  setInventorySlotQuantity(ecs, playerId, selectedIndex, slotQuantity - 1);
};
