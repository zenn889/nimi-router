"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";

interface DailyBucket {
  date: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
}

interface TopModel {
  model: string;
  requests: number;
  totalTokens: number;
}

interface LogRow {
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

interface Stats {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  daily: DailyBucket[];
  topModels: TopModel[];
  recent: LogRow[];
  db?: boolean;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat().format(n || 0);
}

/** Simple SVG area chart: requests per day, last 14 days. */
function RequestsChart({ daily }: { daily: DailyBucket[] }) {
  const W = 720;
  const H = 180;
  const PAD = 8;
  const max = Math.max(1, ...daily.map((d) => d.requests));
  const stepX = (W - PAD * 2) / Math.max(1, daily.length - 1);
  const pts = daily.map((d, i) => ({
    x: PAD + i * stepX,
    y: H - PAD - (d.requests / max) * (H - PAD * 2 - 20),
    ...d,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - PAD} L${pts[0].x.toFixed(1)},${H - PAD} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Requests per day">
        <defs>
          <linearGradient id="reqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e56a4a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e56a4a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={H - PAD - f * (H - PAD * 2 - 20)}
            y2={H - PAD - f * (H - PAD * 2 - 20)}
            stroke="var(--border-subtle)"
            strokeDasharray="3 4"
          />
        ))}
        <path d={area} fill="url(#reqFill)" />
        <path d={line} fill="none" stroke="#e56a4a" strokeWidth="2.5" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#e56a4a" stroke="var(--surface)" strokeWidth="1.5">
              <title>{`${p.date}: ${p.requests} requests`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--text-subtle)]">
        <span>{daily[0]?.date.slice(5)}</span>
        <span>{daily[daily.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

/** Horizontal bar chart of top models by requests. */
function TopModelsChart({ models }: { models: TopModel[] }) {
  const max = Math.max(1, ...models.map((m) => m.requests));
  if (models.length === 0) {
    return <div className="py-8 text-center text-sm text-[var(--text-subtle)]">No model usage yet.</div>;
  }
  return (
    <div className="space-y-2.5">
      {models.map((m) => (
        <div key={m.model}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate font-mono text-[var(--text)]" title={m.model}>
              {m.model}
            </span>
            <span className="ml-2 shrink-0 font-mono text-[var(--text-muted)]">
              {m.requests} req · {fmt(m.totalTokens)} tok
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all"
              style={{ width: `${Math.max(2, (m.requests / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UsageClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/stats").then((r) => r.json());
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  if (loading || !stats) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">Usage</h1>
          <p className="section-sub !mb-0">
            Token consumption, request volume, and logs across all providers.
            {stats.db && <span className="pill pill-green ml-2">Supabase</span>}
          </p>
        </div>
      </div>

      <div className="stagger mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Requests" value={fmt(stats.totalRequests)} sub={`${stats.successRate}% success`} tone="brand" />
        <StatCard label="Input Tokens" value={fmt(stats.promptTokens)} tone="blue" />
        <StatCard label="Output Tokens" value={fmt(stats.completionTokens)} tone="green" />
        <StatCard label="Avg Latency" value={`${stats.avgLatencyMs}ms`} sub="upstream round-trip" tone="amber" />
      </div>

      <div className="stagger mb-6 grid gap-4 lg:grid-cols-5">
        <Card title="Requests" icon="bar_chart" subtitle="Last 14 days" className="lg:col-span-3">
          <RequestsChart daily={stats.daily ?? []} />
        </Card>
        <Card title="Top Models" icon="star" subtitle="By request count" className="lg:col-span-2">
          <TopModelsChart models={stats.topModels ?? []} />
        </Card>
      </div>

      <Card title="Request Logs" icon="receipt_long" subtitle={`${stats.recent?.length ?? 0} recent`} className="anim-fade-up">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Model</th>
                <th>Provider / Key</th>
                <th>Tokens</th>
                <th>Latency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recent ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <span className="material-symbols-outlined mb-1 block text-[32px] text-[var(--text-subtle)]">inbox</span>
                    <div className="text-[var(--text-muted)]">No requests logged yet.</div>
                  </td>
                </tr>
              )}
              {(stats.recent ?? []).map((r, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap font-mono text-xs text-[var(--text-muted)]">
                    {new Date(r.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="font-mono text-xs">{r.model}</td>
                  <td className="font-mono text-xs text-[var(--text-muted)]">
                    {r.provider} <span className="text-[var(--text-subtle)]">·</span> {r.keyMasked}
                  </td>
                  <td className="font-mono text-xs">
                    {r.totalTokens > 0 ? fmt(r.totalTokens) : <span className="text-[var(--text-subtle)]">—</span>}
                  </td>
                  <td className="font-mono text-xs text-[var(--text-muted)]">{r.latencyMs}ms</td>
                  <td>
                    {r.success ? (
                      <span className="pill pill-green">ok</span>
                    ) : (
                      <span className="pill pill-red" title={r.error}>
                        {r.error ? r.error.slice(0, 28) : "failed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
