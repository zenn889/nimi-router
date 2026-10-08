import { headers } from "next/headers";

export interface KeyStatView {
  provider: string;
  keyMasked: string;
  requests: number;
  success: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  cooling: boolean;
  cooldownMs: number;
  lastError?: string;
}

export interface DailyBucketView {
  date: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
}

export interface TopModelView {
  model: string;
  requests: number;
  totalTokens: number;
}

export interface StatsView {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  daily: DailyBucketView[];
  topModels: TopModelView[];
  keys: KeyStatView[];
  providers: { name: string; requests: number; success: number; failed: number; totalTokens: number }[];
  recent: {
    time: string; model: string; provider: string; keyMasked: string;
    success: boolean; latencyMs: number;
    promptTokens: number; completionTokens: number; totalTokens: number;
    error?: string;
  }[];
}

/** Fetch dashboard stats from the API route (shares module state with the router). */
export async function fetchStats(): Promise<StatsView | null> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const res = await fetch(`${proto}://${host}/api/stats`, {
      headers: { cookie: h.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as StatsView;
  } catch {
    return null;
  }
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
