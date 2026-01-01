import type { GameState } from "../game/state";
import { destroyEntity, forEachEntity, isEntityAlive, type EntityId } from "../core/ecs";
import { addToInventory } from "../game/inventory";
import { GROUND_ITEM_PICKUP_COOLDOWN, GROUND_ITEM_PICKUP_RANGE } from "../game/ground-items-config";
import { GROUND_ITEM_MASK } from "../game/ground-items";
import { itemKindFromIndex } from "../game/item-kinds";

export const pickupGroundItems = (state: GameState, playerId: EntityId) => {
  const ecs = state.ecs;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const pickupRange = GROUND_ITEM_PICKUP_RANGE + ecs.radius[playerId];
  const playerX = ecs.position.x[playerId];
  const playerY = ecs.position.y[playerId];
  forEachEntity(ecs, GROUND_ITEM_MASK, (id) => {
    if (state.time - ecs.groundItemDroppedAt[id] < GROUND_ITEM_PICKUP_COOLDOWN) {
      return;
    }

    const dx = ecs.position.x[id] - playerX;
    const dy = ecs.position.y[id] - playerY;
    const dist = Math.hypot(dx, dy);

    if (dist > pickupRange) {
      return;
    }

    const kind = itemKindFromIndex(ecs.groundItemKind[id]);
    const added = addToInventory(ecs, playerId, kind, ecs.groundItemQuantity[id]);
    if (added <= 0) {
      return;
    }

    ecs.groundItemQuantity[id] -= added;
    if (ecs.groundItemQuantity[id] <= 0) {
      destroyEntity(ecs, id);
    }
  });
};
