import { applyInputFrame, InputBits, type InputFrame } from "../core/input-buffer";
import { createInputState } from "../core/input";
import { EQUIPMENT_SLOT_COUNT, INVENTORY_SLOT_COUNT, type EcsWorld } from "../core/ecs";
import { createInitialState } from "../game/state";
import { simulateFrame } from "../game/sim";
import type { GameState } from "../game/state";
import type { WorldState } from "../world/types";

const FLOAT_BUFFER = new ArrayBuffer(4);
const FLOAT_VIEW = new DataView(FLOAT_BUFFER);

const floatToBits = (value: number) => {
  FLOAT_VIEW.setFloat32(0, value, true);
  return FLOAT_VIEW.getUint32(0, true);
};

const mixHash = (hash: number, value: number) => {
  let next = hash ^ (value >>> 0);
  next = Math.imul(next, 16777619);
  return next >>> 0;
};

const hashString = (hash: number, value: string) => {
  let next = hash;
  for (let i = 0; i < value.length; i += 1) {
    next = mixHash(next, value.charCodeAt(i));
  }
  return next;
};

const hashFloatArray = (hash: number, array: Float32Array, count: number) => {
  let next = hash;
  for (let i = 0; i < count; i += 1) {
    next = mixHash(next, floatToBits(array[i]));
  }
  return next;
};

const hashIntArray = (hash: number, array: ArrayLike<number>, count: number) => {
  let next = hash;
  for (let i = 0; i < count; i += 1) {
    next = mixHash(next, array[i]);
  }
  return next;
};

const hashWorld = (hash: number, world: WorldState) => {
  let next = hash;
  for (const island of world.islands) {
    next = hashString(next, island.type);
    next = mixHash(next, island.seed);
    next = mixHash(next, floatToBits(island.center.x));
    next = mixHash(next, floatToBits(island.center.y));
    for (const point of island.points) {
      next = mixHash(next, floatToBits(point.x));
      next = mixHash(next, floatToBits(point.y));
    }
  }
  return next;
};

const hashEcs = (hash: number, ecs: EcsWorld) => {
  let next = mixHash(hash, ecs.nextId);
  next = mixHash(next, ecs.capacity);

  const entityCount = ecs.nextId;
  const inventoryCount = entityCount * INVENTORY_SLOT_COUNT;
  const equipmentCount = entityCount * EQUIPMENT_SLOT_COUNT;

  next = hashIntArray(next, ecs.alive, entityCount);
  next = hashIntArray(next, ecs.mask, entityCount);
  next = hashIntArray(next, ecs.tag, entityCount);
  next = hashFloatArray(next, ecs.position.x, entityCount);
  next = hashFloatArray(next, ecs.position.y, entityCount);
  next = hashFloatArray(next, ecs.prevPosition.x, entityCount);
  next = hashFloatArray(next, ecs.prevPosition.y, entityCount);
  next = hashFloatArray(next, ecs.velocity.x, entityCount);
  next = hashFloatArray(next, ecs.velocity.y, entityCount);
  next = hashFloatArray(next, ecs.radius, entityCount);

  next = hashIntArray(next, ecs.enemyKind, entityCount);
  next = hashIntArray(next, ecs.enemyIsBoss, entityCount);
  next = hashFloatArray(next, ecs.enemyHealth, entityCount);
  next = hashFloatArray(next, ecs.enemyMaxHealth, entityCount);
  next = hashFloatArray(next, ecs.enemyHitTimer, entityCount);
  next = hashFloatArray(next, ecs.enemyDamage, entityCount);
  next = hashFloatArray(next, ecs.enemySpeed, entityCount);
  next = hashFloatArray(next, ecs.enemyAggroRange, entityCount);
  next = hashFloatArray(next, ecs.enemyAttackRange, entityCount);
  next = hashFloatArray(next, ecs.enemyAttackCooldown, entityCount);
  next = hashFloatArray(next, ecs.enemyAttackTimer, entityCount);
  next = hashFloatArray(next, ecs.enemyWanderAngle, entityCount);
  next = hashFloatArray(next, ecs.enemyWanderTimer, entityCount);
  next = hashIntArray(next, ecs.enemyHomeIsland, entityCount);

  next = hashIntArray(next, ecs.resourceNodeType, entityCount);
  next = hashIntArray(next, ecs.resourceKind, entityCount);
  next = hashFloatArray(next, ecs.resourceRotation, entityCount);
  next = hashIntArray(next, ecs.resourceYieldMin, entityCount);
  next = hashIntArray(next, ecs.resourceYieldMax, entityCount);
  next = hashIntArray(next, ecs.resourceRemaining, entityCount);
  next = hashFloatArray(next, ecs.resourceRespawnTime, entityCount);
  next = hashFloatArray(next, ecs.resourceRespawnTimer, entityCount);

  next = hashIntArray(next, ecs.inventoryKind, inventoryCount);
  next = hashIntArray(next, ecs.inventoryQuantity, inventoryCount);
  next = hashIntArray(next, ecs.inventorySelected, entityCount);
  next = hashIntArray(next, ecs.equipmentKind, equipmentCount);

  next = hashIntArray(next, ecs.groundItemKind, entityCount);
  next = hashIntArray(next, ecs.groundItemQuantity, entityCount);
  next = hashFloatArray(next, ecs.groundItemDroppedAt, entityCount);

  return next;
};

