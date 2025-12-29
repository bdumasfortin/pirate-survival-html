export type SurvivalStats = {
  health: number;
  hunger: number;
  thirst: number;
  maxHealth: number;
  maxHunger: number;
  maxThirst: number;
};

export const createSurvivalStats = (): SurvivalStats => ({
  health: 100,
  hunger: 100,
  thirst: 100,
  maxHealth: 100,
  maxHunger: 100,
  maxThirst: 100
});
