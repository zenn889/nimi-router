// Per-key rotation + cooldown state.
// Round-robin spreads load across a provider's keys; a key that errors
// (429 rate-limit, 401/403 bad key) is cooled down so traffic moves to healthy keys.
// In-memory per instance (resets on Vercel cold start) — fine for routing decisions.

const rrIndex = new Map<string, number>();
const cooldownUntil = new Map<string, number>(); // `${provider}::${key}` -> epoch ms

function ck(provider: string, key: string): string {
  return `${provider}::${key}`;
}

export function isCooling(provider: string, key: string): boolean {
  return (cooldownUntil.get(ck(provider, key)) ?? 0) > Date.now();
}

export function cooldownMs(provider: string, key: string): number {
  return Math.max(0, (cooldownUntil.get(ck(provider, key)) ?? 0) - Date.now());
}

/** Cool a key down for `ms` after an error. */
export function cooldownKey(provider: string, key: string, ms: number): void {
  cooldownUntil.set(ck(provider, key), Date.now() + ms);
}

/** Snapshot of currently-cooling keys (for the dashboard). */
export function coolingSnapshot(): { provider: string; key: string; msLeft: number }[] {
  const now = Date.now();
  const out: { provider: string; key: string; msLeft: number }[] = [];
  for (const [k, until] of cooldownUntil) {
    if (until > now) {
      const sep = k.indexOf("::");
      out.push({ provider: k.slice(0, sep), key: k.slice(sep + 2), msLeft: until - now });
    }
  }
  return out;
}

/**
 * Keys in round-robin order, skipping keys on cooldown.
 * If every key is cooling, returns them all anyway (best effort).
 */
export function orderedKeys(provider: string, keys: string[]): string[] {
  const fresh = keys.filter((k) => !isCooling(provider, k));
  const pool = fresh.length > 0 ? fresh : keys;
  if (pool.length <= 1) return [...pool];
  const start = (rrIndex.get(provider) ?? 0) % pool.length;
  rrIndex.set(provider, start + 1);
  return [...pool.slice(start), ...pool.slice(0, start)];
}
