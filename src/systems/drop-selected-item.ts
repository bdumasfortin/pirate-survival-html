import { consumeDrop, type InputState } from "../core/input";
import type { GameState } from "../game/state";

export const dropSelectedItem = (state: GameState, input: InputState) => {
  if (!consumeDrop(input)) {
    return;
  }

  const slot = state.inventory.slots[state.inventory.selectedIndex];
  if (!slot || slot.quantity <= 0 || !slot.kind) {
    return;
  }

  slot.quantity -= 1;
  if (slot.quantity <= 0) {
    slot.quantity = 0;
    slot.kind = null;
  }
};
