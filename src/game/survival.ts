export type SurvivalStats = {
  health: number;
  hunger: number;
  maxHealth: number;
  maxHunger: number;
};

export const createSurvivalStats = (): SurvivalStats => ({
  health: 100,
  hunger: 100,
  maxHealth: 100,
  maxHunger: 100
});
