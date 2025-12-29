export type EntityId = number;

export type Entity = {
  id: EntityId;
  position: { x: number; y: number };
  prevPosition: { x: number; y: number };
  velocity: { x: number; y: number };
  radius: number;
  tag: "player" | "crab" | "resource";
};
