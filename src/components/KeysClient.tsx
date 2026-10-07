"use client";

import { useCallback, useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";

interface ApiKey {
  id: string;
  name: string;
  keyMasked: string;
  enabled: boolean;
  createdAt: string;
}

export default function KeysClient({ baseUrl }: { baseUrl: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [db, setDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/keys").then((r) => r.json());
      setKeys(data.keys ?? []);
      setDb(!!data.db);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setCreating(true);
    setError("");
    setNewKey(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "key" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setNewKey({ name: data.name, key: data.key });
      setName("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function toggle(k: ApiKey) {
    await fetch(`/api/keys/${encodeURIComponent(k.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !k.enabled }),
    });
    load();
  }

  async function remove(k: ApiKey) {
    if (!confirm(`Revoke API key "${k.name}" (${k.keyMasked})? Clients using it will stop working.`)) return;
    await fetch(`/api/keys/${encodeURIComponent(k.id)}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="anim-fade-up mb-8">
        <h1 className="section-title">API Keys</h1>
        <p className="section-sub">
          Keys clients send as <code className="inline">Authorization: Bearer &lt;key&gt;</code> to use{" "}
          <code className="inline">{baseUrl}/api/v1</code>.
          {db ? (
            <span className="pill pill-green ml-2">Supabase</span>
          ) : (
            <span className="pill pill-zinc ml-2">env fallback</span>
          )}
        </p>
      </div>

      {newKey && (
        <div className="card anim-fade-up mb-6 !border-emerald-500/30 !bg-emerald-500/[0.04]">
          <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-xs">✓</span>
            Key created — copy it now, it won't be shown again
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 break-all rounded-xl border border-emerald-500/20 bg-black/60 px-4 py-3 font-mono text-sm text-emerald-300">
              {newKey.key}
            </code>
            <CopyButton text={newKey.key} />
          </div>
        </div>
      )}

      {error && (
        <div className="card anim-fade-in mb-6 !border-red-500/25 text-sm text-red-300">{error}</div>
      )}

      {db && (
        <div className="card anim-fade-up mb-6">
          <div className="label">Create new API key</div>
          <div className="flex gap-2">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Label, e.g. "claude-code" or "phone"'
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <button onClick={create} disabled={creating} className="btn shrink-0 text-sm">
              {creating ? "Creating…" : "+ Create"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">Give each client its own key so you can revoke them individually.</p>
        </div>
      )}

      <div className="table-wrap anim-fade-up">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Key</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="mb-2 text-3xl">🔑</div>
                  <div className="text-zinc-400">No API keys yet</div>
                  <div className="mt-1 text-sm text-zinc-600">
                    {db ? "Create one above to let clients connect." : "Set ROUTER_API_KEY in env, or connect Supabase."}
                  </div>
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="font-medium text-zinc-200">{k.name}</td>
                <td className="font-mono text-xs text-zinc-500">{k.keyMasked}</td>
                <td>
                  {k.enabled ? (
                    <span className="pill pill-green">● active</span>
                  ) : (
                    <span className="pill pill-zinc">○ disabled</span>
                  )}
                </td>
                <td className="text-xs text-zinc-500">
                  {k.createdAt ? new Date(k.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </td>
                <td className="text-right">
                  {db && k.id !== "env" ? (
                    <div className="flex justify-end gap-3 text-xs">
                      <button onClick={() => toggle(k)} className="text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline">
                        {k.enabled ? "disable" : "enable"}
                      </button>
                      <button onClick={() => remove(k)} className="text-red-400/80 underline-offset-2 hover:text-red-300 hover:underline">
                        revoke
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-zinc-700">env-managed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card anim-fade-up mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="label !mb-0">Base URL</div>
          <CopyButton text={`${baseUrl}/api/v1`} label="Copy URL" />
        </div>
        <code className="block rounded-xl border border-white/[0.08] bg-black/60 px-4 py-3 font-mono text-sm text-emerald-300">
          {baseUrl}/api/v1
        </code>
        <div className="label mt-5">Quick test</div>
        <pre className="code">{`curl ${baseUrl}/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'`}</pre>
      </div>
    </div>
  );
}
