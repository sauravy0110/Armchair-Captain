/**
 * Sliding-window limiter held in memory. Practical for a single instance / low-traffic demo.
 * On serverless (Vercel) each instance has its own memory, so this is best-effort; use a shared store
 * (e.g. Upstash Redis / Vercel KV) or platform WAF rules for hard guarantees.
 */
export function createLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  const maxKeys = opts.maxKeys ?? 5000;
  return {
    /** Returns true if the call is allowed (and records it). */
    check(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
      if (recent.length >= opts.limit) { hits.set(key, recent); return false; }
      recent.push(now); hits.delete(key); hits.set(key, recent);
      if (hits.size > maxKeys) { const oldest = hits.keys().next().value; if (oldest !== undefined) hits.delete(oldest); }
      return true;
    },
    size: () => hits.size,
  };
}
export const clientKey = (req: Request) => (req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
