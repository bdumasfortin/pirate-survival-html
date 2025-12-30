export type CrabStats = {
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

export const STANDARD_CRAB_COUNT = 4;
export const FOREST_WOLF_COUNT = 3;
export const BEACH_BOSS_CRAB_COUNT = 1;
export const KRAKEN_SPAWN_COUNT = 3;

export const CRAB_SPAWN_BASE_RADIUS = 260;
export const CRAB_SPAWN_RING_MIN = 0.75;
export const CRAB_SPAWN_RING_MAX = 1.0;
export const CRAB_SPAWN_ATTEMPTS = 40;
export const CRAB_SPAWN_RADIUS_SCALE = 0.95;
export const CRAB_BOSS_RADIUS_SCALE = 0.85;

export const CRAB_DEFAULT_STATS: CrabStats = {
  radius: 16,
  health: 30,
  maxHealth: 30,
  damage: 6,
  speed: 55,
  aggroRange: 90,
  attackRange: 20,
  attackCooldown: 1.2,
  wanderTimerMin: 1.5,
  wanderTimerMax: 3.5
};

export const CRAB_BOSS_STATS: CrabStats = {
  radius: 130,
  health: 260,
  maxHealth: 260,
  damage: 16,
  speed: 38,
  aggroRange: 140,
  attackRange: 60,
  attackCooldown: 1.4,
  wanderTimerMin: 1.8,
  wanderTimerMax: 3.8
};

export const WOLF_DEFAULT_STATS: CrabStats = {
  radius: 22,
  health: 70,
  maxHealth: 70,
  damage: 10,
  speed: 70,
  aggroRange: 120,
  attackRange: 24,
  attackCooldown: 1.05,
  wanderTimerMin: 1.2,
  wanderTimerMax: 2.8
};

export const WOLF_SPAWN_RADIUS_SCALE = 0.7;

export const KRAKEN_STATS: KrakenStats = {
  radius: 72,
  health: 200,
  maxHealth: 200,
  damage: 14,
  speed: 26,
  attackCooldown: 1.4,
  wanderTimerMin: 1.8,
  wanderTimerMax: 3.6
};

export const KRAKEN_SPAWN_MIN_DISTANCE = 520;
export const KRAKEN_SPAWN_MAX_DISTANCE = 740;
export const KRAKEN_SPAWN_ATTEMPTS = 40;
