import { recipes } from "../game/crafting";
import type { GameState } from "../game/state";
import {
  CRAFT_BUTTON_HEIGHT,
  CRAFT_BUTTON_WIDTH,
  CRAFT_INGREDIENT_ROW_HEIGHT,
  CRAFT_PANEL_GAP,
  CRAFT_PANEL_PADDING,
  CRAFT_PANEL_SECTION_GAP,
  CRAFT_PANEL_WIDTH,
  CRAFT_TILE_GAP,
  CRAFT_TILE_SIZE,
} from "./ui-config";

export type CraftButtonRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CraftingLayout = {
  rowX: number;
  rowY: number;
  rowWidth: number;
  rowHeight: number;
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  button: CraftButtonRect;
  selectedIndex: number;
};

export const getCraftingLayout = (
  state: GameState,
  screenWidth: number,
  screenHeight: number
): CraftingLayout | null => {
  const crafting = state.crafting[state.localPlayerIndex];
  if (!crafting?.isOpen || recipes.length === 0) {
    return null;
  }

  const totalWidth = recipes.length * CRAFT_TILE_SIZE + (recipes.length - 1) * CRAFT_TILE_GAP;
  const rowX = (screenWidth - totalWidth) / 2;
  const rowY = screenHeight / 2 - CRAFT_TILE_SIZE / 2;
  const rowWidth = totalWidth;
  const rowHeight = CRAFT_TILE_SIZE;

  const selectedIndex = Math.max(0, Math.min(crafting.selectedIndex, recipes.length - 1));
  const selectedRecipe = recipes[selectedIndex];
  const ingredientCount = selectedRecipe?.inputs.length ?? 0;
  const listHeight = ingredientCount > 0 ? ingredientCount * CRAFT_INGREDIENT_ROW_HEIGHT : 0;
  const panelWidth = Math.max(CRAFT_PANEL_WIDTH, CRAFT_TILE_SIZE + CRAFT_PANEL_PADDING * 2);
  const panelHeight =
    CRAFT_PANEL_PADDING * 2 + listHeight + (ingredientCount > 0 ? CRAFT_PANEL_SECTION_GAP : 0) + CRAFT_BUTTON_HEIGHT;
  const panelX = (screenWidth - panelWidth) / 2;
  const panelY = rowY + rowHeight + CRAFT_PANEL_GAP;
  const buttonX = panelX + (panelWidth - CRAFT_BUTTON_WIDTH) / 2;
  const buttonY = panelY + panelHeight - CRAFT_PANEL_PADDING - CRAFT_BUTTON_HEIGHT;

  return {
    rowX,
    rowY,
    rowWidth,
    rowHeight,
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    button: {
      x: buttonX,
      y: buttonY,
      width: CRAFT_BUTTON_WIDTH,
      height: CRAFT_BUTTON_HEIGHT,
    },
    selectedIndex,
  };
};
