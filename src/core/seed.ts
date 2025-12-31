export const normalizeSeed = (seed: string | number) => {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  const value = String(seed).trim();
  if (value.length === 0) {
    return 0;
  }

  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10) >>> 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
