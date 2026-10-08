"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import TestButton from "@/components/TestButton";

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeys: string[];
  apiKeysMasked: string[];
  models: string[];
  priority: number;
  enabled: boolean;
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

export default function ProvidersClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [keyStats, setKeyStats] = useState<KeyStat[]>([]);
  const [db, setDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

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

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(p: Provider) {
    setEditing(p);
    setForm({
      name: p.name,
      baseUrl: p.baseUrl,
      apiKeys: p.apiKeys.join(NL),
      models: p.models.join(", "),
      priority: String(p.priority),
      enabled: p.enabled,
    });
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

  async function remove(p: Provider) {
    if (!confirm(`Delete provider "${p.name}"?`)) return;
    await fetch(`/api/providers/${encodeURIComponent(p.id)}`, { method: "DELETE" });
    load();
  }

  async function toggle(p: Provider) {
    await fetch(`/api/providers/${encodeURIComponent(p.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    load();
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
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="card h-48 animate-pulse" />
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
        <div className="flex gap-2">
          {db && (
            <button onClick={importEnv} className="btn-ghost text-sm">
              <span className="material-symbols-outlined text-[18px]">upload</span>
              Import from ENV
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

      {providers.length === 0 && (
        <div className="card anim-fade-up border-dashed py-12 text-center">
          <span className="material-symbols-outlined mb-2 block text-[40px] text-[var(--text-subtle)]">dns</span>
          <div className="font-medium">No providers yet</div>
          <div className="mt-1 text-sm text-[var(--text-muted)]">
            {db ? "Add your first provider to start routing requests." : "Configure PROVIDERS_JSON or connect Supabase."}
          </div>
          {db && (
            <button onClick={openAdd} className="btn mt-4 text-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add provider
            </button>
          )}
        </div>
      )}

      <div className="stagger grid gap-4">
        {providers.map((p, i) => {
          const pStats = keyStats.filter((s) => s.provider === p.name);
          const totalReq = pStats.reduce((a, s) => a + s.requests, 0);
          return (
            <Card
              key={p.id}
              className="card-hover"
              title={p.name}
              subtitle={p.baseUrl}
              icon="dns"
              action={
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 ${p.enabled ? "" : "opacity-60"}`}>
                    <span className={p.enabled ? "dot-live" : "dot-idle"} />
                  </span>
                  <span className="pill font-mono">#{p.priority}</span>
                  {!p.enabled && <span className="pill">disabled</span>}
                </div>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <TestButton index={i} />
                {db && (
                  <>
                    <button onClick={() => toggle(p)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                      {p.enabled ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => openEdit(p)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Edit
                    </button>
                    <button onClick={() => remove(p)} className="btn-danger !px-3 !py-1.5 !text-xs">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Delete
                    </button>
                  </>
                )}
              </div>

              <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                <div className="label">
                  API keys ({p.apiKeys.length}){" "}
                  {totalReq > 0 && <span className="normal-case text-[var(--text-subtle)]">· {totalReq} requests total</span>}
                </div>
                <div className="space-y-2">
                  {p.apiKeysMasked.map((masked, ki) => {
                    const ks = keyStats.find((s) => s.keyMasked === masked);
                    const revealed = showKeys[p.id];
                    return (
                      <div
                        key={ki}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-alt)] px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 font-mono text-xs">
                          <span className={ks?.cooling ? "dot-cool" : ks ? "dot-live" : "dot-idle"} />
                          <span>{revealed ? p.apiKeys[ki] : masked}</span>
                          {ks?.cooling && <span className="pill pill-amber">cooldown {Math.ceil((ks.cooldownMs ?? 0) / 1000)}s</span>}
                          <button
                            onClick={() => setShowKeys((s) => ({ ...s, [p.id]: !revealed }))}
                            className="font-sans text-[11px] text-[var(--text-subtle)] underline-offset-2 hover:text-[var(--text-muted)] hover:underline"
                          >
                            {revealed ? "hide" : "reveal"}
                          </button>
                        </div>
                        <div className="flex items-center gap-4 font-mono text-[11px] text-[var(--text-muted)]">
                          {ks ? (
                            <>
                              <span><span className="text-[var(--text)]">{ks.requests}</span> req</span>
                              <span><span className="text-[#22c55e]">{fmt(ks.promptTokens)}</span> in</span>
                              <span><span className="text-[#f59e0b]">{fmt(ks.completionTokens)}</span> out</span>
                              <span>{ks.avgLatencyMs}ms</span>
                              {ks.lastError && <span className="max-w-[200px] truncate text-[#ef4444]/80" title={ks.lastError}>{ks.lastError}</span>}
                            </>
                          ) : (
                            <span className="text-[var(--text-subtle)]">no traffic yet</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.models.map((m) => (
                  <span key={m} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--text-muted)]">
                    {m}
                  </span>
                ))}
              </div>
            </Card>
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
            ["3", "Rotate keys", "Round-robin across the provider's API keys."],
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