const hashState = (state: GameState) => {
  let hash = 2166136261;
  hash = mixHash(hash, floatToBits(state.time));
  hash = mixHash(hash, state.playerId);
  hash = mixHash(hash, state.isDead ? 1 : 0);
  hash = mixHash(hash, floatToBits(state.aimAngle));
  hash = mixHash(hash, floatToBits(state.moveAngle));
  hash = mixHash(hash, floatToBits(state.damageFlashTimer));
  hash = mixHash(hash, floatToBits(state.playerAttackTimer));
  hash = mixHash(hash, floatToBits(state.useCooldown));
  hash = mixHash(hash, state.rng.state);

  hash = mixHash(hash, floatToBits(state.survival.health));
  hash = mixHash(hash, floatToBits(state.survival.hunger));
  hash = mixHash(hash, floatToBits(state.survival.maxHealth));
  hash = mixHash(hash, floatToBits(state.survival.maxHunger));
  hash = mixHash(hash, floatToBits(state.survival.armor));
  hash = mixHash(hash, floatToBits(state.survival.maxArmor));
  hash = mixHash(hash, floatToBits(state.survival.armorRegenTimer));

  hash = mixHash(hash, state.crafting.isOpen ? 1 : 0);
  hash = mixHash(hash, state.crafting.selectedIndex);

  hash = mixHash(hash, state.raft.isOnRaft ? 1 : 0);

  if (state.attackEffect) {
    hash = mixHash(hash, 1);
    hash = mixHash(hash, floatToBits(state.attackEffect.origin.x));
    hash = mixHash(hash, floatToBits(state.attackEffect.origin.y));
    hash = mixHash(hash, floatToBits(state.attackEffect.angle));
    hash = mixHash(hash, floatToBits(state.attackEffect.radius));
    hash = mixHash(hash, floatToBits(state.attackEffect.spread));
    hash = mixHash(hash, floatToBits(state.attackEffect.timer));
    hash = mixHash(hash, floatToBits(state.attackEffect.duration));
  } else {
    hash = mixHash(hash, 0);
  }

  hash = hashWorld(hash, state.world);
  hash = hashEcs(hash, state.ecs);
  return hash >>> 0;
};

const buildTestInputFrame = (frame: number): InputFrame => {
  let buttons = 0;
  const phase = frame % 240;
  if (phase < 60) {
    buttons |= InputBits.Right;
  } else if (phase < 120) {
    buttons |= InputBits.Down;
  } else if (phase < 180) {
    buttons |= InputBits.Left;
  } else {
    buttons |= InputBits.Up;
  }

  if (frame % 90 === 10) {
    buttons |= InputBits.Interact;
  }
  if (frame % 120 === 20) {
    buttons |= InputBits.Use;
  }
  if (frame % 150 === 30) {
    buttons |= InputBits.Drop;
  }

  return {
    buttons,
    craftIndex: -1,
    craftScroll: 0,
    inventoryIndex: -1,
    inventoryScroll: 0,
    mouseX: 0,
    mouseY: 0
  };
};

const runSimulation = (seed: string, frames: number) => {
  const state = createInitialState(seed);
  const input = createInputState();
  const delta = 1 / 60;

  for (let frame = 0; frame < frames; frame += 1) {
    applyInputFrame(buildTestInputFrame(frame), input);
    simulateFrame(state, input, delta);
  }

  return hashState(state);
};

export const runDeterminismCheck = (seed = "determinism", frames = 600) => {
  const hashA = runSimulation(seed, frames);
  const hashB = runSimulation(seed, frames);
  const ok = hashA === hashB;
  const status = ok ? "PASS" : "FAIL";
  console.info(`[determinism] ${status} seed=${seed} frames=${frames} hash=${hashA.toString(16)}`);
  if (!ok) {
    console.error(`[determinism] mismatch hashB=${hashB.toString(16)}`);
  }
  return ok;
};
