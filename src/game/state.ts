import { createEcsWorld, createEntity, type EcsWorld, type EntityId } from "../core/ecs";
import { createCraftingState, type CraftingState } from "./crafting";
import { createEnemies } from "./creatures";
import type { Enemy } from "./enemies";
import type { GroundItem } from "./ground-items";
import { addToInventory, createInventory, type InventoryState } from "./inventory";
import { createEquipmentState, type EquipmentState } from "./equipment";
import { createRaftState, type RaftState } from "./raft";
import { createSurvivalStats, type SurvivalStats } from "./survival";
import { createWorld } from "../world/world";
import type { WorldState } from "../world/types";
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
  ecs: EcsWorld;
  playerId: EntityId;
  world: WorldState;
  inventory: InventoryState;
  equipment: EquipmentState;
  survival: SurvivalStats;
  crafting: CraftingState;
  raft: RaftState;
  isDead: boolean;
  aimAngle: number;
  moveAngle: number;
  damageFlashTimer: number;
  enemies: Enemy[];
  groundItems: GroundItem[];
  nextGroundItemId: number;
  attackEffect: AttackEffect | null;
};

const seedDevInventory = (inventory: InventoryState) => {
  addToInventory(inventory, "raft", 1);
  addToInventory(inventory, "sword", 1);
  addToInventory(inventory, "crabhelmet", 1);
  addToInventory(inventory, "wolfcloak", 1);
  addToInventory(inventory, "krakenring", 1);
};

export const createInitialState = (seed: string | number): GameState => {
  const ecs = createEcsWorld();
  const playerId = createEntity(ecs);
  ecs.position.x[playerId] = 0;
  ecs.position.y[playerId] = 0;
  ecs.prevPosition.x[playerId] = 0;
  ecs.prevPosition.y[playerId] = 0;
  ecs.velocity.x[playerId] = 0;
  ecs.velocity.y[playerId] = 0;
  ecs.radius[playerId] = 14;

  const world = createWorld(seed);
  const enemies = createEnemies(world);
  const inventory = createInventory();

  if (import.meta.env.DEV) {
    seedDevInventory(inventory);
  }

  return {
    time: 0,
    ecs,
    playerId,
    world,
    inventory,
    equipment: createEquipmentState(),
    survival: createSurvivalStats(),
    crafting: createCraftingState(),
    raft: createRaftState(),
    isDead: false,
    aimAngle: 0,
    moveAngle: 0,
    damageFlashTimer: 0,
    enemies,
    groundItems: [],
    nextGroundItemId: 1,
    attackEffect: null
  };
};

