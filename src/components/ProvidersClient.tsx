"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeys: string[];
  apiKeysMasked: string[];
  models: string[];
  priority: number;
  enabled: boolean;
  disabledKeys: string[];
}

interface KeyStat {
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

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const NL = String.fromCharCode(10);
const emptyForm = { name: "", baseUrl: "", apiKeys: "", models: "*", priority: "0", enabled: true };

type StatusFilter = "all" | "active" | "issues";

export default function ProvidersClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [keyStats, setKeyStats] = useState<KeyStat[]>([]);
  const [db, setDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [testingAll, setTestingAll] = useState(false);
  const [testSummary, setTestSummary] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [pr, sr] = await Promise.all([
        fetch("/api/providers").then((r) => r.json()),
        fetch("/api/stats").then((r) => r.json()).catch(() => null),
      ]);
      setProviders(pr.providers ?? []);
      setKeyStats(sr?.keys ?? []);
      setDb(!!pr.db);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function providerHealth(p: Provider): "ok" | "issues" | "idle" {
    const stats = keyStats.filter((s) => s.provider === p.name);
    if (stats.some((s) => s.cooling || (s.lastError && s.failed > 0))) return "issues";
    if (stats.some((s) => s.requests > 0)) return "ok";
    return "idle";
  }

  const visible = providers.filter((p) => {
    if (filter === "all") return true;
    if (filter === "active") return p.enabled;
    return providerHealth(p) === "issues";
  });

  async function toggleEnabled(p: Provider) {
    if (!db) return;
    await fetch(`/api/providers/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    load();
  }

  async function testAll() {
    setTestingAll(true);
    setTestSummary("");
    try {
      let ok = 0;
      let total = 0;
      for (let i = 0; i < providers.length; i++) {
        const res = await fetch("/api/providers/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index: i }),
        });
        const data = await res.json().catch(() => ({}));
        const results = data.results ?? [];
        total += results.length;
        ok += results.filter((r: { ok: boolean }) => r.ok).length;
      }
      setTestSummary(`${ok}/${total} keys healthy across ${providers.length} provider(s)`);
    } catch {
      setTestSummary("Test failed — check your connection.");
    } finally {
      setTestingAll(false);
      load();
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKeys: form.apiKeys.split(NL).map((s) => s.trim()).filter(Boolean),
      models: form.models,
      priority: Number(form.priority || 0),
      enabled: form.enabled,
    };
    try {
      const res = await fetch(editing ? `/api/providers/${encodeURIComponent(editing.id)}` : "/api/providers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function importEnv() {
    if (!confirm("Import providers from PROVIDERS_JSON env into the database?")) return;
    const res = await fetch("/api/providers?action=import", { method: "PUT" });
    const data = await res.json();
    alert(data.imported != null ? `Imported ${data.imported} provider(s).` : data.error || "Import failed.");
    load();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-44 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">Providers</h1>
          <p className="section-sub !mb-0">
            {db ? (
              <>Stored in <span className="pill pill-green ml-1">Supabase</span> — changes apply instantly.</>
            ) : (
              "Database not configured — read-only view of PROVIDERS_JSON. Connect Supabase to manage from here."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="input !w-auto !py-2 text-xs"
            aria-label="Filter providers"
          >
            <option value="all">All providers</option>
            <option value="active">Active only</option>
            <option value="issues">Has issues</option>
          </select>
          {providers.length > 0 && (
            <button onClick={testAll} disabled={testingAll} className="btn-ghost text-sm">
              <span className={`material-symbols-outlined text-[18px] ${testingAll ? "animate-spin" : ""}`}>
                {testingAll ? "progress_activity" : "play_arrow"}
              </span>
              {testingAll ? "Testing…" : "Test All"}
            </button>
          )}
          {db && (
            <button onClick={importEnv} className="btn-ghost text-sm">
              <span className="material-symbols-outlined text-[18px]">upload</span>
              Import ENV
            </button>
          )}
          {db && (
            <button onClick={openAdd} className="btn text-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add provider
            </button>
          )}
        </div>
      </div>

      {testSummary && (
        <div className="anim-fade-in mb-4 flex items-center gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-sm">
          <span className="material-symbols-outlined text-[18px] text-[var(--brand)]">network_check</span>
          {testSummary}
        </div>
      )}

      {visible.length === 0 && (
        <div className="card anim-fade-up border-dashed py-12 text-center">
          <span className="material-symbols-outlined mb-2 block text-[40px] text-[var(--text-subtle)]">
            {providers.length === 0 ? "dns" : "search_off"}
          </span>
          <div className="font-medium">{providers.length === 0 ? "No providers yet" : "No providers match the filter"}</div>
          <div className="mt-1 text-sm text-[var(--text-muted)]">
            {providers.length === 0
              ? db ? "Add your first provider to start routing requests." : "Configure PROVIDERS_JSON or connect Supabase."
              : "Try a different filter."}
          </div>
          {db && providers.length === 0 && (
            <button onClick={openAdd} className="btn mt-4 text-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add provider
            </button>
          )}
        </div>
      )}

      {/* 9Router-style provider card grid */}
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const pStats = keyStats.filter((s) => s.provider === p.name);
          const activeKeys = p.apiKeys.length - (p.disabledKeys?.length ?? 0);
          const totalReq = pStats.reduce((a, s) => a + s.requests, 0);
          const health = providerHealth(p);
          return (
            <Link key={p.id} href={`/providers/${encodeURIComponent(p.id)}`} className="card card-hover group flex flex-col">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--bg-alt)]">
                    <span className="material-symbols-outlined text-[22px] text-[var(--brand)]">dns</span>
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold tracking-tight">{p.name}</div>
                    <div className="truncate font-mono text-[11px] text-[var(--text-subtle)]">{p.baseUrl}</div>
                  </div>
                </div>
                {db ? (
                  <span
                    role="switch"
                    aria-checked={p.enabled}
                    tabIndex={0}
                    onClick={(e) => { e.preventDefault(); toggleEnabled(p); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); toggleEnabled(p); } }}
                    className="toggle"
                    data-on={p.enabled}
                    title={p.enabled ? "Disable provider" : "Enable provider"}
                  />
                ) : (
                  <span className={p.enabled ? "dot-live mt-1" : "dot-idle mt-1"} />
                )}
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="pill font-mono">#{p.priority}</span>
                <span className="pill">
                  <span className="material-symbols-outlined text-[14px]">key</span>
                  {activeKeys}/{p.apiKeys.length} keys
                </span>
                <span className="pill">
                  <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                  {p.models.includes("*") ? "any model" : `${p.models.length} models`}
                </span>
                {health === "issues" && <span className="pill pill-amber">issues</span>}
                {!p.enabled && <span className="pill">disabled</span>}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
                <span className="font-mono">{fmt(totalReq)} requests</span>
                <span className="font-mono">{fmt(pStats.reduce((a, s) => a + s.totalTokens, 0))} tokens</span>
                <span className="flex items-center gap-1 font-medium text-[var(--brand)] opacity-0 transition-opacity group-hover:opacity-100">
                  Manage
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {showForm && (
        <div className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="card anim-modal max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-bold tracking-tight">{editing ? "Edit provider" : "Add provider"}</h2>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              {editing ? "Update the provider configuration." : "Connect a new OpenAI-compatible provider."}
            </p>
            {error && <div className="mb-3 rounded-[10px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] p-3 text-sm text-[#ef4444]">{error}</div>}
            <div className="space-y-4">
              <div>
                <div className="label">Name</div>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="OpenAI" />
              </div>
              <div>
                <div className="label">Base URL</div>
                <input className="input font-mono" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" spellCheck={false} />
              </div>
              <div>
                <div className="label">API keys <span className="normal-case text-[var(--text-subtle)]">— one per line, rotates round-robin</span></div>
                <textarea
                  className="input font-mono"
                  rows={3}
                  value={form.apiKeys}
                  onChange={(e) => setForm({ ...form, apiKeys: e.target.value })}
                  placeholder={"sk-aaa" + NL + "sk-bbb"}
                  spellCheck={false}
                />
              </div>
              <div>
                <div className="label">Models <span className="normal-case text-[var(--text-subtle)]">— comma separated, * = any</span></div>
                <input className="input font-mono" value={form.models} onChange={(e) => setForm({ ...form, models: e.target.value })} placeholder="gpt-4o-mini, gpt-4o" spellCheck={false} />
              </div>
              <div className="flex items-end gap-4">
                <div className="w-32">
                  <div className="label">Priority</div>
                  <input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 pb-2.5 text-sm">
                  <span
                    role="switch"
                    aria-checked={form.enabled}
                    tabIndex={0}
                    onClick={() => setForm({ ...form, enabled: !form.enabled })}
                    onKeyDown={(e) => e.key === "Enter" && setForm({ ...form, enabled: !form.enabled })}
                    className="toggle"
                    data-on={form.enabled}
                  />
                  Enabled
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="btn text-sm">
                {saving ? "Saving…" : editing ? "Save changes" : "Add provider"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Card title="How routing works" icon="route" className="anim-fade-up mt-6">
        <div className="grid gap-3 md:grid-cols-5">
          {[
            ["1", "Request arrives", "POST /api/v1/chat/completions with a model name."],
            ["2", "Match provider", "Enabled providers serving the model, by priority."],
            ["3", "Rotate keys", "Round-robin across the provider's enabled API keys."],
            ["4", "Auto failover", "Failing keys cool down; traffic shifts automatically."],
            ["5", "Track tokens", "Usage logged per key, streaming included."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-alt)] p-3">
              <div className="mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--brand-soft)] font-mono text-[11px] font-bold text-[var(--brand)]">{n}</div>
              <div className="text-xs font-semibold">{t}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">{d}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
