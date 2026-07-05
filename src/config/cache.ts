import { state } from './state';
import { CACHE_TTL_DEFAULT, CACHE_MAX_SIZE } from './constants';

export function cacheGet(key: string, ttlMs?: number): unknown | null {
  const entry = state._cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > (ttlMs || CACHE_TTL_DEFAULT)) {
    state._cache.delete(key);
    return null;
  }
  return entry.val;
}

export function cacheSet(key: string, val: unknown, ttlMs?: number): void {
  if (state._cache.size >= CACHE_MAX_SIZE) {
    const oldest = Array.from(state._cache.keys()).slice(0, 50);
    oldest.forEach((k) => state._cache.delete(k));
  }
  state._cache.set(key, { val, ts: Date.now(), ttl: ttlMs || CACHE_TTL_DEFAULT });
}

export function cacheInvalidate(userId: string): void {
  const prefix = `${userId}:`;
  for (const key of state._cache.keys()) {
    if (key.startsWith(prefix)) state._cache.delete(key);
  }
}
