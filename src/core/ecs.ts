import type { Vec2 } from "./types";

export type EntityId = number;

export enum EntityTag {
  Player = 1,
  Enemy = 2,
  Resource = 3,
  GroundItem = 4,
  Prop = 5,
}

export const INVENTORY_SLOT_COUNT = 9;
export const EQUIPMENT_SLOT_COUNT = 6;

export const ComponentMask = {
  Position: 1 << 0,
  PrevPosition: 1 << 1,
  Velocity: 1 << 2,
  Radius: 1 << 3,
  Tag: 1 << 4,
  Enemy: 1 << 5,
  Resource: 1 << 6,
  Inventory: 1 << 7,
  Equipment: 1 << 8,
  GroundItem: 1 << 9,
  Prop: 1 << 10,
} as const;

export type Vec2Store = {
  x: Float32Array;
  y: Float32Array;
};

export type EcsWorld = {
  capacity: number;
  nextId: number;
  alive: Uint8Array;
  mask: Uint32Array;
  tag: Uint8Array;
  position: Vec2Store;
  prevPosition: Vec2Store;
  velocity: Vec2Store;
  radius: Float32Array;
  playerAimAngle: Float32Array;
  playerMoveAngle: Float32Array;
  playerDamageFlashTimer: Float32Array;
  playerAttackTimer: Float32Array;
  playerUseCooldown: Float32Array;
  playerHealth: Float32Array;
  playerMaxHealth: Float32Array;
  playerHunger: Float32Array;
  playerMaxHunger: Float32Array;
  playerArmor: Float32Array;
  playerMaxArmor: Float32Array;
  playerArmorRegenTimer: Float32Array;
  playerRespawnTimer: Float32Array;
  playerIsDead: Uint8Array;
  playerIsOnRaft: Uint8Array;
  enemyKind: Uint8Array;
  enemyIsBoss: Uint8Array;
  enemyHealth: Float32Array;
  enemyMaxHealth: Float32Array;
  enemyHitTimer: Float32Array;
  enemyDamage: Float32Array;
  enemySpeed: Float32Array;
  enemyAggroRange: Float32Array;
  enemyAttackRange: Float32Array;
  enemyAttackCooldown: Float32Array;
  enemyAttackTimer: Float32Array;
  enemyWanderAngle: Float32Array;
  enemyWanderTimer: Float32Array;
  enemyHomeIsland: Int16Array;
  resourceNodeType: Uint8Array;
  resourceKind: Uint8Array;
  resourceRotation: Float32Array;
  resourceYieldMin: Int16Array;
  resourceYieldMax: Int16Array;
  resourceRemaining: Int16Array;
  resourceRespawnTime: Float32Array;
  resourceRespawnTimer: Float32Array;
  inventoryKind: Int16Array;
  inventoryQuantity: Int16Array;
  inventorySelected: Uint8Array;
  equipmentKind: Int16Array;
  groundItemKind: Uint8Array;
  groundItemQuantity: Int16Array;
  groundItemDroppedAt: Float32Array;
  propKind: Uint8Array;
};

