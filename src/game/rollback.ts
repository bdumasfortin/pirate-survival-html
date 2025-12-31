import type { EntityId, EcsSnapshot } from "../core/ecs";
import { createEcsSnapshot, restoreEcsSnapshot } from "../core/ecs";
import type { CraftingState } from "./crafting";
import type { RaftState } from "./raft";
import type { AttackEffect, GameState } from "./state";
import type { SurvivalStats } from "./survival";
import type { WorldState } from "../world/types";

export type GameStateSnapshot = {
  time: number;
  ecs: EcsSnapshot;
  playerId: EntityId;
  world: WorldState;
  rngState: number;
  survival: SurvivalStats;
  crafting: CraftingState;
  raft: RaftState;
  isDead: boolean;
  aimAngle: number;
  moveAngle: number;
  damageFlashTimer: number;
  attackEffect: AttackEffect | null;
  playerAttackTimer: number;
  useCooldown: number;
};

export type RollbackBuffer = {
  capacity: number;
  frames: Int32Array;
  snapshots: Array<GameStateSnapshot | null>;
};

const cloneAttackEffect = (effect: AttackEffect | null): AttackEffect | null => {
  if (!effect) {
    return null;
  }

  return {
    origin: { x: effect.origin.x, y: effect.origin.y },
    angle: effect.angle,
    radius: effect.radius,
    spread: effect.spread,
    timer: effect.timer,
    duration: effect.duration
  };
};

const cloneSurvival = (stats: SurvivalStats): SurvivalStats => ({
  health: stats.health,
  hunger: stats.hunger,
  maxHealth: stats.maxHealth,
  maxHunger: stats.maxHunger,
  armor: stats.armor,
  maxArmor: stats.maxArmor,
  armorRegenTimer: stats.armorRegenTimer
});

const cloneCrafting = (crafting: CraftingState): CraftingState => ({
  isOpen: crafting.isOpen,
  selectedIndex: crafting.selectedIndex
});

const cloneRaft = (raft: RaftState): RaftState => ({
  isOnRaft: raft.isOnRaft
});

const applySurvival = (target: SurvivalStats, source: SurvivalStats) => {
  target.health = source.health;
  target.hunger = source.hunger;
  target.maxHealth = source.maxHealth;
  target.maxHunger = source.maxHunger;
  target.armor = source.armor;
  target.maxArmor = source.maxArmor;
  target.armorRegenTimer = source.armorRegenTimer;
};

const applyCrafting = (target: CraftingState, source: CraftingState) => {
  target.isOpen = source.isOpen;
  target.selectedIndex = source.selectedIndex;
};

const applyRaft = (target: RaftState, source: RaftState) => {
  target.isOnRaft = source.isOnRaft;
};

export const createGameStateSnapshot = (state: GameState): GameStateSnapshot => ({
  time: state.time,
  ecs: createEcsSnapshot(state.ecs),
  playerId: state.playerId,
  world: state.world,
  rngState: state.rng.state,
  survival: cloneSurvival(state.survival),
  crafting: cloneCrafting(state.crafting),
  raft: cloneRaft(state.raft),
  isDead: state.isDead,
  aimAngle: state.aimAngle,
  moveAngle: state.moveAngle,
  damageFlashTimer: state.damageFlashTimer,
  attackEffect: cloneAttackEffect(state.attackEffect),
  playerAttackTimer: state.playerAttackTimer,
  useCooldown: state.useCooldown
});

export const restoreGameStateSnapshot = (state: GameState, snapshot: GameStateSnapshot) => {
  state.time = snapshot.time;
  state.playerId = snapshot.playerId;
  state.world = snapshot.world;
  state.rng.state = snapshot.rngState;
  applySurvival(state.survival, snapshot.survival);
  applyCrafting(state.crafting, snapshot.crafting);
  applyRaft(state.raft, snapshot.raft);
  state.isDead = snapshot.isDead;
  state.aimAngle = snapshot.aimAngle;
  state.moveAngle = snapshot.moveAngle;
  state.damageFlashTimer = snapshot.damageFlashTimer;
  state.attackEffect = cloneAttackEffect(snapshot.attackEffect);
  state.playerAttackTimer = snapshot.playerAttackTimer;
  state.useCooldown = snapshot.useCooldown;
  restoreEcsSnapshot(state.ecs, snapshot.ecs);
};

export const createRollbackBuffer = (capacity: number): RollbackBuffer => {
  const frames = new Int32Array(capacity);
  frames.fill(-1);
  return {
    capacity,
    frames,
    snapshots: Array.from({ length: capacity }, () => null)
  };
};

export const storeRollbackSnapshot = (buffer: RollbackBuffer, frame: number, state: GameState) => {
  const index = frame % buffer.capacity;
  buffer.frames[index] = frame;
  buffer.snapshots[index] = createGameStateSnapshot(state);
};

export const getRollbackSnapshot = (buffer: RollbackBuffer, frame: number) => {
  const index = frame % buffer.capacity;
  if (buffer.frames[index] !== frame) {
    return null;
  }
  return buffer.snapshots[index];
};

export const restoreRollbackFrame = (buffer: RollbackBuffer, state: GameState, frame: number) => {
  const snapshot = getRollbackSnapshot(buffer, frame);
  if (!snapshot) {
    return false;
  }
  restoreGameStateSnapshot(state, snapshot);
  return true;
};
