import { type EntityId, isEntityAlive } from "../core/ecs";
import type { InputState } from "../core/input";
import { PLAYER_SPEED, RAFT_ACCEL, RAFT_DECEL, RAFT_SPEED } from "../game/config";
import type { GameState } from "../game/state";

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

  const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(dirX, dirY);
  const isOnRaft = ecs.playerIsOnRaft[playerId] === 1;

  if (isOnRaft) {
    const targetSpeed = length > 0.01 ? RAFT_SPEED : 0;
    const targetX = length > 0.01 ? (dirX / length) * targetSpeed : 0;
    const targetY = length > 0.01 ? (dirY / length) * targetSpeed : 0;
    const accel = length > 0.01 ? RAFT_ACCEL : RAFT_DECEL;
    const maxDelta = accel * delta;
    const dx = targetX - ecs.velocity.x[playerId];
    const dy = targetY - ecs.velocity.y[playerId];
    const distance = Math.hypot(dx, dy);
    if (distance <= maxDelta || distance === 0) {
      ecs.velocity.x[playerId] = targetX;
      ecs.velocity.y[playerId] = targetY;
    } else {
      const scale = maxDelta / distance;
      ecs.velocity.x[playerId] += dx * scale;
      ecs.velocity.y[playerId] += dy * scale;
    }
  } else {
    const speed = PLAYER_SPEED;
    const norm = length || 1;
    ecs.velocity.x[playerId] = (dirX / norm) * speed;
    ecs.velocity.y[playerId] = (dirY / norm) * speed;
  }

  ecs.position.x[playerId] += ecs.velocity.x[playerId] * delta;
  ecs.position.y[playerId] += ecs.velocity.y[playerId] * delta;

  const movementSpeed = Math.hypot(ecs.velocity.x[playerId], ecs.velocity.y[playerId]);
  if (movementSpeed > 0.01) {
    ecs.playerMoveAngle[playerId] = Math.atan2(ecs.velocity.y[playerId], ecs.velocity.x[playerId]);
  }
};
