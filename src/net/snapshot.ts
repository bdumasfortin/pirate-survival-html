import type { Vec2Store, EcsSnapshot } from "../core/ecs";
import { createGameStateSnapshot, type GameStateSnapshot } from "../game/rollback";
import type { GameState } from "../game/state";
import type { WorldState } from "../world/types";

type SerializedVec2Store = {
  x: number[];
  y: number[];
};

type SerializedEcsSnapshot = {
  capacity: number;
  nextId: number;
  alive: number[];
  mask: number[];
  tag: number[];
  position: SerializedVec2Store;
  prevPosition: SerializedVec2Store;
  velocity: SerializedVec2Store;
  radius: number[];
  playerAimAngle: number[];
  playerMoveAngle: number[];
  playerDamageFlashTimer: number[];
  playerAttackTimer: number[];
  playerUseCooldown: number[];
  playerHealth: number[];
  playerMaxHealth: number[];
  playerHunger: number[];
  playerMaxHunger: number[];
  playerArmor: number[];
  playerMaxArmor: number[];
  playerArmorRegenTimer: number[];
  playerIsDead: number[];
  playerIsOnRaft: number[];
  enemyKind: number[];
  enemyIsBoss: number[];
  enemyHealth: number[];
  enemyMaxHealth: number[];
  enemyHitTimer: number[];
  enemyDamage: number[];
  enemySpeed: number[];
  enemyAggroRange: number[];
  enemyAttackRange: number[];
  enemyAttackCooldown: number[];
  enemyAttackTimer: number[];
  enemyWanderAngle: number[];
  enemyWanderTimer: number[];
  enemyHomeIsland: number[];
  resourceNodeType: number[];
  resourceKind: number[];
  resourceRotation: number[];
  resourceYieldMin: number[];
  resourceYieldMax: number[];
  resourceRemaining: number[];
  resourceRespawnTime: number[];
  resourceRespawnTimer: number[];
  inventoryKind: number[];
  inventoryQuantity: number[];
  inventorySelected: number[];
  equipmentKind: number[];
  groundItemKind: number[];
  groundItemQuantity: number[];
  groundItemDroppedAt: number[];
};

