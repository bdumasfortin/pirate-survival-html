import type { Entity } from "./entities";
import { createCraftingState, type CraftingState } from "./crafting";
import { createCrabs, type Crab } from "./creatures";
import type { Enemy } from "./enemies";
import { createInventory, type InventoryState } from "./inventory";
import { createRaftState, type RaftState } from "./raft";
import { createSurvivalStats, type SurvivalStats } from "./survival";
import { createWorld, type WorldState } from "../world/world";
import type { Vec2 } from "../core/types";

export type AttackEffect = {
  origin: Vec2;
  angle: number;
  radius: number;
  spread: number;
  timer: number;
  duration: number;
};

export type GameState = {
  time: number;
  entities: Entity[];
  playerId: number;
  world: WorldState;
  inventory: InventoryState;
  survival: SurvivalStats;
  crafting: CraftingState;
  raft: RaftState;
  crabs: Crab[];
  enemies: Enemy[];
  attackEffect: AttackEffect | null;
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

  const world = createWorld();
  const crabs = createCrabs(world);
  const inventory = createInventory();
  inventory.slots[0] = { kind: "sword", quantity: 1 };
  inventory.slots[1] = { kind: "raft", quantity: 1 };

  return {
    time: 0,
    entities: [player],
    playerId: player.id,
    world,
    inventory,
    survival: createSurvivalStats(),
    crafting: createCraftingState(),
    raft: createRaftState(),
    crabs,
    enemies: crabs,
    attackEffect: null
  };
};

