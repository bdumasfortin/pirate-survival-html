import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import { consumeCraftIndex, consumeCraftScroll, consumeCloseCraft, consumeToggleCraft, consumeUse } from "../core/input";
import { craftRecipe, recipes } from "../game/crafting";

const clampIndex = (index: number, length: number) => {
  if (length <= 0) {
    return 0;
  }
  return (index + length) % length;
};

export const updateCrafting = (state: GameState, input: InputState) => {
  if (consumeCloseCraft(input) && state.crafting.isOpen) {
    state.crafting.isOpen = false;
    return;
  }

  if (consumeToggleCraft(input)) {
    state.crafting.isOpen = !state.crafting.isOpen;
    if (state.crafting.isOpen) {
      state.crafting.selectedIndex = clampIndex(state.crafting.selectedIndex, recipes.length);
    }
  }

  if (!state.crafting.isOpen) {
    return;
  }

  const craftIndex = consumeCraftIndex(input);
  if (craftIndex !== null) {
    state.crafting.selectedIndex = clampIndex(craftIndex, recipes.length);
  }

  const scrollDelta = consumeCraftScroll(input);
  if (scrollDelta !== 0) {
    state.crafting.selectedIndex = clampIndex(state.crafting.selectedIndex + scrollDelta, recipes.length);
  }

  if (!consumeUse(input)) {
    return;
  }

  const recipe = recipes[state.crafting.selectedIndex];
  if (!recipe) {
    return;
  }

  craftRecipe(state.inventory, recipe);
};