export type EcsSnapshot = {
  capacity: number;
  nextId: number;
  alive: Uint8Array;
  mask: Uint32Array;
  tag: Uint8Array;
  position: Vec2Store;
  prevPosition: Vec2Store;
  velocity: Vec2Store;
  radius: Float32Array;
  playerAimAngle: Float32Array;
  playerMoveAngle: Float32Array;
  playerDamageFlashTimer: Float32Array;
  playerAttackTimer: Float32Array;
  playerUseCooldown: Float32Array;
  playerHealth: Float32Array;
  playerMaxHealth: Float32Array;
  playerHunger: Float32Array;
  playerMaxHunger: Float32Array;
  playerArmor: Float32Array;
  playerMaxArmor: Float32Array;
  playerArmorRegenTimer: Float32Array;
  playerRespawnTimer: Float32Array;
  playerIsDead: Uint8Array;
  playerIsOnRaft: Uint8Array;
  enemyKind: Uint8Array;
  enemyIsBoss: Uint8Array;
  enemyHealth: Float32Array;
  enemyMaxHealth: Float32Array;
  enemyHitTimer: Float32Array;
  enemyDamage: Float32Array;
  enemySpeed: Float32Array;
  enemyAggroRange: Float32Array;
  enemyAttackRange: Float32Array;
  enemyAttackCooldown: Float32Array;
  enemyAttackTimer: Float32Array;
  enemyWanderAngle: Float32Array;
  enemyWanderTimer: Float32Array;
  enemyHomeIsland: Int16Array;
  resourceNodeType: Uint8Array;
  resourceKind: Uint8Array;
  resourceRotation: Float32Array;
  resourceYieldMin: Int16Array;
  resourceYieldMax: Int16Array;
  resourceRemaining: Int16Array;
  resourceRespawnTime: Float32Array;
  resourceRespawnTimer: Float32Array;
  inventoryKind: Int16Array;
  inventoryQuantity: Int16Array;
  inventorySelected: Uint8Array;
  equipmentKind: Int16Array;
  groundItemKind: Uint8Array;
  groundItemQuantity: Int16Array;
  groundItemDroppedAt: Float32Array;
  propKind: Uint8Array;
};

export const DEFAULT_ENTITY_MASK =
  ComponentMask.Position |
  ComponentMask.PrevPosition |
  ComponentMask.Velocity |
  ComponentMask.Radius |
  ComponentMask.Tag;

const createVec2Store = (capacity: number): Vec2Store => ({
  x: new Float32Array(capacity),
  y: new Float32Array(capacity),
});

const resizeVec2Store = (store: Vec2Store, capacity: number): Vec2Store => {
  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  x.set(store.x);
  y.set(store.y);
  return { x, y };
};

const resizeWorld = (world: EcsWorld, capacity: number) => {
  world.alive = resizeUint8(world.alive, capacity);
  world.mask = resizeUint32(world.mask, capacity);
  world.tag = resizeUint8(world.tag, capacity);
  world.position = resizeVec2Store(world.position, capacity);
  world.prevPosition = resizeVec2Store(world.prevPosition, capacity);
  world.velocity = resizeVec2Store(world.velocity, capacity);
  world.radius = resizeFloat32(world.radius, capacity);
  world.playerAimAngle = resizeFloat32(world.playerAimAngle, capacity);
  world.playerMoveAngle = resizeFloat32(world.playerMoveAngle, capacity);
  world.playerDamageFlashTimer = resizeFloat32(world.playerDamageFlashTimer, capacity);
  world.playerAttackTimer = resizeFloat32(world.playerAttackTimer, capacity);
  world.playerUseCooldown = resizeFloat32(world.playerUseCooldown, capacity);
  world.playerHealth = resizeFloat32(world.playerHealth, capacity);
  world.playerMaxHealth = resizeFloat32(world.playerMaxHealth, capacity);
  world.playerHunger = resizeFloat32(world.playerHunger, capacity);
  world.playerMaxHunger = resizeFloat32(world.playerMaxHunger, capacity);
  world.playerArmor = resizeFloat32(world.playerArmor, capacity);
  world.playerMaxArmor = resizeFloat32(world.playerMaxArmor, capacity);
  world.playerArmorRegenTimer = resizeFloat32(world.playerArmorRegenTimer, capacity);
  world.playerRespawnTimer = resizeFloat32(world.playerRespawnTimer, capacity);
  world.playerIsDead = resizeUint8(world.playerIsDead, capacity);
  world.playerIsOnRaft = resizeUint8(world.playerIsOnRaft, capacity);
  world.enemyKind = resizeUint8(world.enemyKind, capacity);
  world.enemyIsBoss = resizeUint8(world.enemyIsBoss, capacity);
  world.enemyHealth = resizeFloat32(world.enemyHealth, capacity);
  world.enemyMaxHealth = resizeFloat32(world.enemyMaxHealth, capacity);
  world.enemyHitTimer = resizeFloat32(world.enemyHitTimer, capacity);
  world.enemyDamage = resizeFloat32(world.enemyDamage, capacity);
  world.enemySpeed = resizeFloat32(world.enemySpeed, capacity);
  world.enemyAggroRange = resizeFloat32(world.enemyAggroRange, capacity);
  world.enemyAttackRange = resizeFloat32(world.enemyAttackRange, capacity);
  world.enemyAttackCooldown = resizeFloat32(world.enemyAttackCooldown, capacity);
  world.enemyAttackTimer = resizeFloat32(world.enemyAttackTimer, capacity);
  world.enemyWanderAngle = resizeFloat32(world.enemyWanderAngle, capacity);
  world.enemyWanderTimer = resizeFloat32(world.enemyWanderTimer, capacity);
  world.enemyHomeIsland = resizeInt16(world.enemyHomeIsland, capacity);
  world.resourceNodeType = resizeUint8(world.resourceNodeType, capacity);
  world.resourceKind = resizeUint8(world.resourceKind, capacity);
  world.resourceRotation = resizeFloat32(world.resourceRotation, capacity);
  world.resourceYieldMin = resizeInt16(world.resourceYieldMin, capacity);
  world.resourceYieldMax = resizeInt16(world.resourceYieldMax, capacity);
  world.resourceRemaining = resizeInt16(world.resourceRemaining, capacity);
  world.resourceRespawnTime = resizeFloat32(world.resourceRespawnTime, capacity);
  world.resourceRespawnTimer = resizeFloat32(world.resourceRespawnTimer, capacity);
  world.inventoryKind = resizeInt16(world.inventoryKind, capacity * INVENTORY_SLOT_COUNT);
  world.inventoryQuantity = resizeInt16(world.inventoryQuantity, capacity * INVENTORY_SLOT_COUNT);
  world.inventorySelected = resizeUint8(world.inventorySelected, capacity);
  world.equipmentKind = resizeInt16(world.equipmentKind, capacity * EQUIPMENT_SLOT_COUNT);
  world.groundItemKind = resizeUint8(world.groundItemKind, capacity);
  world.groundItemQuantity = resizeInt16(world.groundItemQuantity, capacity);
  world.groundItemDroppedAt = resizeFloat32(world.groundItemDroppedAt, capacity);
  world.propKind = resizeUint8(world.propKind, capacity);
  world.capacity = capacity;
};

