import type { GameStateSnapshot } from "../game/rollback";
import type { GameState } from "../game/state";
import type { WorldState } from "../world/types";
import { type EcsSnapshot, type EcsWorld, EQUIPMENT_SLOT_COUNT, INVENTORY_SLOT_COUNT } from "./ecs";

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

const hashWorldConfig = (hash: number, config: WorldState["config"]) => {
  let next = hash;
  next = hashString(next, config.preset);
  next = mixHash(next, config.seed);

  const procedural = config.procedural;
  next = mixHash(next, floatToBits(procedural.spawnRadius));
  next = mixHash(next, floatToBits(procedural.radiusMin));
  next = mixHash(next, floatToBits(procedural.radiusMax));
  next = mixHash(next, floatToBits(procedural.edgePadding));
  next = mixHash(next, floatToBits(procedural.placementAttempts));
  next = mixHash(next, floatToBits(procedural.arcMinAngle));
  next = mixHash(next, floatToBits(procedural.arcMaxAngle));

  next = mixHash(next, procedural.biomeTiers.length);
  for (const tier of procedural.biomeTiers) {
    next = hashString(next, tier.id);
    next = hashString(next, tier.name);
    next = mixHash(next, floatToBits(tier.ringMin));
    next = mixHash(next, floatToBits(tier.ringMax));
    next = mixHash(next, floatToBits(tier.islandCount));
    next = hashString(next, tier.bossType);

    const weightEntries = Object.entries(tier.weights).sort(([a], [b]) => a.localeCompare(b));
    for (const [type, weight] of weightEntries) {
      next = hashString(next, type);
      next = mixHash(next, floatToBits(weight));
    }
  }

  return next;
};

const hashWorld = (hash: number, world: WorldState) => {
  let next = hashWorldConfig(hash, world.config);
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

type HashableEcs = EcsWorld | EcsSnapshot;

const hashEcs = (hash: number, ecs: HashableEcs) => {
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
  next = hashFloatArray(next, ecs.playerAimAngle, entityCount);
  next = hashFloatArray(next, ecs.playerMoveAngle, entityCount);
  next = hashFloatArray(next, ecs.playerDamageFlashTimer, entityCount);
  next = hashFloatArray(next, ecs.playerAttackTimer, entityCount);
  next = hashFloatArray(next, ecs.playerUseCooldown, entityCount);
  next = hashFloatArray(next, ecs.playerHealth, entityCount);
  next = hashFloatArray(next, ecs.playerMaxHealth, entityCount);
  next = hashFloatArray(next, ecs.playerHunger, entityCount);
  next = hashFloatArray(next, ecs.playerMaxHunger, entityCount);
  next = hashFloatArray(next, ecs.playerArmor, entityCount);
  next = hashFloatArray(next, ecs.playerMaxArmor, entityCount);
  next = hashFloatArray(next, ecs.playerArmorRegenTimer, entityCount);
  next = hashFloatArray(next, ecs.playerRespawnTimer, entityCount);
  next = hashIntArray(next, ecs.playerIsDead, entityCount);
  next = hashIntArray(next, ecs.playerIsOnRaft, entityCount);

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
  next = hashIntArray(next, ecs.propKind, entityCount);

  return next;
};

type HashableGameState = {
  time: number;
  playerIds: number[];
  rngState: number;
  world: WorldState;
  crafting: GameStateSnapshot["crafting"];
  attackEffects: GameStateSnapshot["attackEffects"];
  ecs: HashableEcs;
};

const hashGameStateBase = (state: HashableGameState) => {
  let hash = 2166136261;
  hash = mixHash(hash, floatToBits(state.time));
  hash = mixHash(hash, state.playerIds.length);
  for (const playerId of state.playerIds) {
    hash = mixHash(hash, playerId);
  }
  hash = mixHash(hash, state.rngState);

  for (const crafting of state.crafting) {
    hash = mixHash(hash, crafting.isOpen ? 1 : 0);
    hash = mixHash(hash, crafting.selectedIndex);
  }

  for (const effect of state.attackEffects) {
    if (effect) {
      hash = mixHash(hash, 1);
      hash = mixHash(hash, floatToBits(effect.origin.x));
      hash = mixHash(hash, floatToBits(effect.origin.y));
      hash = mixHash(hash, floatToBits(effect.angle));
      hash = mixHash(hash, floatToBits(effect.radius));
      hash = mixHash(hash, floatToBits(effect.spread));
      hash = mixHash(hash, floatToBits(effect.timer));
      hash = mixHash(hash, floatToBits(effect.duration));
    } else {
      hash = mixHash(hash, 0);
    }
  }

  hash = hashWorld(hash, state.world);
  hash = hashEcs(hash, state.ecs);
  return hash >>> 0;
};

export const hashGameState = (state: GameState) =>
  hashGameStateBase({
    time: state.time,
    playerIds: state.playerIds,
    rngState: state.rng.state,
    world: state.world,
    crafting: state.crafting,
    attackEffects: state.attackEffects,
    ecs: state.ecs,
  });

export const hashGameStateSnapshot = (snapshot: GameStateSnapshot) =>
  hashGameStateBase({
    time: snapshot.time,
    playerIds: snapshot.playerIds,
    rngState: snapshot.rngState,
    world: snapshot.world,
    crafting: snapshot.crafting,
    attackEffects: snapshot.attackEffects,
    ecs: snapshot.ecs,
  });
