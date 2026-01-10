export type CreatureStats = {
  radius: number;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  wanderTimerMin: number;
  wanderTimerMax: number;
};

export type EnemyStats = {
  radius: number;
  health: number;
  maxHealth: number;
};

export type KrakenStats = EnemyStats & {
  damage: number;
  speed: number;
  attackCooldown: number;
  wanderTimerMin: number;
  wanderTimerMax: number;
};

export const STANDARD_CRAB_COUNT = 2;
export const FOREST_WOLF_COUNT = 3;
export const MAGMA_SLIME_COUNT = 4;
export const WOLF_BOSS_COUNT = 1;
export const BEACH_BOSS_CRAB_COUNT = 1;
export const MAGMA_COLOSSUS_COUNT = 1;
export const KRAKEN_SPAWN_COUNT = 3;

export const CRAB_BEACH_RING_MIN = 0.82;
export const CRAB_BEACH_RING_MAX = 1.0;
export const CRAB_SPAWN_ATTEMPTS = 40;
export const CRAB_SPAWN_RADIUS_SCALE = 0.95;
export const CRAB_BOSS_RADIUS_SCALE = 0.85;
export const WOLF_INLAND_RING_MIN = 0.18;
export const WOLF_INLAND_RING_MAX = 0.7;
export const MAGMA_RING_MIN = 0.2;
export const MAGMA_RING_MAX = 0.8;

export const CRAB_DEFAULT_STATS: CreatureStats = {
  radius: 16,
  health: 30,
  maxHealth: 30,
  damage: 15,
  speed: 55,
  aggroRange: 90,
  attackRange: 20,
  attackCooldown: 1.2,
  wanderTimerMin: 1.5,
  wanderTimerMax: 3.5,
};

export const CRAB_BOSS_STATS: CreatureStats = {
  radius: 130,
  health: 260,
  maxHealth: 260,
  damage: 35,
  speed: 38,
  aggroRange: 280,
  attackRange: 60,
  attackCooldown: 1.4,
  wanderTimerMin: 1.8,
  wanderTimerMax: 3.8,
};

export const WOLF_DEFAULT_STATS: CreatureStats = {
  radius: 22,
  health: 70,
  maxHealth: 70,
  damage: 20,
  speed: 75,
  aggroRange: 120,
  attackRange: 24,
  attackCooldown: 1.05,
  wanderTimerMin: 1.2,
  wanderTimerMax: 2.8,
};

export const WOLF_BOSS_STATS: CreatureStats = {
  radius: 58,
  health: 220,
  maxHealth: 220,
  damage: 48,
  speed: 60,
  aggroRange: 170,
  attackRange: 34,
  attackCooldown: 1.2,
  wanderTimerMin: 1.6,
  wanderTimerMax: 3.4,
};

export const WOLF_SPAWN_RADIUS_SCALE = 0.7;
export const WOLF_BOSS_RADIUS_SCALE = 0.6;

export const MAGMA_SLIME_STATS: CreatureStats = {
  radius: 20,
  health: 90,
  maxHealth: 90,
  damage: 26,
  speed: 50,
  aggroRange: 110,
  attackRange: 22,
  attackCooldown: 1.1,
  wanderTimerMin: 1.4,
  wanderTimerMax: 3.2,
};

export const MAGMA_COLOSSUS_STATS: CreatureStats = {
  radius: 90,
  health: 340,
  maxHealth: 340,
  damage: 62,
  speed: 40,
  aggroRange: 220,
  attackRange: 50,
  attackCooldown: 1.35,
  wanderTimerMin: 1.7,
  wanderTimerMax: 3.6,
};

export const MAGMA_SPAWN_RADIUS_SCALE = 0.7;
export const MAGMA_BOSS_RADIUS_SCALE = 0.6;

export const KRAKEN_STATS: KrakenStats = {
  radius: 72,
  health: 200,
  maxHealth: 200,
  damage: 75,
  speed: 26,
  attackCooldown: 1.4,
  wanderTimerMin: 1.8,
  wanderTimerMax: 3.6,
};

export const KRAKEN_SPAWN_MIN_DISTANCE = 520;
export const KRAKEN_SPAWN_MAX_DISTANCE = 740;
export const KRAKEN_SPAWN_ATTEMPTS = 40;
