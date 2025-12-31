import type { GameState } from "../game/state";
import { addToInventory } from "../game/inventory";
import { GROUND_ITEM_PICKUP_COOLDOWN, GROUND_ITEM_PICKUP_RANGE } from "../game/ground-items-config";
import { isEntityAlive } from "../core/ecs";

export const pickupGroundItems = (state: GameState) => {
  const playerId = state.playerId;
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const pickupRange = GROUND_ITEM_PICKUP_RANGE + ecs.radius[playerId];
  const playerX = ecs.position.x[playerId];
  const playerY = ecs.position.y[playerId];

  for (let i = state.groundItems.length - 1; i >= 0; i -= 1) {
    const item = state.groundItems[i];
    if (state.time - item.droppedAt < GROUND_ITEM_PICKUP_COOLDOWN) {
      continue;
    }

    const dx = item.position.x - playerX;
    const dy = item.position.y - playerY;
    const dist = Math.hypot(dx, dy);

    if (dist > pickupRange) {
      continue;
    }

    const added = addToInventory(state.inventory, item.kind, item.quantity);
    if (added <= 0) {
      continue;
    }

    item.quantity -= added;
    if (item.quantity <= 0) {
      state.groundItems.splice(i, 1);
    }
  }
};
