/**
 * Fixed-window in-memory rate limiter. Good enough for a friends league on one server
 * process; on serverless each warm instance keeps its own window, which still blunts
 * brute-force and accidental double-submits. Swap for a shared store if you ever need more.
 */
type Window = { count: number; resetAt: number };
const store: Map<string, Window> = ((globalThis as unknown as { __leagueRate?: Map<string, Window> }).__leagueRate ??= new Map());

export function rateLimit(key: string, limit: { max: number; windowMs: number }, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  if (store.size > 5000) for (const [k, w] of store) if (w.resetAt <= now) store.delete(k);
  const w = store.get(key);
  if (!w || w.resetAt <= now) { store.set(key, { count: 1, resetAt: now + limit.windowMs }); return { ok: true, retryAfterSec: 0 }; }
  w.count += 1;
  if (w.count > limit.max) return { ok: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

export function resetRateLimits() { store.clear(); }
