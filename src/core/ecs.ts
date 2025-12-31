import type { Vec2 } from "./types";

export type EntityId = number;

export enum EntityTag {
  Player = 1,
  Enemy = 2,
  Resource = 3,
  GroundItem = 4
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
  GroundItem: 1 << 9
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
};

export const DEFAULT_ENTITY_MASK = ComponentMask.Position |
  ComponentMask.PrevPosition |
  ComponentMask.Velocity |
  ComponentMask.Radius |
  ComponentMask.Tag;

const createVec2Store = (capacity: number): Vec2Store => ({
  x: new Float32Array(capacity),
  y: new Float32Array(capacity)
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
  groundItemDroppedAt: new Float32Array(capacity)
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

export const isEntityAlive = (world: EcsWorld, id: EntityId) =>
  id >= 0 && id < world.nextId && world.alive[id] === 1;

export const hasComponents = (world: EcsWorld, id: EntityId, mask: number) =>
  (world.mask[id] & mask) === mask;

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
  y: cloneFloat32(store.y)
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
  groundItemDroppedAt: cloneFloat32(world.groundItemDroppedAt)
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
};
