import { consumeDrop, type InputState } from "../core/input";
import type { GameState } from "../game/state";
import { GROUND_ITEM_DROP_OFFSET } from "../game/ground-items-config";

export const dropSelectedItem = (state: GameState, input: InputState) => {
  if (!consumeDrop(input)) {
    return;
  }

  const slot = state.inventory.slots[state.inventory.selectedIndex];
  if (!slot || slot.quantity <= 0 || !slot.kind) {
    return;
  }

  const player = state.entities.find((entity) => entity.id === state.playerId);
  if (!player) {
    return;
  }

  const angle = state.aimAngle;
  const offset = GROUND_ITEM_DROP_OFFSET;
  state.groundItems.push({
    id: state.nextGroundItemId++,
    kind: slot.kind,
    quantity: 1,
    position: {
      x: player.position.x + Math.cos(angle) * offset,
      y: player.position.y + Math.sin(angle) * offset
    },
    droppedAt: state.time
  });

  slot.quantity -= 1;
  if (slot.quantity <= 0) {
    slot.quantity = 0;
    slot.kind = null;
  }
};
