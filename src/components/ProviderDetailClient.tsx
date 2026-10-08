"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/Card";
import CooldownTimer from "@/components/CooldownTimer";

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

export default function ProviderDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [keyStats, setKeyStats] = useState<KeyStat[]>([]);
  const [db, setDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[] | null>(null);
  const [checkingModels, setCheckingModels] = useState(false);
  // edit modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", baseUrl: "", apiKeys: "", models: "", priority: "0", enabled: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectedCount, setDetectedCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [pr, sr] = await Promise.all([
        fetch("/api/providers").then((r) => r.json()),
        fetch("/api/stats").then((r) => r.json()).catch(() => null),
      ]);
      const list: Provider[] = pr.providers ?? [];
      const found = list.find((p) => p.id === decodeURIComponent(id));
      if (!found) {
        setNotFound(true);
      } else {
        setProvider(found);
        setDb(!!pr.db);
      }
      setKeyStats(sr?.keys ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function toggleProvider() {
    if (!provider || !db) return;
    await fetch(`/api/providers/${encodeURIComponent(provider.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !provider.enabled }),
    });
    load();
  }

  async function toggleKey(masked: string, disabled: boolean) {
    if (!provider || !db) return;
    const set = new Set(provider.disabledKeys ?? []);
    if (disabled) set.add(masked);
    else set.delete(masked);
    await fetch(`/api/providers/${encodeURIComponent(provider.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabledKeys: [...set] }),
    });
    load();
  }

  async function remove() {
    if (!provider || !db) return;
    if (!confirm(`Delete provider "${provider.name}"?`)) return;
    await fetch(`/api/providers/${encodeURIComponent(provider.id)}`, { method: "DELETE" });
    router.push("/providers");
  }

  function openEdit() {
    if (!provider) return;
    setForm({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKeys: provider.apiKeys.join(NL),
      models: provider.models.join(", "),
      priority: String(provider.priority),
      enabled: provider.enabled,
    });
    setError("");
    setDetectedCount(null);
    setShowForm(true);
  }

  async function detectModels() {
    const firstKey = form.apiKeys.split(NL).map((s) => s.trim()).filter(Boolean)[0];
    if (!form.baseUrl.trim() || !firstKey) {
      setError("Enter the Base URL and at least one API key first.");
      return;
    }
    setDetecting(true);
    setError("");
    setDetectedCount(null);
    try {
      const res = await fetch("/api/providers/detect-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: form.baseUrl.trim(), apiKey: firstKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Detection failed");
      const models: string[] = data.models ?? [];
      setDetectedCount(models.length);
      if (models.length > 0) {
        setForm((f) => ({ ...f, models: models.join(", ") }));
      } else {
        setError("No models reported by the endpoint — keeping current list.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function save() {
    if (!provider) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/providers/${encodeURIComponent(provider.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim(),
          apiKeys: form.apiKeys.split(NL).map((s) => s.trim()).filter(Boolean),
          models: form.models,
          priority: Number(form.priority || 0),
          enabled: form.enabled,
        }),
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

  async function checkModels() {
    if (!provider) return;
    // find index in the providers list for the test API
    const list = await fetch("/api/providers").then((r) => r.json()).catch(() => null);
    const idx = (list?.providers ?? []).findIndex((p: Provider) => p.id === provider.id);
    if (idx < 0) return;
    setCheckingModels(true);
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: idx }),
      });
      const data = await res.json();
      setAvailableModels(data.availableModels ?? []);
    } finally {
      setCheckingModels(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  if (notFound || !provider) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link href="/providers" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Providers
        </Link>
        <div className="card py-12 text-center">
          <span className="material-symbols-outlined mb-2 block text-[40px] text-[var(--text-subtle)]">search_off</span>
          Provider not found.
        </div>
      </div>
    );
  }

  const p = provider;
  const pStats = keyStats.filter((s) => s.provider === p.name);
  const totalReq = pStats.reduce((a, s) => a + s.requests, 0);
  const totalTok = pStats.reduce((a, s) => a + s.totalTokens, 0);
  const disabledSet = new Set(p.disabledKeys ?? []);
  const activeCount = p.apiKeys.length - disabledSet.size;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/providers" className="anim-fade-up mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Providers
      </Link>

      <div className="stagger flex flex-col gap-6">
        {/* Info card */}
        <Card
          title={p.name}
          subtitle={p.baseUrl}
          icon="dns"
          action={
            <div className="flex items-center gap-2">
              <span className={p.enabled ? "dot-live" : "dot-idle"} />
              <span className="pill font-mono">#{p.priority}</span>
            </div>
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Keys", `${activeCount}/${p.apiKeys.length} active`],
              ["Models", p.models.includes("*") ? "any (passthrough)" : String(p.models.length)],
              ["Requests", fmt(totalReq)],
              ["Tokens", fmt(totalTok)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[10px] bg-[var(--bg-alt)] px-3 py-2.5 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{k}</div>
                <div className="mt-0.5 truncate text-sm font-bold" title={v}>{v}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={checkModels} disabled={checkingModels} className="btn-ghost !px-3 !py-1.5 !text-xs">
              <span className={`material-symbols-outlined text-[16px] ${checkingModels ? "animate-spin" : ""}`}>
                {checkingModels ? "progress_activity" : "network_check"}
              </span>
              {checkingModels ? "Testing…" : "Test keys"}
            </button>
            {db && (
              <>
                <button onClick={toggleProvider} className="btn-ghost !px-3 !py-1.5 !text-xs">
                  {p.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={openEdit} className="btn-ghost !px-3 !py-1.5 !text-xs">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit
                </button>
                <button onClick={remove} className="btn-danger !px-3 !py-1.5 !text-xs">
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Keys (= connections) card */}
        <Card
          title="API Keys"
          icon="key"
          subtitle={`${activeCount} of ${p.apiKeys.length} enabled — requests rotate round-robin across enabled keys`}
        >
          <div className="space-y-2">
            {p.apiKeysMasked.map((masked, ki) => {
              const ks = pStats.find((s) => s.keyMasked === masked);
              const isDisabled = disabledSet.has(masked);
              const revealed = showKeys;
              return (
                <div
                  key={ki}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-[10px] border px-3.5 py-3 transition-opacity ${
                    isDisabled ? "border-[var(--border-subtle)] opacity-55" : "border-[var(--border-subtle)] bg-[var(--bg-alt)]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5 font-mono text-xs">
                    <span className={ks?.cooling ? "dot-cool" : isDisabled ? "dot-idle" : ks ? "dot-live" : "dot-idle"} />
                    <span className="truncate">{revealed ? p.apiKeys[ki] : masked}</span>
                    {ks?.cooling && !isDisabled && <CooldownTimer msLeft={ks.cooldownMs ?? 0} />}
                    {isDisabled && <span className="pill">disabled</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
                      {ks ? (
                        <>
                          <span><span className="text-[var(--text)]">{ks.requests}</span> req</span>
                          <span><span className="text-[#22c55e]">{fmt(ks.promptTokens)}</span> in</span>
                          <span><span className="text-[#f59e0b]">{fmt(ks.completionTokens)}</span> out</span>
                          <span>{ks.avgLatencyMs}ms</span>
                        </>
                      ) : (
                        <span className="text-[var(--text-subtle)]">no traffic yet</span>
                      )}
                    </div>
                    {db && (
                      <span
                        role="switch"
                        aria-checked={!isDisabled}
                        tabIndex={0}
                        onClick={() => toggleKey(masked, !isDisabled)}
                        onKeyDown={(e) => e.key === "Enter" && toggleKey(masked, !isDisabled)}
                        className="toggle"
                        data-on={!isDisabled}
                        title={isDisabled ? "Enable this key" : "Disable this key"}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setShowKeys((v) => !v)}
            className="mt-3 text-xs text-[var(--text-subtle)] underline-offset-2 hover:text-[var(--text-muted)] hover:underline"
          >
            {showKeys ? "hide full keys" : "reveal full keys"}
          </button>
          {!db && (
            <p className="mt-2 text-[11px] text-[var(--text-subtle)]">
              Per-key enable/disable needs Supabase — env-managed providers are read-only here.
            </p>
          )}
        </Card>

        {/* Models card */}
        <Card
          title="Models"
          icon="smart_toy"
          subtitle={p.models.includes("*") ? "Passthrough — any model name is accepted" : `${p.models.length} configured`}
          action={
            <button onClick={checkModels} disabled={checkingModels} className="btn-ghost !px-3 !py-1.5 !text-xs">
              <span className={`material-symbols-outlined text-[16px] ${checkingModels ? "animate-spin" : ""}`}>
                {checkingModels ? "progress_activity" : "fact_check"}
              </span>
              {checkingModels ? "Checking…" : "Check availability"}
            </button>
          }
        >
          {p.models.includes("*") ? (
            <div className="text-sm text-[var(--text-muted)]">
              This provider accepts any model name and forwards it upstream.{" "}
              {availableModels && availableModels.length > 0 && (
                <>Upstream currently reports <b className="text-[var(--text)]">{availableModels.length}</b> models.</>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {p.models.map((m) => {
                const available = availableModels ? availableModels.includes(m) : null;
                return (
                  <span
                    key={m}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
                      available === true
                        ? "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.07)] text-[#22c55e]"
                        : available === false
                          ? "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] text-[#ef4444]"
                          : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                    }`}
                    title={available === true ? "Available upstream" : available === false ? "Not found upstream" : "Availability not checked"}
                  >
                    {available !== null && (
                      <span className="material-symbols-outlined text-[14px]">
                        {available ? "check_circle" : "cancel"}
                      </span>
                    )}
                    {m}
                  </span>
                );
              })}
            </div>
          )}
          {availableModels && p.models.includes("*") && availableModels.length > 0 && (
            <div className="mt-3 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {availableModels.slice(0, 60).map((m) => (
                <span key={m} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-subtle)]">
                  {m}
                </span>
              ))}
              {availableModels.length > 60 && (
                <span className="px-1 font-mono text-[10px] text-[var(--text-subtle)]">+{availableModels.length - 60} more</span>
              )}
            </div>
          )}
        </Card>
      </div>

      {showForm && (
        <div className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="card anim-modal max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-bold tracking-tight">Edit provider</h2>
            <p className="mb-4 text-xs text-[var(--text-muted)]">Update the provider configuration.</p>
            {error && <div className="mb-3 rounded-[10px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] p-3 text-sm text-[#ef4444]">{error}</div>}
            <div className="space-y-4">
              <div>
                <div className="label">Name</div>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <div className="label">Base URL</div>
                <input className="input font-mono" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} spellCheck={false} />
              </div>
              <div>
                <div className="label">API keys <span className="normal-case text-[var(--text-subtle)]">— one per line</span></div>
                <textarea className="input font-mono" rows={3} value={form.apiKeys} onChange={(e) => setForm({ ...form, apiKeys: e.target.value })} spellCheck={false} />
              </div>
              <div>
                <div className="label flex items-center justify-between">
                  <span>Models <span className="normal-case text-[var(--text-subtle)]">— comma separated, * = any</span></span>
                  <button
                    type="button"
                    onClick={detectModels}
                    disabled={detecting}
                    className="flex items-center gap-1 text-[11px] font-semibold normal-case tracking-normal text-[var(--brand)] hover:underline disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[14px] ${detecting ? "animate-spin" : ""}`}>
                      {detecting ? "progress_activity" : "radar"}
                    </span>
                    {detecting ? "Detecting…" : detectedCount !== null ? `Detected ${detectedCount} — detect again` : "Detect from API key"}
                  </button>
                </div>
                <input className="input font-mono" value={form.models} onChange={(e) => setForm({ ...form, models: e.target.value })} spellCheck={false} />
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
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