const resizeUint8 = (source: Uint8Array, capacity: number) => {
  const next = new Uint8Array(capacity);
  next.set(source);
  return next;
};

const resizeUint32 = (source: Uint32Array, capacity: number) => {
  const next = new Uint32Array(capacity);
  next.set(source);
  return next;
};

const resizeFloat32 = (source: Float32Array, capacity: number) => {
  const next = new Float32Array(capacity);
  next.set(source);
  return next;
};

const resizeInt16 = (source: Int16Array, capacity: number) => {
  const next = new Int16Array(capacity);
  next.set(source);
  return next;
};

export const createEcsWorld = (capacity = 64): EcsWorld => ({
  capacity,
  nextId: 0,
  alive: new Uint8Array(capacity),
  mask: new Uint32Array(capacity),
  tag: new Uint8Array(capacity),
  position: createVec2Store(capacity),
  prevPosition: createVec2Store(capacity),
  velocity: createVec2Store(capacity),
  radius: new Float32Array(capacity),
  playerAimAngle: new Float32Array(capacity),
  playerMoveAngle: new Float32Array(capacity),
  playerDamageFlashTimer: new Float32Array(capacity),
  playerAttackTimer: new Float32Array(capacity),
  playerUseCooldown: new Float32Array(capacity),
  playerHealth: new Float32Array(capacity),
  playerMaxHealth: new Float32Array(capacity),
  playerHunger: new Float32Array(capacity),
  playerMaxHunger: new Float32Array(capacity),
  playerArmor: new Float32Array(capacity),
  playerMaxArmor: new Float32Array(capacity),
  playerArmorRegenTimer: new Float32Array(capacity),
  playerRespawnTimer: new Float32Array(capacity),
  playerIsDead: new Uint8Array(capacity),
  playerIsOnRaft: new Uint8Array(capacity),
  enemyKind: new Uint8Array(capacity),
  enemyIsBoss: new Uint8Array(capacity),
  enemyHealth: new Float32Array(capacity),
  enemyMaxHealth: new Float32Array(capacity),
  enemyHitTimer: new Float32Array(capacity),
  enemyDamage: new Float32Array(capacity),
  enemySpeed: new Float32Array(capacity),
  enemyAggroRange: new Float32Array(capacity),
  enemyAttackRange: new Float32Array(capacity),
  enemyAttackCooldown: new Float32Array(capacity),
  enemyAttackTimer: new Float32Array(capacity),
  enemyWanderAngle: new Float32Array(capacity),
  enemyWanderTimer: new Float32Array(capacity),
  enemyHomeIsland: new Int16Array(capacity),
  resourceNodeType: new Uint8Array(capacity),
  resourceKind: new Uint8Array(capacity),
  resourceRotation: new Float32Array(capacity),
  resourceYieldMin: new Int16Array(capacity),
  resourceYieldMax: new Int16Array(capacity),
  resourceRemaining: new Int16Array(capacity),
  resourceRespawnTime: new Float32Array(capacity),
  resourceRespawnTimer: new Float32Array(capacity),
  inventoryKind: new Int16Array(capacity * INVENTORY_SLOT_COUNT),
  inventoryQuantity: new Int16Array(capacity * INVENTORY_SLOT_COUNT),
  inventorySelected: new Uint8Array(capacity),
  equipmentKind: new Int16Array(capacity * EQUIPMENT_SLOT_COUNT),
  groundItemKind: new Uint8Array(capacity),
  groundItemQuantity: new Int16Array(capacity),
  groundItemDroppedAt: new Float32Array(capacity),
  propKind: new Uint8Array(capacity),
});

