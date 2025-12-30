export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const normalize = (x: number, y: number) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};
