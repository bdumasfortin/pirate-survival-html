import type { Vec2 } from "../core/types";
import type { WorldState } from "../world/world";
import type { Enemy } from "./enemies";

export type Crab = Enemy & {
  velocity: Vec2;
  damage: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  wanderAngle: number;
  wanderTimer: number;
  homeIslandIndex: number;
};

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
};

const randomPointInIsland = (island: { center: Vec2; points: Vec2[] }, radiusScale = 0.9) => {
  let position = island.center;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const ring = 0.75 + Math.random() * 0.25;
    const radius = ring * radiusScale;
    position = {
      x: island.center.x + Math.cos(angle) * 260 * radius,
      y: island.center.y + Math.sin(angle) * 260 * radius
    };

    if (isPointInPolygon(position, island.points)) {
      return position;
    }
  }

  return position;
};

export const createCrabs = (world: WorldState): Crab[] => {
  if (world.islands.length === 0) {
    return [];
  }

  const spawnIsland = world.islands[0];
  const crabs: Crab[] = [];
  const count = 5;

  for (let i = 0; i < count; i += 1) {
    const position = randomPointInIsland(spawnIsland, 0.95);
    crabs.push({
      id: i + 1,
      kind: "crab",
      position,
      velocity: { x: 0, y: 0 },
      radius: 16,
      health: 30,
      maxHealth: 30,
      damage: 6,
      speed: 55,
      aggroRange: 90,
      attackRange: 20,
      attackCooldown: 1.2,
      attackTimer: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 1.5 + Math.random() * 2,
      homeIslandIndex: 0,
      hitTimer: 0
    });
  }


  const leftIslandIndex = world.islands.reduce((leftmostIndex, island, index, islands) => {
    return island.center.x < islands[leftmostIndex].center.x ? index : leftmostIndex;
  }, 0);
  const bossIsland = world.islands[leftIslandIndex];
  const bossPosition = randomPointInIsland(bossIsland, 0.85);
  crabs.push({
    id: count + 1,
    kind: "crab",
    position: bossPosition,
    velocity: { x: 0, y: 0 },
    radius: 130,
    health: 260,
    maxHealth: 260,
    damage: 16,
    speed: 38,
    aggroRange: 140,
    attackRange: 60,
    attackCooldown: 1.4,
    attackTimer: 0,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 1.8 + Math.random() * 2,
    homeIslandIndex: leftIslandIndex,
    hitTimer: 0
  });

  return crabs;
};
