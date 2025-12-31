import type { EntityId, EcsSnapshot } from "../core/ecs";
import { createEcsSnapshot, restoreEcsSnapshot } from "../core/ecs";
import type { CraftingState } from "./crafting";
import type { AttackEffect, GameState } from "./state";
import type { WorldState } from "../world/types";

export type GameStateSnapshot = {
  time: number;
  ecs: EcsSnapshot;
  playerIds: EntityId[];
  localPlayerIndex: number;
  world: WorldState;
  rngState: number;
  crafting: CraftingState[];
  attackEffects: Array<AttackEffect | null>;
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

const cloneCraftingState = (crafting: CraftingState): CraftingState => ({
  isOpen: crafting.isOpen,
  selectedIndex: crafting.selectedIndex
});

const cloneCraftingStates = (crafting: CraftingState[]) => crafting.map((entry) => cloneCraftingState(entry));

const cloneAttackEffects = (effects: Array<AttackEffect | null>) => effects.map((effect) => cloneAttackEffect(effect));

export const createGameStateSnapshot = (state: GameState): GameStateSnapshot => ({
  time: state.time,
  ecs: createEcsSnapshot(state.ecs),
  playerIds: [...state.playerIds],
  localPlayerIndex: state.localPlayerIndex,
  world: state.world,
  rngState: state.rng.state,
  crafting: cloneCraftingStates(state.crafting),
  attackEffects: cloneAttackEffects(state.attackEffects)
});

export const restoreGameStateSnapshot = (state: GameState, snapshot: GameStateSnapshot) => {
  state.time = snapshot.time;
  state.playerIds = [...snapshot.playerIds];
  state.localPlayerIndex = snapshot.localPlayerIndex;
  state.world = snapshot.world;
  state.rng.state = snapshot.rngState;
  state.crafting = cloneCraftingStates(snapshot.crafting);
  state.attackEffects = cloneAttackEffects(snapshot.attackEffects);
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
