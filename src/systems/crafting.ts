import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import { consumeCraftIndex, consumeToggleCraft } from "../core/input";
import { craftRecipe, recipes } from "../game/crafting";

export const updateCrafting = (state: GameState, input: InputState) => {
  if (consumeToggleCraft(input)) {
    state.crafting.isOpen = !state.crafting.isOpen;
  }

  const craftIndex = consumeCraftIndex(input);
  if (craftIndex === null || !state.crafting.isOpen) {
    return;
  }

  const recipe = recipes[craftIndex];
  if (!recipe) {
    return;
  }

  craftRecipe(state.inventory, recipe);
};
