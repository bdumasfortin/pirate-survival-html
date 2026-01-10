import type { Client } from "./types.js";

export const RATE_WINDOW_SHORT_MS = 1000;
export const RATE_WINDOW_MEDIUM_MS = 10 * 1000;

export const RATE_CREATE_LIMIT = 3;
export const RATE_JOIN_LIMIT = 3;
export const RATE_START_LIMIT = 5;
export const RATE_RESYNC_REQUEST_LIMIT = 20;
export const RATE_STATE_HASH_LIMIT = 20;
export const RATE_RESYNC_META_LIMIT = 5;
export const RATE_RESYNC_CHUNK_LIMIT = 400;
export const RATE_BINARY_LIMIT = 240;

export const allowRate = (client: Client, key: string, limit: number, windowMs: number): boolean => {
  const now = Date.now();
  const entry = client.rateLimits.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    client.rateLimits.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
};
