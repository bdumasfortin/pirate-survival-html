import type { GameState } from "../game/state";
import type { InputState } from "../core/input";
import { isEntityAlive } from "../core/ecs";
import { PLAYER_SPEED, RAFT_SPEED } from "../game/config";

export const updateMovement = (state: GameState, input: InputState, delta: number) => {
  if (state.isDead) {
    return;
  }
  const playerId = state.playerId;
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  ecs.prevPosition.x[playerId] = ecs.position.x[playerId];
  ecs.prevPosition.y[playerId] = ecs.position.y[playerId];

  const speed = state.raft.isOnRaft ? RAFT_SPEED : PLAYER_SPEED;
  const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(dirX, dirY) || 1;

  ecs.velocity.x[playerId] = (dirX / length) * speed;
  ecs.velocity.y[playerId] = (dirY / length) * speed;

  ecs.position.x[playerId] += ecs.velocity.x[playerId] * delta;
  ecs.position.y[playerId] += ecs.velocity.y[playerId] * delta;

  const movementSpeed = Math.hypot(ecs.velocity.x[playerId], ecs.velocity.y[playerId]);
  if (movementSpeed > 0.01) {
    state.moveAngle = Math.atan2(ecs.velocity.y[playerId], ecs.velocity.x[playerId]);
  }
};

