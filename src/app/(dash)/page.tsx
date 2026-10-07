import Link from "next/link";
import { listProviders } from "@/lib/store";
import { maskSecret } from "@/lib/config";
import { fetchStats, fmt, type StatsView } from "@/lib/dash";

export const dynamic = "force-dynamic";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default async function OverviewPage() {
  const stats: StatsView | null = await fetchStats();
  const providers = await listProviders().catch(() => []);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-2xl font-bold">Overview</h1>
      <p className="mb-6 text-sm text-zinc-500">
        OpenAI-compatible router — multi-key providers with automatic failover and token tracking.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total requests" value={String(stats?.totalRequests ?? 0)} sub={`${stats?.successRate ?? 100}% success`} />
        <StatCard label="Total tokens" value={fmt(stats?.totalTokens ?? 0)} sub={`${fmt(stats?.promptTokens ?? 0)} in / ${fmt(stats?.completionTokens ?? 0)} out`} />
        <StatCard label="Avg latency" value={`${stats?.avgLatencyMs ?? 0}ms`} sub="upstream round-trip" />
        <StatCard
          label="Providers"
          value={`${providers.filter((p) => p.enabled).length}/${providers.length}`}
          sub={`${stats?.keys.length ?? 0} keys tracked`}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Providers</h2>
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {providers.length === 0 && (
          <div className="card text-sm text-zinc-400">
            No providers configured. Set <code className="inline">PROVIDERS_JSON</code> in your
            environment — see <Link href="/docs" className="text-accent underline">Docs</Link>.
          </div>
        )}
        {providers.map((p) => {
          const keyStats = stats?.keys.filter((k) => k.provider === p.name) ?? [];
          return (
            <div key={p.name} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.enabled ? "bg-emerald-400" : "bg-zinc-600"}`} />
                  <span className="font-semibold">{p.name}</span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                    {p.apiKeys.length} key{p.apiKeys.length > 1 ? "s" : ""}
                  </span>
                </div>
                <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                  #{p.priority}
                </span>
              </div>
              <div className="mt-2 truncate font-mono text-xs text-zinc-500">{p.baseUrl}</div>

              <div className="mt-3 space-y-1">
                {p.apiKeys.map((k) => {
                  const masked = maskSecret(k);
                  const ks = keyStats.find((s) => s.keyMasked === masked);
                  return (
                    <div key={masked} className="flex items-center justify-between font-mono text-xs">
                      <span className={ks?.cooling ? "text-amber-300" : "text-zinc-400"}>
                        {ks?.cooling ? "⏳" : "●"} {masked}
                        {ks?.cooling && <span className="ml-1">cooldown {Math.ceil((ks.cooldownMs ?? 0) / 1000)}s</span>}
                      </span>
                      <span className="text-zinc-500">
                        {ks ? `${ks.requests} req · ${fmt(ks.totalTokens)} tok` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-1 border-t border-zinc-800 pt-3">
                {p.models.slice(0, 6).map((m) => (
                  <span key={m} className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300">
                    {m}
                  </span>
                ))}
                {p.models.length > 6 && (
                  <span className="px-1 text-xs text-zinc-500">+{p.models.length - 6} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Recent requests</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Provider / Key</th>
              <th className="px-4 py-3">Tokens</th>
              <th className="px-4 py-3">Latency</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(!stats || stats.recent.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No requests yet — try the <Link href="/playground" className="text-accent underline">Playground</Link>.
                </td>
              </tr>
            )}
            {(stats?.recent ?? []).map((r, i) => (
              <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-zinc-500">
                  {new Date(r.time).toLocaleTimeString()}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.model}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.provider} · {r.keyMasked}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {r.totalTokens > 0 ? fmt(r.totalTokens) : "—"}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.latencyMs}ms</td>
                <td className="px-4 py-2">
                  {r.success ? (
                    <span className="text-emerald-400">✓ ok</span>
                  ) : (
                    <span className="text-red-400" title={r.error}>✗ {r.error || "failed"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
