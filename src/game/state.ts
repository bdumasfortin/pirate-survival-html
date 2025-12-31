import { ComponentMask, createEcsWorld, createEntity, EntityTag, type EcsWorld, type EntityId } from "../core/ecs";
import { createRng, type RngState } from "../core/rng";
import { normalizeSeed } from "../core/seed";
import { createCraftingState, type CraftingState } from "./crafting";
import { createEnemies } from "./creatures";
import { addToInventory } from "./inventory";
import { createRaftState, type RaftState } from "./raft";
import { createSurvivalStats, type SurvivalStats } from "./survival";
import { createWorld, spawnWorldResources } from "../world/world";
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
  rng: RngState;
  survival: SurvivalStats;
  crafting: CraftingState;
  raft: RaftState;
  isDead: boolean;
  aimAngle: number;
  moveAngle: number;
  damageFlashTimer: number;
  playerAttackTimer: number;
  useCooldown: number;
  attackEffect: AttackEffect | null;
};

const seedDevInventory = (ecs: EcsWorld, playerId: EntityId) => {
  addToInventory(ecs, playerId, "raft", 1);
  addToInventory(ecs, playerId, "sword", 1);
  addToInventory(ecs, playerId, "crabhelmet", 1);
  addToInventory(ecs, playerId, "wolfcloak", 1);
  addToInventory(ecs, playerId, "krakenring", 1);
};

export const createInitialState = (seed: string | number): GameState => {
  const ecs = createEcsWorld();
  const playerMask = ComponentMask.Position |
    ComponentMask.PrevPosition |
    ComponentMask.Velocity |
    ComponentMask.Radius |
    ComponentMask.Tag |
    ComponentMask.Inventory |
    ComponentMask.Equipment;
  const playerId = createEntity(ecs, playerMask, EntityTag.Player);
  ecs.position.x[playerId] = 0;
  ecs.position.y[playerId] = 0;
  ecs.prevPosition.x[playerId] = 0;
  ecs.prevPosition.y[playerId] = 0;
  ecs.velocity.x[playerId] = 0;
  ecs.velocity.y[playerId] = 0;
  ecs.radius[playerId] = 14;
  ecs.inventorySelected[playerId] = 0;

  const normalizedSeed = normalizeSeed(seed);
  const world = createWorld(normalizedSeed);
  const rng = createRng(normalizedSeed);
  spawnWorldResources(ecs, world);
  createEnemies(ecs, world, rng);

  if (import.meta.env.DEV) {
    seedDevInventory(ecs, playerId);
  }

  return {
    time: 0,
    ecs,
    playerId,
    world,
    rng,
    survival: createSurvivalStats(),
    crafting: createCraftingState(),
    raft: createRaftState(),
    isDead: false,
    aimAngle: 0,
    moveAngle: 0,
    damageFlashTimer: 0,
    playerAttackTimer: 0,
    useCooldown: 0,
    attackEffect: null
  };
};