type SerializedGameStateSnapshot = {
  time: number;
  playerIds: number[];
  localPlayerIndex: number;
  world: WorldState;
  rngState: number;
  crafting: GameStateSnapshot["crafting"];
  attackEffects: GameStateSnapshot["attackEffects"];
  ecs: SerializedEcsSnapshot;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const serializeVec2Store = (store: Vec2Store): SerializedVec2Store => ({
  x: Array.from(store.x),
  y: Array.from(store.y)
});

const serializeEcsSnapshot = (ecs: EcsSnapshot): SerializedEcsSnapshot => ({
  capacity: ecs.capacity,
  nextId: ecs.nextId,
  alive: Array.from(ecs.alive),
  mask: Array.from(ecs.mask),
  tag: Array.from(ecs.tag),
  position: serializeVec2Store(ecs.position),
  prevPosition: serializeVec2Store(ecs.prevPosition),
  velocity: serializeVec2Store(ecs.velocity),
  radius: Array.from(ecs.radius),
  playerAimAngle: Array.from(ecs.playerAimAngle),
  playerMoveAngle: Array.from(ecs.playerMoveAngle),
  playerDamageFlashTimer: Array.from(ecs.playerDamageFlashTimer),
  playerAttackTimer: Array.from(ecs.playerAttackTimer),
  playerUseCooldown: Array.from(ecs.playerUseCooldown),
  playerHealth: Array.from(ecs.playerHealth),
  playerMaxHealth: Array.from(ecs.playerMaxHealth),
  playerHunger: Array.from(ecs.playerHunger),
  playerMaxHunger: Array.from(ecs.playerMaxHunger),
  playerArmor: Array.from(ecs.playerArmor),
  playerMaxArmor: Array.from(ecs.playerMaxArmor),
  playerArmorRegenTimer: Array.from(ecs.playerArmorRegenTimer),
  playerIsDead: Array.from(ecs.playerIsDead),
  playerIsOnRaft: Array.from(ecs.playerIsOnRaft),
  enemyKind: Array.from(ecs.enemyKind),
  enemyIsBoss: Array.from(ecs.enemyIsBoss),
  enemyHealth: Array.from(ecs.enemyHealth),
  enemyMaxHealth: Array.from(ecs.enemyMaxHealth),
  enemyHitTimer: Array.from(ecs.enemyHitTimer),
  enemyDamage: Array.from(ecs.enemyDamage),
  enemySpeed: Array.from(ecs.enemySpeed),
  enemyAggroRange: Array.from(ecs.enemyAggroRange),
  enemyAttackRange: Array.from(ecs.enemyAttackRange),
  enemyAttackCooldown: Array.from(ecs.enemyAttackCooldown),
  enemyAttackTimer: Array.from(ecs.enemyAttackTimer),
  enemyWanderAngle: Array.from(ecs.enemyWanderAngle),
  enemyWanderTimer: Array.from(ecs.enemyWanderTimer),
  enemyHomeIsland: Array.from(ecs.enemyHomeIsland),
  resourceNodeType: Array.from(ecs.resourceNodeType),
  resourceKind: Array.from(ecs.resourceKind),
  resourceRotation: Array.from(ecs.resourceRotation),
  resourceYieldMin: Array.from(ecs.resourceYieldMin),
  resourceYieldMax: Array.from(ecs.resourceYieldMax),
  resourceRemaining: Array.from(ecs.resourceRemaining),
  resourceRespawnTime: Array.from(ecs.resourceRespawnTime),
  resourceRespawnTimer: Array.from(ecs.resourceRespawnTimer),
  inventoryKind: Array.from(ecs.inventoryKind),
  inventoryQuantity: Array.from(ecs.inventoryQuantity),
  inventorySelected: Array.from(ecs.inventorySelected),
  equipmentKind: Array.from(ecs.equipmentKind),
  groundItemKind: Array.from(ecs.groundItemKind),
  groundItemQuantity: Array.from(ecs.groundItemQuantity),
  groundItemDroppedAt: Array.from(ecs.groundItemDroppedAt)
});

const deserializeVec2Store = (payload: SerializedVec2Store): Vec2Store => ({
  x: new Float32Array(payload.x),
  y: new Float32Array(payload.y)
});

const deserializeEcsSnapshot = (payload: SerializedEcsSnapshot): EcsSnapshot => ({
  capacity: payload.capacity,
  nextId: payload.nextId,
  alive: new Uint8Array(payload.alive),
  mask: new Uint32Array(payload.mask),
  tag: new Uint8Array(payload.tag),
  position: deserializeVec2Store(payload.position),
  prevPosition: deserializeVec2Store(payload.prevPosition),
  velocity: deserializeVec2Store(payload.velocity),
  radius: new Float32Array(payload.radius),
  playerAimAngle: new Float32Array(payload.playerAimAngle),
  playerMoveAngle: new Float32Array(payload.playerMoveAngle),
  playerDamageFlashTimer: new Float32Array(payload.playerDamageFlashTimer),
  playerAttackTimer: new Float32Array(payload.playerAttackTimer),
  playerUseCooldown: new Float32Array(payload.playerUseCooldown),
  playerHealth: new Float32Array(payload.playerHealth),
  playerMaxHealth: new Float32Array(payload.playerMaxHealth),
  playerHunger: new Float32Array(payload.playerHunger),
  playerMaxHunger: new Float32Array(payload.playerMaxHunger),
  playerArmor: new Float32Array(payload.playerArmor),
  playerMaxArmor: new Float32Array(payload.playerMaxArmor),
  playerArmorRegenTimer: new Float32Array(payload.playerArmorRegenTimer),
  playerIsDead: new Uint8Array(payload.playerIsDead),
  playerIsOnRaft: new Uint8Array(payload.playerIsOnRaft),
  enemyKind: new Uint8Array(payload.enemyKind),
  enemyIsBoss: new Uint8Array(payload.enemyIsBoss),
  enemyHealth: new Float32Array(payload.enemyHealth),
  enemyMaxHealth: new Float32Array(payload.enemyMaxHealth),
  enemyHitTimer: new Float32Array(payload.enemyHitTimer),
  enemyDamage: new Float32Array(payload.enemyDamage),
  enemySpeed: new Float32Array(payload.enemySpeed),
  enemyAggroRange: new Float32Array(payload.enemyAggroRange),
  enemyAttackRange: new Float32Array(payload.enemyAttackRange),
  enemyAttackCooldown: new Float32Array(payload.enemyAttackCooldown),
  enemyAttackTimer: new Float32Array(payload.enemyAttackTimer),
  enemyWanderAngle: new Float32Array(payload.enemyWanderAngle),
  enemyWanderTimer: new Float32Array(payload.enemyWanderTimer),
  enemyHomeIsland: new Int16Array(payload.enemyHomeIsland),
  resourceNodeType: new Uint8Array(payload.resourceNodeType),
  resourceKind: new Uint8Array(payload.resourceKind),
  resourceRotation: new Float32Array(payload.resourceRotation),
  resourceYieldMin: new Int16Array(payload.resourceYieldMin),
  resourceYieldMax: new Int16Array(payload.resourceYieldMax),
  resourceRemaining: new Int16Array(payload.resourceRemaining),
  resourceRespawnTime: new Float32Array(payload.resourceRespawnTime),
  resourceRespawnTimer: new Float32Array(payload.resourceRespawnTimer),
  inventoryKind: new Int16Array(payload.inventoryKind),
  inventoryQuantity: new Int16Array(payload.inventoryQuantity),
  inventorySelected: new Uint8Array(payload.inventorySelected),
  equipmentKind: new Int16Array(payload.equipmentKind),
  groundItemKind: new Uint8Array(payload.groundItemKind),
  groundItemQuantity: new Int16Array(payload.groundItemQuantity),
  groundItemDroppedAt: new Float32Array(payload.groundItemDroppedAt)
});

export const serializeGameStateSnapshot = (snapshot: GameStateSnapshot) => {
  const payload: SerializedGameStateSnapshot = {
    time: snapshot.time,
    playerIds: snapshot.playerIds,
    localPlayerIndex: snapshot.localPlayerIndex,
    world: snapshot.world,
    rngState: snapshot.rngState,
    crafting: snapshot.crafting,
    attackEffects: snapshot.attackEffects,
    ecs: serializeEcsSnapshot(snapshot.ecs)
  };
  return encoder.encode(JSON.stringify(payload));
};

export const deserializeGameStateSnapshot = (data: Uint8Array): GameStateSnapshot => {
  const payload = JSON.parse(decoder.decode(data)) as SerializedGameStateSnapshot;
  return {
    time: payload.time,
    playerIds: payload.playerIds,
    localPlayerIndex: payload.localPlayerIndex,
    world: payload.world,
    rngState: payload.rngState,
    crafting: payload.crafting,
    attackEffects: payload.attackEffects,
    ecs: deserializeEcsSnapshot(payload.ecs)
  };
};

export const serializeGameState = (state: GameState) =>
  serializeGameStateSnapshot(createGameStateSnapshot(state));

export const deserializeGameState = (data: Uint8Array) =>
  deserializeGameStateSnapshot(data);

const BASE64_CHUNK = 0x8000;

export const encodeBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
    const slice = bytes.subarray(offset, offset + BASE64_CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
};

export const decodeBase64 = (data: string) => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};
