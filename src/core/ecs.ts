import type { Vec2 } from "./types";

export type EntityId = number;

export enum EntityTag {
  Player = 1,
  Enemy = 2,
  Resource = 3
}

export const ComponentMask = {
  Position: 1 << 0,
  PrevPosition: 1 << 1,
  Velocity: 1 << 2,
  Radius: 1 << 3,
  Tag: 1 << 4,
  Enemy: 1 << 5,
  Resource: 1 << 6
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
  resourceRespawnTimer: new Float32Array(capacity)
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