export const ensureCapacity = (world: EcsWorld, id: number) => {
  if (id < world.capacity) {
    return;
  }

  let capacity = world.capacity;
  while (capacity <= id) {
    capacity *= 2;
  }

  resizeWorld(world, capacity);
};

export const createEntity = (world: EcsWorld, mask = DEFAULT_ENTITY_MASK, tag: EntityTag = EntityTag.Player) => {
  const id = world.nextId;
  world.nextId += 1;
  ensureCapacity(world, id);
  world.alive[id] = 1;
  world.mask[id] = mask;
  world.tag[id] = tag;
  return id;
};

export const destroyEntity = (world: EcsWorld, id: EntityId) => {
  if (id < 0 || id >= world.nextId) {
    return;
  }

  world.alive[id] = 0;
  world.mask[id] = 0;
  world.tag[id] = 0;
};

export const isEntityAlive = (world: EcsWorld, id: EntityId) => id >= 0 && id < world.nextId && world.alive[id] === 1;

export const hasComponents = (world: EcsWorld, id: EntityId, mask: number) => (world.mask[id] & mask) === mask;

export const readVec2 = (store: Vec2Store, id: EntityId, out: Vec2) => {
  out.x = store.x[id];
  out.y = store.y[id];
  return out;
};

export const writeVec2 = (store: Vec2Store, id: EntityId, x: number, y: number) => {
  store.x[id] = x;
  store.y[id] = y;
};

export const forEachEntity = (world: EcsWorld, mask: number, fn: (id: EntityId) => void) => {
  for (let id = 0; id < world.nextId; id += 1) {
    if (world.alive[id] !== 1) {
      continue;
    }

    if ((world.mask[id] & mask) !== mask) {
      continue;
    }

    fn(id);
  }
};

const cloneUint8 = (source: Uint8Array) => new Uint8Array(source);
const cloneUint32 = (source: Uint32Array) => new Uint32Array(source);
const cloneFloat32 = (source: Float32Array) => new Float32Array(source);
const cloneInt16 = (source: Int16Array) => new Int16Array(source);
const cloneVec2Store = (store: Vec2Store): Vec2Store => ({
  x: cloneFloat32(store.x),
  y: cloneFloat32(store.y),
});

