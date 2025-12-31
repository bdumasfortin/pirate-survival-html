export type EnemyKind = "crab" | "wolf" | "kraken";

export const ENEMY_KIND_TO_INDEX: Record<EnemyKind, number> = {
  crab: 1,
  wolf: 2,
  kraken: 3
};

const ENEMY_KIND_BY_INDEX: EnemyKind[] = ["crab", "wolf", "kraken"];

export const enemyKindToIndex = (kind: EnemyKind) => ENEMY_KIND_TO_INDEX[kind];

export const enemyKindFromIndex = (index: number): EnemyKind =>
  ENEMY_KIND_BY_INDEX[index - 1] ?? "crab";
