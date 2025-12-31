import type { InputState } from "../core/input";
import { consumeInventoryIndex, consumeInventoryScroll } from "../core/input";
import { INVENTORY_SLOT_COUNT, isEntityAlive, type EntityId } from "../core/ecs";
import type { GameState } from "../game/state";

const clampIndex = (index: number, length: number) => {
  if (length <= 0) {
    return 0;
  }
  return (index + length) % length;
};

export const updateInventorySelection = (state: GameState, playerId: EntityId, input: InputState) => {
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    consumeInventoryIndex(input);
    consumeInventoryScroll(input);
    return;
  }

  const directIndex = consumeInventoryIndex(input);
  const scrollDelta = consumeInventoryScroll(input);

  if (directIndex !== null) {
    ecs.inventorySelected[playerId] = clampIndex(directIndex, INVENTORY_SLOT_COUNT);
    return;
  }

  if (scrollDelta !== 0) {
    ecs.inventorySelected[playerId] = clampIndex(ecs.inventorySelected[playerId] + scrollDelta, INVENTORY_SLOT_COUNT);
  }
};