export const createEcsSnapshot = (world: EcsWorld): EcsSnapshot => ({
  capacity: world.capacity,
  nextId: world.nextId,
  alive: cloneUint8(world.alive),
  mask: cloneUint32(world.mask),
  tag: cloneUint8(world.tag),
  position: cloneVec2Store(world.position),
  prevPosition: cloneVec2Store(world.prevPosition),
  velocity: cloneVec2Store(world.velocity),
  radius: cloneFloat32(world.radius),
  playerAimAngle: cloneFloat32(world.playerAimAngle),
  playerMoveAngle: cloneFloat32(world.playerMoveAngle),
  playerDamageFlashTimer: cloneFloat32(world.playerDamageFlashTimer),
  playerAttackTimer: cloneFloat32(world.playerAttackTimer),
  playerUseCooldown: cloneFloat32(world.playerUseCooldown),
  playerHealth: cloneFloat32(world.playerHealth),
  playerMaxHealth: cloneFloat32(world.playerMaxHealth),
  playerHunger: cloneFloat32(world.playerHunger),
  playerMaxHunger: cloneFloat32(world.playerMaxHunger),
  playerArmor: cloneFloat32(world.playerArmor),
  playerMaxArmor: cloneFloat32(world.playerMaxArmor),
  playerArmorRegenTimer: cloneFloat32(world.playerArmorRegenTimer),
  playerRespawnTimer: cloneFloat32(world.playerRespawnTimer),
  playerIsDead: cloneUint8(world.playerIsDead),
  playerIsOnRaft: cloneUint8(world.playerIsOnRaft),
  enemyKind: cloneUint8(world.enemyKind),
  enemyIsBoss: cloneUint8(world.enemyIsBoss),
  enemyHealth: cloneFloat32(world.enemyHealth),
  enemyMaxHealth: cloneFloat32(world.enemyMaxHealth),
  enemyHitTimer: cloneFloat32(world.enemyHitTimer),
  enemyDamage: cloneFloat32(world.enemyDamage),
  enemySpeed: cloneFloat32(world.enemySpeed),
  enemyAggroRange: cloneFloat32(world.enemyAggroRange),
  enemyAttackRange: cloneFloat32(world.enemyAttackRange),
  enemyAttackCooldown: cloneFloat32(world.enemyAttackCooldown),
  enemyAttackTimer: cloneFloat32(world.enemyAttackTimer),
  enemyWanderAngle: cloneFloat32(world.enemyWanderAngle),
  enemyWanderTimer: cloneFloat32(world.enemyWanderTimer),
  enemyHomeIsland: cloneInt16(world.enemyHomeIsland),
  resourceNodeType: cloneUint8(world.resourceNodeType),
  resourceKind: cloneUint8(world.resourceKind),
  resourceRotation: cloneFloat32(world.resourceRotation),
  resourceYieldMin: cloneInt16(world.resourceYieldMin),
  resourceYieldMax: cloneInt16(world.resourceYieldMax),
  resourceRemaining: cloneInt16(world.resourceRemaining),
  resourceRespawnTime: cloneFloat32(world.resourceRespawnTime),
  resourceRespawnTimer: cloneFloat32(world.resourceRespawnTimer),
  inventoryKind: cloneInt16(world.inventoryKind),
  inventoryQuantity: cloneInt16(world.inventoryQuantity),
  inventorySelected: cloneUint8(world.inventorySelected),
  equipmentKind: cloneInt16(world.equipmentKind),
  groundItemKind: cloneUint8(world.groundItemKind),
  groundItemQuantity: cloneInt16(world.groundItemQuantity),
  groundItemDroppedAt: cloneFloat32(world.groundItemDroppedAt),
  propKind: cloneUint8(world.propKind),
});

