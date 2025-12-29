import type { GameState } from "../game/state";
import type { InputState } from "../core/input";

export const updateMovement = (state: GameState, input: InputState, delta: number) => {
  const player = state.entities.find((entity) => entity.id === state.playerId);

  if (!player) {
    return;
  }

  player.prevPosition.x = player.position.x;
  player.prevPosition.y = player.position.y;

  const speed = 120;
  const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(dirX, dirY) || 1;

  player.velocity.x = (dirX / length) * speed;
  player.velocity.y = (dirY / length) * speed;

  player.position.x += player.velocity.x * delta;
  player.position.y += player.velocity.y * delta;
};
