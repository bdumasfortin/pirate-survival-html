import { ComponentMask, createEcsWorld, createEntity, EntityTag, type EcsWorld, type EntityId } from "../core/ecs";
import { createRng, type RngState } from "../core/rng";
import { normalizeSeed } from "../core/seed";
import { createCraftingState, type CraftingState } from "./crafting";
import { createEnemies } from "./creatures";
import { addToInventory } from "./inventory";
import { createSurvivalStats } from "./survival";
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
  playerIds: EntityId[];
  localPlayerIndex: number;
  world: WorldState;
  rng: RngState;
  crafting: CraftingState[];
  attackEffects: Array<AttackEffect | null>;
};

const seedDevInventory = (ecs: EcsWorld, playerId: EntityId) => {
  addToInventory(ecs, playerId, "raft", 1);
  addToInventory(ecs, playerId, "sword", 1);
  addToInventory(ecs, playerId, "crabhelmet", 1);
  addToInventory(ecs, playerId, "wolfcloak", 1);
  addToInventory(ecs, playerId, "krakenring", 1);
};

export const createInitialState = (seed: string | number, playerCount = 1, localPlayerIndex = 0): GameState => {
  const clampedPlayerCount = Math.max(1, Math.floor(playerCount));
  const clampedLocalIndex = Math.max(0, Math.min(localPlayerIndex, clampedPlayerCount - 1));
  const ecs = createEcsWorld();
  const playerMask = ComponentMask.Position |
    ComponentMask.PrevPosition |
    ComponentMask.Velocity |
    ComponentMask.Radius |
    ComponentMask.Tag |
    ComponentMask.Inventory |
    ComponentMask.Equipment;
  const playerIds: EntityId[] = [];
  const craftingStates: CraftingState[] = [];
  const attackEffects: Array<AttackEffect | null> = [];
  const spawnRadius = clampedPlayerCount > 1 ? 28 : 0;

  for (let index = 0; index < clampedPlayerCount; index += 1) {
    const playerId = createEntity(ecs, playerMask, EntityTag.Player);
    const angle = clampedPlayerCount > 1 ? (index / clampedPlayerCount) * Math.PI * 2 : 0;
    const spawnX = Math.cos(angle) * spawnRadius;
    const spawnY = Math.sin(angle) * spawnRadius;
    ecs.position.x[playerId] = spawnX;
    ecs.position.y[playerId] = spawnY;
    ecs.prevPosition.x[playerId] = spawnX;
    ecs.prevPosition.y[playerId] = spawnY;
    ecs.velocity.x[playerId] = 0;
    ecs.velocity.y[playerId] = 0;
    ecs.radius[playerId] = 14;
    ecs.inventorySelected[playerId] = 0;
    ecs.playerAimAngle[playerId] = 0;
    ecs.playerMoveAngle[playerId] = 0;
    ecs.playerDamageFlashTimer[playerId] = 0;
    ecs.playerAttackTimer[playerId] = 0;
    ecs.playerUseCooldown[playerId] = 0;
    ecs.playerRespawnTimer[playerId] = 0;
    ecs.playerIsDead[playerId] = 0;
    ecs.playerIsOnRaft[playerId] = 0;

    const survival = createSurvivalStats();
    ecs.playerHealth[playerId] = survival.health;
    ecs.playerMaxHealth[playerId] = survival.maxHealth;
    ecs.playerHunger[playerId] = survival.hunger;
    ecs.playerMaxHunger[playerId] = survival.maxHunger;
    ecs.playerArmor[playerId] = survival.armor;
    ecs.playerMaxArmor[playerId] = survival.maxArmor;
    ecs.playerArmorRegenTimer[playerId] = survival.armorRegenTimer;

    if (import.meta.env.DEV) {
      seedDevInventory(ecs, playerId);
    }

    playerIds.push(playerId);
    craftingStates.push(createCraftingState());
    attackEffects.push(null);
  }

  const normalizedSeed = normalizeSeed(seed);
  const world = createWorld(normalizedSeed);
  const rng = createRng(normalizedSeed);
  spawnWorldResources(ecs, world);
  createEnemies(ecs, world, rng);

  return {
    time: 0,
    ecs,
    playerIds,
    localPlayerIndex: clampedLocalIndex,
    world,
    rng,
    crafting: craftingStates,
    attackEffects
  };
};

