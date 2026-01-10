import type { EcsWorld } from "../core/ecs";
import { ComponentMask, createEntity, EntityTag } from "../core/ecs";
import type { Vec2 } from "../core/types";
import { itemKindToIndex } from "../game/item-kinds";
import { resourceNodeTypeToIndex } from "./resource-node-types";
import type { Island, IslandType, ResourceNodeType, WorldConfig, WorldState } from "./types";
import { BASE_ISLAND_RADIUS, RESOURCE_NODE_CONFIGS, type ResourceNodeConfig, SPAWN_ZONE_RADIUS } from "./world-config";

type TestIslandSpec = {
  center: Vec2;
  radius: number;
  type: IslandType;
  seedOffset: number;
};

type ResourcePlacement = {
  nodeType: ResourceNodeType;
  position: Vec2;
  rotation: number;
};

const RESOURCE_MASK = ComponentMask.Position | ComponentMask.Radius | ComponentMask.Tag | ComponentMask.Resource;

const RESOURCE_CONFIG_BY_NODE = RESOURCE_NODE_CONFIGS.reduce(
  (acc, config) => {
    acc[config.nodeType] = config;
    return acc;
  },
  {} as Record<ResourceNodeType, ResourceNodeConfig>
);

const TEST_ISLAND_POINT_COUNT = 36;
const TEST_ISLAND_OFFSET = BASE_ISLAND_RADIUS * 2.6;
const TEST_ISLAND_DIAGONAL = BASE_ISLAND_RADIUS * 2.2;
const TEST_SPAWN_RADIUS = BASE_ISLAND_RADIUS * 1.1;
const TEST_SIDE_RADIUS = BASE_ISLAND_RADIUS * 0.9;

const TEST_ISLAND_SPECS: TestIslandSpec[] = [
  { center: { x: 0, y: 0 }, radius: TEST_SPAWN_RADIUS, type: "beach", seedOffset: 11 },
  { center: { x: TEST_ISLAND_OFFSET, y: 0 }, radius: TEST_SIDE_RADIUS, type: "woods", seedOffset: 37 },
  { center: { x: -TEST_ISLAND_OFFSET, y: 0 }, radius: TEST_SIDE_RADIUS, type: "calmBoss", seedOffset: 59 },
  { center: { x: 0, y: TEST_ISLAND_OFFSET }, radius: TEST_SIDE_RADIUS, type: "wildBoss", seedOffset: 83 },
  { center: { x: 0, y: -TEST_ISLAND_OFFSET }, radius: TEST_SIDE_RADIUS, type: "volcanic", seedOffset: 101 },
  {
    center: { x: TEST_ISLAND_DIAGONAL, y: -TEST_ISLAND_DIAGONAL },
    radius: TEST_SIDE_RADIUS,
    type: "volcanicBoss",
    seedOffset: 127,
  },
];

const createCircularIsland = (center: Vec2, radius: number, type: IslandType, seed: number): Island => {
  const points: Vec2[] = [];
  for (let i = 0; i < TEST_ISLAND_POINT_COUNT; i += 1) {
    const angle = (i / TEST_ISLAND_POINT_COUNT) * Math.PI * 2;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }

  return { center, points, type, seed };
};

const getIslandRadius = (island: Island) => {
  if (island.points.length === 0) {
    return 0;
  }
  const sum = island.points.reduce((acc, point) => {
    return acc + Math.hypot(point.x - island.center.x, point.y - island.center.y);
  }, 0);
  return sum / island.points.length;
};

const addRingPlacements = (
  placements: ResourcePlacement[],
  center: Vec2,
  radius: number,
  nodeType: ResourceNodeType,
  count: number,
  angleOffset: number
) => {
  if (count <= 0) {
    return;
  }
  for (let i = 0; i < count; i += 1) {
    const angle = angleOffset + (i / count) * Math.PI * 2;
    placements.push({
      nodeType,
      position: {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      },
      rotation: angle,
    });
  }
};

const spawnResource = (ecs: EcsWorld, placement: ResourcePlacement) => {
  const config = RESOURCE_CONFIG_BY_NODE[placement.nodeType];
  const remaining = config.yield.max;
  const id = createEntity(ecs, RESOURCE_MASK, EntityTag.Resource);
  ecs.position.x[id] = placement.position.x;
  ecs.position.y[id] = placement.position.y;
  ecs.radius[id] = config.radius;
  ecs.resourceNodeType[id] = resourceNodeTypeToIndex(config.nodeType);
  ecs.resourceKind[id] = itemKindToIndex(config.kind);
  ecs.resourceRotation[id] = placement.rotation;
  ecs.resourceYieldMin[id] = config.yield.min;
  ecs.resourceYieldMax[id] = config.yield.max;
  ecs.resourceRemaining[id] = remaining;
  ecs.resourceRespawnTime[id] = config.respawnTime;
  ecs.resourceRespawnTimer[id] = 0;
};

export const createTestWorld = (config: WorldConfig): WorldState => {
  const islands = TEST_ISLAND_SPECS.map((spec) =>
    createCircularIsland(spec.center, spec.radius, spec.type, config.seed + spec.seedOffset)
  );

  return {
    config,
    islands,
  };
};

export const spawnTestResources = (ecs: EcsWorld, world: WorldState) => {
  if (world.islands.length === 0) {
    return;
  }

  const placements: ResourcePlacement[] = [];
  const spawnIsland = world.islands[0];
  const spawnRadius = getIslandRadius(spawnIsland);
  const spawnRing = Math.min(spawnRadius * 0.7, Math.max(SPAWN_ZONE_RADIUS + 70, spawnRadius * 0.55));

  addRingPlacements(placements, spawnIsland.center, spawnRing, "tree", 4, 0);
  addRingPlacements(placements, spawnIsland.center, spawnRing * 0.9, "rock", 4, Math.PI / 6);
  addRingPlacements(placements, spawnIsland.center, spawnRing * 0.75, "bush", 3, Math.PI / 4);

  const woodsIsland = world.islands[1];
  if (woodsIsland) {
    const radius = getIslandRadius(woodsIsland);
    addRingPlacements(placements, woodsIsland.center, radius * 0.6, "tree", 6, Math.PI / 8);
    addRingPlacements(placements, woodsIsland.center, radius * 0.45, "bush", 4, 0);
  }

  const calmBossIsland = world.islands[2];
  if (calmBossIsland) {
    const radius = getIslandRadius(calmBossIsland);
    addRingPlacements(placements, calmBossIsland.center, radius * 0.55, "rock", 7, Math.PI / 10);
  }

  const wildBossIsland = world.islands[3];
  if (wildBossIsland) {
    const radius = getIslandRadius(wildBossIsland);
    addRingPlacements(placements, wildBossIsland.center, radius * 0.55, "tree", 4, Math.PI / 3);
    addRingPlacements(placements, wildBossIsland.center, radius * 0.4, "rock", 3, Math.PI / 5);
  }

  const volcanicIsland = world.islands[4];
  if (volcanicIsland) {
    const radius = getIslandRadius(volcanicIsland);
    addRingPlacements(placements, volcanicIsland.center, radius * 0.5, "rock", 6, Math.PI / 6);
  }

  const volcanicBossIsland = world.islands[5];
  if (volcanicBossIsland) {
    const radius = getIslandRadius(volcanicBossIsland);
    addRingPlacements(placements, volcanicBossIsland.center, radius * 0.55, "rock", 8, Math.PI / 12);
  }

  placements.forEach((placement) => spawnResource(ecs, placement));
};
