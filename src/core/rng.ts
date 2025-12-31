export type RngState = {
  state: number;
};

export const createRng = (seed: number): RngState => ({
  state: seed >>> 0
});

export const nextFloat = (rng: RngState) => {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let x = rng.state;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};

export const nextRange = (rng: RngState, min: number, max: number) => min + nextFloat(rng) * (max - min);

export const nextInt = (rng: RngState, min: number, max: number) => {
  if (max <= min) {
    return min;
  }
  return Math.floor(nextFloat(rng) * (max - min + 1)) + min;
};
