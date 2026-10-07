"use client";

import { useCallback, useEffect, useState } from "react";
import TestButton from "@/components/TestButton";
import CopyButton from "@/components/CopyButton";

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
    setLoading(true);
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
      apiKeys: p.apiKeys.join("\n"),
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
      apiKeys: form.apiKeys.split("\n").map((s) => s.trim()).filter(Boolean),
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

  if (loading) return <div className="text-sm text-zinc-500">Loading providers…</div>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Providers</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {db
              ? "Stored in Supabase — changes apply immediately, no redeploy needed."
              : "Database not configured — showing read-only providers from PROVIDERS_JSON. Set SUPABASE_URL + SUPABASE_SERVICE_KEY to manage from here."}
          </p>
        </div>
        <div className="flex gap-2">
          {db && (
            <button onClick={importEnv} className="btn-ghost text-sm">
              Import from ENV
            </button>
          )}
          {db && (
            <button onClick={openAdd} className="btn text-sm">
              + Add provider
            </button>
          )}
        </div>
      </div>

      {providers.length === 0 && (
        <div className="card text-sm text-zinc-400">
          No providers yet. {db ? "Click “Add provider” to add your first one." : "See Docs for configuration."}
        </div>
      )}

      <div className="grid gap-4">
        {providers.map((p, i) => (
          <div key={p.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${p.enabled ? "bg-emerald-400" : "bg-zinc-600"}`} />
                <div>
                  <div className="font-semibold">
                    {p.name}{" "}
                    <span className="ml-1 rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                      priority {p.priority}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-zinc-500">{p.baseUrl}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TestButton index={i} />
                {db && (
                  <>
                    <button onClick={() => toggle(p)} className="btn-ghost px-3 py-1 text-xs">
                      {p.enabled ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => openEdit(p)} className="btn-ghost px-3 py-1 text-xs">
                      Edit
                    </button>
                    <button onClick={() => remove(p)} className="btn-ghost px-3 py-1 text-xs text-red-400">
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="label mt-4">API keys ({p.apiKeys.length})</div>
            <div className="space-y-1">
              {p.apiKeysMasked.map((masked, ki) => {
                const ks = keyStats.find((s) => s.provider === p.name && s.keyMasked === masked);
                const revealed = showKeys[p.id];
                return (
                  <div key={ki} className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                    <span className={ks?.cooling ? "text-amber-300" : "text-zinc-400"}>
                      {ks?.cooling ? "⏳" : "●"} {revealed ? p.apiKeys[ki] : masked}
                      {ks?.cooling && <span className="ml-1">cooldown {Math.ceil((ks.cooldownMs ?? 0) / 1000)}s</span>}
                    </span>
                    <span className="flex items-center gap-2 text-zinc-500">
                      {ks ? `${ks.requests} req · ${fmt(ks.totalTokens)} tok · ${fmt(ks.promptTokens)}/${fmt(ks.completionTokens)} in/out` : "no traffic yet"}
                      {revealed ? (
                        <button onClick={() => setShowKeys((s) => ({ ...s, [p.id]: false }))} className="text-zinc-500 underline">
                          hide
                        </button>
                      ) : (
                        <button onClick={() => setShowKeys((s) => ({ ...s, [p.id]: true }))} className="text-zinc-500 underline">
                          reveal
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3">
              <div className="label">Models ({p.models.length})</div>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {p.models.map((m) => (
                  <span key={m} className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <h2 className="mb-4 text-lg font-bold">{editing ? "Edit provider" : "Add provider"}</h2>
            {error && <div className="mb-3 rounded-lg border border-red-900 bg-red-950/40 p-2 text-sm text-red-300">{error}</div>}
            <div className="space-y-3">
              <div>
                <div className="label">Name</div>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="OpenAI" />
              </div>
              <div>
                <div className="label">Base URL</div>
                <input className="input" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" spellCheck={false} />
              </div>
              <div>
                <div className="label">API keys (one per line)</div>
                <textarea className="input font-mono" rows={3} value={form.apiKeys} onChange={(e) => setForm({ ...form, apiKeys: e.target.value })} placeholder={"sk-aaa\nsk-bbb"} spellCheck={false} />
              </div>
              <div>
                <div className="label">Models (comma separated, * = any)</div>
                <input className="input font-mono" value={form.models} onChange={(e) => setForm({ ...form, models: e.target.value })} placeholder="gpt-4o-mini, gpt-4o  or  *" spellCheck={false} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="label">Priority (lower = first)</div>
                  <input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
                    Enabled
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="btn text-sm">
                {saving ? "Saving…" : editing ? "Save changes" : "Add provider"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card mt-6 text-sm text-zinc-400">
        <div className="mb-2 font-semibold text-zinc-200">How routing works</div>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Request arrives at <code className="inline">POST /api/v1/chat/completions</code> with a model name.</li>
          <li>Router finds enabled providers serving that model, ordered by priority.</li>
          <li>Inside a provider, keys are tried <b>round-robin</b> — spreading quota usage across accounts.</li>
          <li>On 429 the key cools down 60s; on 401/403 for 5 min; on 5xx/network 30s.</li>
          <li>Token usage is captured per key, including streaming responses.</li>
        </ol>
      </div>
    </div>
  );
}
