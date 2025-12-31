import { consumeDrop, type InputState } from "../core/input";
import type { GameState } from "../game/state";
import { isEntityAlive } from "../core/ecs";
import { GROUND_ITEM_DROP_OFFSET } from "../game/ground-items-config";

export const dropSelectedItem = (state: GameState, input: InputState) => {
  if (!consumeDrop(input)) {
    return;
  }

  const slot = state.inventory.slots[state.inventory.selectedIndex];
  if (!slot || slot.quantity <= 0 || !slot.kind) {
    return;
  }

  const playerId = state.playerId;
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const angle = state.aimAngle;
  const offset = GROUND_ITEM_DROP_OFFSET;
  state.groundItems.push({
    id: state.nextGroundItemId++,
    kind: slot.kind,
    quantity: 1,
    position: {
      x: ecs.position.x[playerId] + Math.cos(angle) * offset,
      y: ecs.position.y[playerId] + Math.sin(angle) * offset
    },
    droppedAt: state.time
  });

  slot.quantity -= 1;
  if (slot.quantity <= 0) {
    slot.quantity = 0;
    slot.kind = null;
  }
};
