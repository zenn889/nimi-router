import Link from "next/link";
import { listProviders } from "@/lib/store";
import { maskSecret } from "@/lib/config";
import { fetchStats, fmt, type StatsView } from "@/lib/dash";
import StatCard, { Icons } from "@/components/StatCard";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const stats: StatsView | null = await fetchStats();
  const providers = await listProviders().catch(() => []);
  const enabledCount = providers.filter((p) => p.enabled).length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="anim-fade-up mb-8">
        <h1 className="section-title">Overview</h1>
        <p className="section-sub">
          OpenAI-compatible router — multi-key providers with automatic failover and token tracking.
          {stats && (stats as StatsView & { db?: boolean }).db && (
            <span className="pill pill-green ml-2">Supabase connected</span>
          )}
        </p>
      </div>

      <div className="stagger mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total requests" value={String(stats?.totalRequests ?? 0)} sub={`${stats?.successRate ?? 100}% success rate`} icon={Icons.activity} accent="emerald" />
        <StatCard label="Total tokens" value={fmt(stats?.totalTokens ?? 0)} sub={`${fmt(stats?.promptTokens ?? 0)} in · ${fmt(stats?.completionTokens ?? 0)} out`} icon={Icons.zap} accent="amber" />
        <StatCard label="Avg latency" value={`${stats?.avgLatencyMs ?? 0}ms`} sub="upstream round-trip" icon={Icons.clock} accent="sky" />
        <StatCard label="Providers" value={`${enabledCount}/${providers.length}`} sub={`${stats?.keys.length ?? 0} keys tracked`} icon={Icons.layers} accent="violet" />
      </div>

      <div className="anim-fade-up mb-4 flex items-center justify-between" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-lg font-semibold tracking-tight">Providers</h2>
        <Link href="/providers" className="text-xs font-medium text-emerald-300 hover:text-emerald-200">
          Manage →
        </Link>
      </div>
      <div className="stagger mb-10 grid gap-4 md:grid-cols-2">
        {providers.length === 0 && (
          <div className="card border-dashed text-center text-sm text-zinc-500">
            <div className="mb-2 text-3xl">📦</div>
            No providers configured yet.
            <div className="mt-2">
              <Link href="/providers" className="text-emerald-300 underline">Add your first provider</Link>
            </div>
          </div>
        )}
        {providers.map((p) => {
          const keyStats = stats?.keys.filter((k) => k.provider === p.name) ?? [];
          const totalTok = keyStats.reduce((a, k) => a + k.totalTokens, 0);
          return (
            <div key={p.id} className="card card-hover">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.enabled ? "dot-live bg-emerald-400" : "bg-zinc-600"}`} />
                  <span className="font-semibold tracking-tight">{p.name}</span>
                  <span className="pill pill-zinc font-mono">
                    {p.apiKeys.length} key{p.apiKeys.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {totalTok > 0 && <span className="font-mono text-xs text-zinc-500">{fmt(totalTok)} tok</span>}
                  <span className="rounded-lg bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-zinc-500">
                    #{p.priority}
                  </span>
                </div>
              </div>
              <div className="mt-2 truncate font-mono text-[11px] text-zinc-600">{p.baseUrl}</div>

              <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
                {p.apiKeys.map((k) => {
                  const masked = maskSecret(k);
                  const ks = keyStats.find((s) => s.keyMasked === masked);
                  const okPct = ks && ks.requests ? Math.round((ks.success / ks.requests) * 100) : null;
                  return (
                    <div key={masked} className="flex items-center justify-between font-mono text-xs">
                      <span className={`flex items-center gap-1.5 ${ks?.cooling ? "text-amber-300" : "text-zinc-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ks?.cooling ? "bg-amber-400" : "bg-zinc-600"}`} />
                        {masked}
                        {ks?.cooling && (
                          <span className="pill pill-amber ml-1">cooldown {Math.ceil((ks.cooldownMs ?? 0) / 1000)}s</span>
                        )}
                      </span>
                      <span className="text-zinc-600">
                        {ks ? (
                          <>
                            <span className={okPct === 100 ? "text-emerald-400/80" : "text-amber-300/80"}>{okPct}%</span>
                            {" · "}{fmt(ks.totalTokens)} tok
                          </>
                        ) : (
                          <span className="text-zinc-700">idle</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="anim-fade-up mb-4" style={{ animationDelay: "0.15s" }}>
        <h2 className="text-lg font-semibold tracking-tight">Recent requests</h2>
      </div>
      <div className="table-wrap anim-fade-up" style={{ animationDelay: "0.18s" }}>
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
            {(!stats || stats.recent.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="mb-2 text-3xl">💬</div>
                  <div className="text-zinc-500">No requests yet.</div>
                  <Link href="/playground" className="mt-1 inline-block text-sm text-emerald-300 underline">
                    Try the Playground
                  </Link>
                </td>
              </tr>
            )}
            {(stats?.recent ?? []).map((r, i) => (
              <tr key={i}>
                <td className="font-mono text-xs text-zinc-500">
                  {new Date(r.time).toLocaleTimeString()}
                </td>
                <td className="font-mono text-xs text-zinc-300">{r.model}</td>
                <td className="font-mono text-xs text-zinc-400">{r.provider} <span className="text-zinc-600">·</span> {r.keyMasked}</td>
                <td className="font-mono text-xs">
                  {r.totalTokens > 0 ? (
                    <span className="text-zinc-300">{fmt(r.totalTokens)}</span>
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </td>
                <td className="font-mono text-xs text-zinc-500">{r.latencyMs}ms</td>
                <td>
                  {r.success ? (
                    <span className="pill pill-green">✓ ok</span>
                  ) : (
                    <span className="pill pill-red" title={r.error}>✗ {r.error || "failed"}</span>
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
