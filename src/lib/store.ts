// Storage layer: Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_KEY
// are set, otherwise read-only fallback to PROVIDERS_JSON env.
// All Supabase access uses the service_role key server-side only.

import { randomBytes } from "crypto";
import { dailyBuckets, topModels, type DailyBucket, type TopModel } from "./stats";

export interface ProviderRecord {
  id: string;
  name: string;
  baseUrl: string;
  apiKeys: string[];
  models: string[];
  priority: number;
  enabled: boolean;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  createdAt: string;
}

export interface LogEntry {
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

const SB_URL = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

export function isDbConfigured(): boolean {
  return !!(SB_URL && SB_KEY);
}

function sbHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SB_KEY!,
    Authorization: `Bearer ${SB_KEY!}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sb<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...init,
    headers: sbHeaders(init.headers as Record<string, string>),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- env fallback ----------

interface EnvProvider {
  name: string;
  baseUrl: string;
  apiKeys: string[];
  models: string[];
  priority: number;
  enabled: boolean;
}

function envProviders(): EnvProvider[] {
  try {
    const arr = JSON.parse(process.env.PROVIDERS_JSON || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p: Record<string, unknown>, i: number) => {
        const keys = Array.isArray(p.apiKeys)
          ? (p.apiKeys as unknown[]).map(String).filter(Boolean)
          : p.apiKey
            ? [String(p.apiKey)]
            : [];
        return {
          name: String(p.name || `provider-${i + 1}`),
          baseUrl: String(p.baseUrl || "").replace(/\/+$/, ""),
          apiKeys: [...new Set(keys)],
          models: Array.isArray(p.models) && p.models.length > 0 ? (p.models as string[]) : ["*"],
          priority: typeof p.priority === "number" ? p.priority : i,
          enabled: p.enabled !== false,
        };
      })
      .filter((p) => p.baseUrl && p.apiKeys.length > 0)
      .sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

// ---------- providers ----------

interface DbProvider {
  id: string;
  name: string;
  base_url: string;
  api_keys: string[];
  models: string[];
  priority: number;
  enabled: boolean;
}

function toRecord(d: DbProvider): ProviderRecord {
  return {
    id: d.id,
    name: d.name,
    baseUrl: d.base_url,
    apiKeys: d.api_keys ?? [],
    models: d.models ?? ["*"],
    priority: d.priority ?? 0,
    enabled: d.enabled !== false,
  };
}

export async function listProviders(): Promise<ProviderRecord[]> {
  if (!isDbConfigured()) {
    return envProviders().map((p, i) => ({ ...p, id: `env-${i}` }));
  }
  const rows = await sb<DbProvider[]>(`/providers?select=*&order=priority.asc`);
  return rows.map(toRecord);
}

export async function createProvider(p: {
  name: string; baseUrl: string; apiKeys: string[]; models: string[]; priority: number; enabled: boolean;
}): Promise<ProviderRecord> {
  if (!isDbConfigured()) throw new Error("Database not configured — set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  const rows = await sb<DbProvider[]>(`/providers`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({
      name: p.name,
      base_url: p.baseUrl,
      api_keys: p.apiKeys,
      models: p.models,
      priority: p.priority,
      enabled: p.enabled,
    }),
  });
  return toRecord(rows[0]);
}

export async function updateProvider(
  id: string,
  patch: Partial<{ name: string; baseUrl: string; apiKeys: string[]; models: string[]; priority: number; enabled: boolean }>
): Promise<void> {
  if (!isDbConfigured()) throw new Error("Database not configured.");
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.baseUrl !== undefined) body.base_url = patch.baseUrl;
  if (patch.apiKeys !== undefined) body.api_keys = patch.apiKeys;
  if (patch.models !== undefined) body.models = patch.models;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  await sb(`/providers?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteProvider(id: string): Promise<void> {
  if (!isDbConfigured()) throw new Error("Database not configured.");
  await sb(`/providers?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Seed the DB from PROVIDERS_JSON (skips names that already exist). Returns imported count. */
export async function importEnvProviders(): Promise<number> {
  if (!isDbConfigured()) throw new Error("Database not configured.");
  const existing = new Set((await listProviders()).map((p) => p.name));
  let n = 0;
  for (const p of envProviders()) {
    if (existing.has(p.name)) continue;
    await createProvider(p);
    n++;
  }
  return n;
}

// ---------- client API keys ----------

interface DbApiKey {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  created_at: string;
}

function toKeyRecord(d: DbApiKey): ApiKeyRecord {
  return { id: d.id, name: d.name, key: d.key, enabled: d.enabled, createdAt: d.created_at };
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  if (!isDbConfigured()) {
    const envKey = process.env.ROUTER_API_KEY;
    return envKey ? [{ id: "env", name: "env ROUTER_API_KEY", key: envKey, enabled: true, createdAt: "" }] : [];
  }
  const rows = await sb<DbApiKey[]>(`/api_keys?select=*&order=created_at.asc`);
  return rows.map(toKeyRecord);
}

export async function createApiKey(name: string): Promise<ApiKeyRecord> {
  if (!isDbConfigured()) throw new Error("Database not configured.");
  const key = `sk-nimi-${randomBytes(24).toString("hex")}`;
  const rows = await sb<DbApiKey[]>(`/api_keys`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ name, key, enabled: true }),
  });
  return toKeyRecord(rows[0]);
}

export async function deleteApiKey(id: string): Promise<void> {
  if (!isDbConfigured()) throw new Error("Database not configured.");
  await sb(`/api_keys?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function setApiKeyEnabled(id: string, enabled: boolean): Promise<void> {
  if (!isDbConfigured()) throw new Error("Database not configured.");
  await sb(`/api_keys?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

/** Find a client key by value (DB first, then env fallback). */
export async function findApiKey(key: string): Promise<ApiKeyRecord | null> {
  if (isDbConfigured()) {
    const rows = await sb<DbApiKey[]>(
      `/api_keys?select=*&key=eq.${encodeURIComponent(key)}&limit=1`
    ).catch(() => [] as DbApiKey[]);
    if (rows.length > 0) return toKeyRecord(rows[0]);
  }
  const envKey = process.env.ROUTER_API_KEY;
  if (envKey && timingSafeEqual(key, envKey)) {
    return { id: "env", name: "env ROUTER_API_KEY", key: envKey, enabled: true, createdAt: "" };
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- request logs ----------

export async function persistLog(e: LogEntry): Promise<void> {
  if (!isDbConfigured()) return;
  await sb(`/request_logs`, {
    method: "POST",
    body: JSON.stringify({
      time: e.time,
      model: e.model,
      provider: e.provider,
      key_masked: e.keyMasked,
      success: e.success,
      latency_ms: e.latencyMs,
      prompt_tokens: e.promptTokens,
      completion_tokens: e.completionTokens,
      total_tokens: e.totalTokens,
      error: e.error ?? null,
    }),
  }).catch(() => {
    /* logging must never break a request */
  });
}

interface DbLog {
  time: string;
  model: string;
  provider: string;
  key_masked: string;
  success: boolean;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  error: string | null;
}

export interface DbStats {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  daily: DailyBucket[];
  topModels: TopModel[];
  keys: {
    provider: string;
    keyMasked: string;
    requests: number;
    success: number;
    failed: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    avgLatencyMs: number;
    lastError?: string;
  }[];
  recent: {
    time: string; model: string; provider: string; keyMasked: string;
    success: boolean; latencyMs: number;
    promptTokens: number; completionTokens: number; totalTokens: number;
    error?: string;
  }[];
}

/** Aggregated stats from Postgres. Null when DB is not configured. */
export async function dbStats(): Promise<DbStats | null> {
  if (!isDbConfigured()) return null;
  const [aggRows, recentRows] = await Promise.all([
    sb<DbLog[]>(
      `/request_logs?select=provider,key_masked,success,latency_ms,prompt_tokens,completion_tokens,total_tokens,error,time,model&order=time.desc&limit=5000`
    ).catch(() => [] as DbLog[]),
    sb<DbLog[]>(
      `/request_logs?select=*&order=time.desc&limit=100`
    ).catch(() => [] as DbLog[]),
  ]);

  const byKey = new Map<string, DbStats["keys"][number]>();
  let ok = 0;
  let lat = 0;
  let pt = 0;
  let ct = 0;
  let tt = 0;

  for (const r of aggRows) {
    const k = `${r.provider}::${r.key_masked}`;
    let e = byKey.get(k);
    if (!e) {
      e = {
        provider: r.provider, keyMasked: r.key_masked,
        requests: 0, success: 0, failed: 0,
        promptTokens: 0, completionTokens: 0, totalTokens: 0,
        avgLatencyMs: 0,
      };
      byKey.set(k, e);
    }
    e.requests += 1;
    e.promptTokens += r.prompt_tokens;
    e.completionTokens += r.completion_tokens;
    e.totalTokens += r.total_tokens;
    (e as unknown as { _lat: number })._lat = ((e as unknown as { _lat: number })._lat ?? 0) + r.latency_ms;
    if (r.success) {
      e.success += 1;
      ok += 1;
    } else {
      e.failed += 1;
      if (r.error) e.lastError = r.error;
    }
    lat += r.latency_ms;
    pt += r.prompt_tokens;
    ct += r.completion_tokens;
    tt += r.total_tokens;
  }

  const keys = [...byKey.values()].map((e) => {
    const { _lat, ...rest } = e as unknown as { _lat: number } & DbStats["keys"][number];
    return { ...rest, avgLatencyMs: e.requests ? Math.round(_lat / e.requests) : 0 };
  });

  const total = aggRows.length;
  const normLogs = aggRows.map((r) => ({
    time: r.time,
    model: r.model,
    promptTokens: r.prompt_tokens,
    completionTokens: r.completion_tokens,
    totalTokens: r.total_tokens,
  }));
  return {
    totalRequests: total,
    successRate: total ? Math.round((ok / total) * 100) : 100,
    avgLatencyMs: total ? Math.round(lat / total) : 0,
    promptTokens: pt,
    completionTokens: ct,
    totalTokens: tt,
    daily: dailyBuckets(normLogs),
    topModels: topModels(normLogs),
    keys,
    recent: recentRows.map((r) => ({
      time: r.time, model: r.model, provider: r.provider, keyMasked: r.key_masked,
      success: r.success, latencyMs: r.latency_ms,
      promptTokens: r.prompt_tokens, completionTokens: r.completion_tokens, totalTokens: r.total_tokens,
      error: r.error ?? undefined,
    })),
  };
}