export const restoreEcsSnapshot = (world: EcsWorld, snapshot: EcsSnapshot) => {
  world.capacity = snapshot.capacity;
  world.nextId = snapshot.nextId;
  world.alive = cloneUint8(snapshot.alive);
  world.mask = cloneUint32(snapshot.mask);
  world.tag = cloneUint8(snapshot.tag);
  world.position = cloneVec2Store(snapshot.position);
  world.prevPosition = cloneVec2Store(snapshot.prevPosition);
  world.velocity = cloneVec2Store(snapshot.velocity);
  world.radius = cloneFloat32(snapshot.radius);
  world.playerAimAngle = cloneFloat32(snapshot.playerAimAngle);
  world.playerMoveAngle = cloneFloat32(snapshot.playerMoveAngle);
  world.playerDamageFlashTimer = cloneFloat32(snapshot.playerDamageFlashTimer);
  world.playerAttackTimer = cloneFloat32(snapshot.playerAttackTimer);
  world.playerUseCooldown = cloneFloat32(snapshot.playerUseCooldown);
  world.playerHealth = cloneFloat32(snapshot.playerHealth);
  world.playerMaxHealth = cloneFloat32(snapshot.playerMaxHealth);
  world.playerHunger = cloneFloat32(snapshot.playerHunger);
  world.playerMaxHunger = cloneFloat32(snapshot.playerMaxHunger);
  world.playerArmor = cloneFloat32(snapshot.playerArmor);
  world.playerMaxArmor = cloneFloat32(snapshot.playerMaxArmor);
  world.playerArmorRegenTimer = cloneFloat32(snapshot.playerArmorRegenTimer);
  world.playerRespawnTimer = cloneFloat32(snapshot.playerRespawnTimer);
  world.playerIsDead = cloneUint8(snapshot.playerIsDead);
  world.playerIsOnRaft = cloneUint8(snapshot.playerIsOnRaft);
  world.enemyKind = cloneUint8(snapshot.enemyKind);
  world.enemyIsBoss = cloneUint8(snapshot.enemyIsBoss);
  world.enemyHealth = cloneFloat32(snapshot.enemyHealth);
  world.enemyMaxHealth = cloneFloat32(snapshot.enemyMaxHealth);
  world.enemyHitTimer = cloneFloat32(snapshot.enemyHitTimer);
  world.enemyDamage = cloneFloat32(snapshot.enemyDamage);
  world.enemySpeed = cloneFloat32(snapshot.enemySpeed);
  world.enemyAggroRange = cloneFloat32(snapshot.enemyAggroRange);
  world.enemyAttackRange = cloneFloat32(snapshot.enemyAttackRange);
  world.enemyAttackCooldown = cloneFloat32(snapshot.enemyAttackCooldown);
  world.enemyAttackTimer = cloneFloat32(snapshot.enemyAttackTimer);
  world.enemyWanderAngle = cloneFloat32(snapshot.enemyWanderAngle);
  world.enemyWanderTimer = cloneFloat32(snapshot.enemyWanderTimer);
  world.enemyHomeIsland = cloneInt16(snapshot.enemyHomeIsland);
  world.resourceNodeType = cloneUint8(snapshot.resourceNodeType);
  world.resourceKind = cloneUint8(snapshot.resourceKind);
  world.resourceRotation = cloneFloat32(snapshot.resourceRotation);
  world.resourceYieldMin = cloneInt16(snapshot.resourceYieldMin);
  world.resourceYieldMax = cloneInt16(snapshot.resourceYieldMax);
  world.resourceRemaining = cloneInt16(snapshot.resourceRemaining);
  world.resourceRespawnTime = cloneFloat32(snapshot.resourceRespawnTime);
  world.resourceRespawnTimer = cloneFloat32(snapshot.resourceRespawnTimer);
  world.inventoryKind = cloneInt16(snapshot.inventoryKind);
  world.inventoryQuantity = cloneInt16(snapshot.inventoryQuantity);
  world.inventorySelected = cloneUint8(snapshot.inventorySelected);
  world.equipmentKind = cloneInt16(snapshot.equipmentKind);
  world.groundItemKind = cloneUint8(snapshot.groundItemKind);
  world.groundItemQuantity = cloneInt16(snapshot.groundItemQuantity);
  world.groundItemDroppedAt = cloneFloat32(snapshot.groundItemDroppedAt);
  world.propKind = cloneUint8(snapshot.propKind);
};
