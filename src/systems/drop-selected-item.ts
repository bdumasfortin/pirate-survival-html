import { type EntityId, isEntityAlive } from "../core/ecs";
import { consumeDrop, type InputState } from "../core/input";
import { spawnGroundItem } from "../game/ground-items";
import { GROUND_ITEM_DROP_OFFSET } from "../game/ground-items-config";
import {
  clearInventorySlot,
  getInventorySelectedIndex,
  getInventorySlotKind,
  getInventorySlotQuantity,
  setInventorySlotQuantity,
} from "../game/inventory";
import type { GameState } from "../game/state";

export const dropSelectedItem = (state: GameState, playerId: EntityId, input: InputState) => {
  if (!consumeDrop(input)) {
    return;
  }

  const selectedIndex = getInventorySelectedIndex(state.ecs, playerId);
  const slotKind = getInventorySlotKind(state.ecs, playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(state.ecs, playerId, selectedIndex);
  if (!slotKind || slotQuantity <= 0) {
    return;
  }

  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const angle = ecs.playerAimAngle[playerId];
  const offset = GROUND_ITEM_DROP_OFFSET;
  spawnGroundItem(
    ecs,
    slotKind,
    1,
    {
      x: ecs.position.x[playerId] + Math.cos(angle) * offset,
      y: ecs.position.y[playerId] + Math.sin(angle) * offset,
    },
    state.time
  );

  const remaining = slotQuantity - 1;
  if (remaining <= 0) {
    clearInventorySlot(ecs, playerId, selectedIndex);
  } else {
    setInventorySlotQuantity(ecs, playerId, selectedIndex, remaining);
  }
};
