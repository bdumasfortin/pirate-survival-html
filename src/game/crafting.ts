import type { InventoryState } from "./inventory";
import type { ResourceKind } from "../world/types";
import { addToInventory, getAvailableSpace, getTotalOfKind, removeFromInventory } from "./inventory";

export type RecipeIngredient = {
  kind: ResourceKind;
  amount: number;
};

export type Recipe = {
  id: string;
  name: string;
  inputs: RecipeIngredient[];
  output: RecipeIngredient;
};

export type CraftingState = {
  isOpen: boolean;
  selectedIndex: number;
};

export const createCraftingState = (): CraftingState => ({
  isOpen: false,
  selectedIndex: 0
});

export const recipes: Recipe[] = [
  {
    id: "raft",
    name: "Raft",
    inputs: [
      { kind: "wood", amount: 8 },
      { kind: "rock", amount: 2 }
    ],
    output: { kind: "raft", amount: 1 }
  },
  {
    id: "sword",
    name: "Sword",
    inputs: [
      { kind: "rock", amount: 4 },
      { kind: "wood", amount: 2 }
    ],
    output: { kind: "sword", amount: 1 }
  }
];

export const canCraft = (inventory: InventoryState, recipe: Recipe) =>
  recipe.inputs.every((ingredient) => getTotalOfKind(inventory, ingredient.kind) >= ingredient.amount) &&
  getAvailableSpace(inventory, recipe.output.kind) >= recipe.output.amount;

export const craftRecipe = (inventory: InventoryState, recipe: Recipe) => {
  if (!canCraft(inventory, recipe)) {
    return false;
  }

  recipe.inputs.forEach((ingredient) => {
    removeFromInventory(inventory, ingredient.kind, ingredient.amount);
  });

  addToInventory(inventory, recipe.output.kind, recipe.output.amount);
  return true;
};
