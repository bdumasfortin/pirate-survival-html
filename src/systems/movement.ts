import type { GameState } from "../game/state";
import type { InputState } from "../core/input";
import { isEntityAlive, type EntityId } from "../core/ecs";
import { PLAYER_SPEED, RAFT_SPEED } from "../game/config";

export const updateMovement = (state: GameState, playerId: EntityId, input: InputState, delta: number) => {
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }
  if (ecs.playerIsDead[playerId]) {
    return;
  }

  ecs.prevPosition.x[playerId] = ecs.position.x[playerId];
  ecs.prevPosition.y[playerId] = ecs.position.y[playerId];

  const speed = ecs.playerIsOnRaft[playerId] ? RAFT_SPEED : PLAYER_SPEED;
  const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(dirX, dirY) || 1;

  ecs.velocity.x[playerId] = (dirX / length) * speed;
  ecs.velocity.y[playerId] = (dirY / length) * speed;

  ecs.position.x[playerId] += ecs.velocity.x[playerId] * delta;
  ecs.position.y[playerId] += ecs.velocity.y[playerId] * delta;

  const movementSpeed = Math.hypot(ecs.velocity.x[playerId], ecs.velocity.y[playerId]);
  if (movementSpeed > 0.01) {
    ecs.playerMoveAngle[playerId] = Math.atan2(ecs.velocity.y[playerId], ecs.velocity.x[playerId]);
  }
};

