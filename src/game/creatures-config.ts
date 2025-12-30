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

export const CRAB_SPAWN_COUNT = 5;
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
