import type { EntityId } from "../core/ecs";
import { nextFloat } from "../core/rng";
import { type EnemyKind, enemyKindFromIndex } from "./enemy-kinds";
import { spawnGroundItem } from "./ground-items";
import { GROUND_ITEM_DROP_OFFSET } from "./ground-items-config";
import type { ItemKind } from "./item-kinds";
import type { GameState } from "./state";

type LootEntry = {
  kind: ItemKind;
  quantity: number;
  offsetScale?: number;
  bossOnly?: boolean;
};

const ENEMY_LOOT_TABLE: Record<EnemyKind, LootEntry[]> = {
  crab: [
    { kind: "crabmeat", quantity: 1 },
    { kind: "crabhelmet", quantity: 1, offsetScale: 1.2, bossOnly: true },
  ],
  wolf: [
    { kind: "wolfmeat", quantity: 1 },
    { kind: "wolfcloak", quantity: 1, offsetScale: 1.2, bossOnly: true },
  ],
  kraken: [{ kind: "krakenring", quantity: 1 }],
  magmaSlime: [],
};

const getEnemyLoot = (kind: EnemyKind, isBoss: boolean) =>
  ENEMY_LOOT_TABLE[kind].filter((entry) => !entry.bossOnly || isBoss);

export const dropEnemyLoot = (state: GameState, enemyId: EntityId) => {
  const ecs = state.ecs;
  const rng = state.rng;
  const kind = enemyKindFromIndex(ecs.enemyKind[enemyId]);
  const isBoss = ecs.enemyIsBoss[enemyId] === 1;
  const drops = getEnemyLoot(kind, isBoss);

  for (const entry of drops) {
    const angle = nextFloat(rng) * Math.PI * 2;
    const offset = GROUND_ITEM_DROP_OFFSET * (entry.offsetScale ?? 1);
    spawnGroundItem(
      ecs,
      entry.kind,
      entry.quantity,
      {
        x: ecs.position.x[enemyId] + Math.cos(angle) * offset,
        y: ecs.position.y[enemyId] + Math.sin(angle) * offset,
      },
      state.time
    );
  }
};
