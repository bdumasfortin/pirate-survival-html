import type { ResourceKind } from "../world/types";
import { addToInventory, getAvailableSpace, getTotalOfKind, removeFromInventory } from "./inventory";
import type { EcsWorld, EntityId } from "../core/ecs";

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

export const canCraft = (ecs: EcsWorld, entityId: EntityId, recipe: Recipe) =>
  recipe.inputs.every((ingredient) => getTotalOfKind(ecs, entityId, ingredient.kind) >= ingredient.amount) &&
  getAvailableSpace(ecs, entityId, recipe.output.kind) >= recipe.output.amount;

export const craftRecipe = (ecs: EcsWorld, entityId: EntityId, recipe: Recipe) => {
  if (!canCraft(ecs, entityId, recipe)) {
    return false;
  }

  recipe.inputs.forEach((ingredient) => {
    removeFromInventory(ecs, entityId, ingredient.kind, ingredient.amount);
  });

  addToInventory(ecs, entityId, recipe.output.kind, recipe.output.amount);
  return true;
};
