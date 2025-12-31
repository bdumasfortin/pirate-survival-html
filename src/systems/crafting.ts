import type { InputState } from "../core/input";
import type { GameState } from "../game/state";
import { consumeCraftIndex, consumeCraftScroll, consumeCloseCraft, consumeToggleCraft, consumeUse } from "../core/input";
import { craftRecipe, recipes } from "../game/crafting";
import type { EntityId } from "../core/ecs";

const clampIndex = (index: number, length: number) => {
  if (length <= 0) {
    return 0;
  }
  return (index + length) % length;
};

export const updateCrafting = (state: GameState, playerIndex: number, playerId: EntityId, input: InputState) => {
  const crafting = state.crafting[playerIndex];
  if (!crafting) {
    consumeCloseCraft(input);
    consumeToggleCraft(input);
    consumeCraftIndex(input);
    consumeCraftScroll(input);
    consumeUse(input);
    return;
  }

  if (consumeCloseCraft(input) && crafting.isOpen) {
    crafting.isOpen = false;
    return;
  }

  if (consumeToggleCraft(input)) {
    crafting.isOpen = !crafting.isOpen;
    if (crafting.isOpen) {
      crafting.selectedIndex = clampIndex(crafting.selectedIndex, recipes.length);
    }
  }

  if (!crafting.isOpen) {
    return;
  }

  const craftIndex = consumeCraftIndex(input);
  if (craftIndex !== null) {
    crafting.selectedIndex = clampIndex(craftIndex, recipes.length);
  }

  const scrollDelta = consumeCraftScroll(input);
  if (scrollDelta !== 0) {
    crafting.selectedIndex = clampIndex(crafting.selectedIndex + scrollDelta, recipes.length);
  }

  if (!consumeUse(input)) {
    return;
  }

  const recipe = recipes[crafting.selectedIndex];
  if (!recipe) {
    return;
  }

  craftRecipe(state.ecs, playerId, recipe);
};
