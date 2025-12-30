export type SurvivalStats = {
  health: number;
  hunger: number;
  maxHealth: number;
  maxHunger: number;
  armor: number;
  maxArmor: number;
  armorRegenTimer: number;
};

export const createSurvivalStats = (): SurvivalStats => ({
  health: 100,
  hunger: 100,
  maxHealth: 100,
  maxHunger: 100,
  armor: 0,
  maxArmor: 0,
  armorRegenTimer: 0
});
