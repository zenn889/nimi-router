// In-memory request stats, per API key with token usage.
// On Vercel serverless this is per-instance (resets on cold start).
// Raw keys never leave the server: pages mask them before rendering.

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface RequestLog {
  time: string;
  model: string;
  provider: string;
  keyMasked: string;
  success: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  error?: string;
}

export interface KeyStat {
  provider: string;
  /** Raw key — mask before rendering. Only used in server components. */
  key: string;
  requests: number;
  success: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  lastError?: string;
}

interface Counters {
  requests: number;
  success: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalLatencyMs: number;
  lastError?: string;
}

const MAX_LOGS = 100;
const recent: RequestLog[] = [];
const byKey = new Map<string, Counters>(); // `${provider}::${rawKey}`
let totalRequests = 0;

function mapKey(provider: string, rawKey: string): string {
  return `${provider}::${rawKey}`;
}

function entry(provider: string, rawKey: string): Counters {
  const k = mapKey(provider, rawKey);
  let c = byKey.get(k);
  if (!c) {
    c = {
      requests: 0, success: 0, failed: 0,
      promptTokens: 0, completionTokens: 0, totalTokens: 0,
      totalLatencyMs: 0,
    };
    byKey.set(k, c);
  }
  return c;
}

export function recordRequest(log: Omit<RequestLog, "keyMasked"> & { key: string; keyMasked: string }) {
  const { key, ...rest } = log;
  recent.unshift(rest);
  if (recent.length > MAX_LOGS) recent.pop();
  const c = entry(log.provider, key);
  c.requests += 1;
  c.totalLatencyMs += log.latencyMs;
  c.promptTokens += log.promptTokens;
  c.completionTokens += log.completionTokens;
  c.totalTokens += log.totalTokens;
  if (log.success) c.success += 1;
  else {
    c.failed += 1;
    if (log.error) c.lastError = log.error;
  }
  totalRequests += 1;
}

/** Add token usage discovered after the request was recorded (streaming). */
export function addTokens(provider: string, rawKey: string, u: TokenUsage) {
  const c = entry(provider, rawKey);
  c.promptTokens += u.prompt_tokens || 0;
  c.completionTokens += u.completion_tokens || 0;
  c.totalTokens += u.total_tokens || 0;
}

export interface DailyBucket {
  date: string; // YYYY-MM-DD
  requests: number;
  promptTokens: number;
  completionTokens: number;
}

export interface TopModel {
  model: string;
  requests: number;
  totalTokens: number;
}

/** Last N days (ascending) of request/token buckets from timestamped logs. */
export function dailyBuckets(
  logs: { time: string; promptTokens: number; completionTokens: number }[],
  days = 14
): DailyBucket[] {
  const buckets = new Map<string, DailyBucket>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, requests: 0, promptTokens: 0, completionTokens: 0 });
  }
  for (const l of logs) {
    const t = new Date(l.time);
    if (Number.isNaN(t.getTime())) continue;
    const b = buckets.get(t.toISOString().slice(0, 10));
    if (b) {
      b.requests += 1;
      b.promptTokens += l.promptTokens || 0;
      b.completionTokens += l.completionTokens || 0;
    }
  }
  return [...buckets.values()];
}

/** Most-used models by request count. */
export function topModels(
  logs: { model: string; totalTokens: number }[],
  limit = 8
): TopModel[] {
  const m = new Map<string, TopModel>();
  for (const l of logs) {
    const name = l.model || "unknown";
    const e = m.get(name) ?? { model: name, requests: 0, totalTokens: 0 };
    e.requests += 1;
    e.totalTokens += l.totalTokens || 0;
    m.set(name, e);
  }
  return [...m.values()].sort((a, b) => b.requests - a.requests).slice(0, limit);
}

export interface StatsSnapshot {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  keys: KeyStat[];
  providers: { name: string; requests: number; success: number; failed: number; totalTokens: number }[];
  recent: RequestLog[];
}

export function getStats(): StatsSnapshot {
  let ok = 0;
  let lat = 0;
  let pt = 0;
  let ct = 0;
  let tt = 0;
  const provAgg = new Map<string, { requests: number; success: number; failed: number; totalTokens: number }>();

  const keys: KeyStat[] = [...byKey.entries()].map(([k, c]) => {
    const sep = k.indexOf("::");
    const provider = k.slice(0, sep);
    const key = k.slice(sep + 2);
    ok += c.success;
    lat += c.totalLatencyMs;
    pt += c.promptTokens;
    ct += c.completionTokens;
    tt += c.totalTokens;
    const agg = provAgg.get(provider) ?? { requests: 0, success: 0, failed: 0, totalTokens: 0 };
    agg.requests += c.requests;
    agg.success += c.success;
    agg.failed += c.failed;
    agg.totalTokens += c.totalTokens;
    provAgg.set(provider, agg);
    return {
      provider,
      key,
      requests: c.requests,
      success: c.success,
      failed: c.failed,
      promptTokens: c.promptTokens,
      completionTokens: c.completionTokens,
      totalTokens: c.totalTokens,
      avgLatencyMs: c.requests ? Math.round(c.totalLatencyMs / c.requests) : 0,
      lastError: c.lastError,
    };
  });

  return {
    totalRequests,
    successRate: totalRequests ? Math.round((ok / totalRequests) * 100) : 100,
    avgLatencyMs: totalRequests ? Math.round(lat / totalRequests) : 0,
    promptTokens: pt,
    completionTokens: ct,
    totalTokens: tt,
    keys,
    providers: [...provAgg.entries()].map(([name, a]) => ({ name, ...a })),
    recent: [...recent],
  };
}
