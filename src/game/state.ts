import type { Entity } from "./entities";
import { createInventory, type InventoryState } from "./inventory";
import { createWorld, type WorldState } from "../world/world";

export type GameState = {
  time: number;
  entities: Entity[];
  playerId: number;
  world: WorldState;
  inventory: InventoryState;
};

export const createInitialState = (): GameState => {
  const player: Entity = {
    id: 1,
    position: { x: 0, y: 0 },
    prevPosition: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    radius: 14,
    tag: "player"
  };

  return {
    time: 0,
    entities: [player],
    playerId: player.id,
    world: createWorld(),
    inventory: createInventory()
  };
};
