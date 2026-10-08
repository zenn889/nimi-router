"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import CopyButton from "@/components/CopyButton";

interface ApiKey {
  id: string;
  name: string;
  keyMasked: string;
  enabled: boolean;
  createdAt: string;
}

/** 9Router-style home: API endpoint card + API key management. */
export default function EndpointClient({ baseUrl }: { baseUrl: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [db, setDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
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

  return (
    <div className="stagger flex flex-col gap-6">
      {/* Endpoint card */}
      <Card title="API Endpoint" icon="api" subtitle="OpenAI-compatible base URL for all your clients">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="pill pill-brand shrink-0">Local</span>
            <input value={`${baseUrl}/api/v1`} readOnly className="input flex-1 font-mono !text-[13px]" />
            <CopyButton text={`${baseUrl}/api/v1`} />
          </div>
          <div className="flex items-center gap-2">
            <span className="pill shrink-0">Models</span>
            <input value={`${baseUrl}/api/v1/models`} readOnly className="input flex-1 font-mono !text-[13px]" />
            <CopyButton text={`${baseUrl}/api/v1/models`} />
          </div>
        </div>
        <div className="label mt-6">Quick test</div>
        <pre className="code">{`curl ${baseUrl}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'`}</pre>
      </Card>

      {/* API keys card */}
      <Card
        title="API Keys"
        icon="key"
        subtitle="Keys clients send as Authorization: Bearer <key>"
        action={
          db ? (
            <span className="pill pill-green">Supabase</span>
          ) : (
            <span className="pill">env fallback</span>
          )
        }
      >
        {newKey && (
          <div className="anim-fade-in mb-4 rounded-[10px] border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.07)] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#22c55e]">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Key created — copy it now, it won't be shown again
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-[10px] border border-[rgba(34,197,94,0.25)] bg-[var(--bg-alt)] px-3 py-2 font-mono text-[13px] text-[#22c55e]">
                {newKey.key}
              </code>
              <CopyButton text={newKey.key} />
            </div>
          </div>
        )}

        {error && (
          <div className="anim-fade-in mb-4 rounded-[10px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] p-3 text-sm text-[#ef4444]">
            {error}
          </div>
        )}

        {db && (
          <div className="mb-4">
            <div className="label">Create new API key</div>
            <div className="flex gap-2">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Label, e.g. "claude-code" or "phone"'
                onKeyDown={(e) => e.key === "Enter" && create()}
              />
              <button onClick={create} disabled={creating} className="btn shrink-0">
                <span className="material-symbols-outlined text-[18px]">add</span>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-32 animate-pulse rounded-[10px] bg-[var(--surface-2)]" />
        ) : (
          <div className="table-wrap">
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
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <span className="material-symbols-outlined mb-1 block text-[32px] text-[var(--text-subtle)]">key_off</span>
                      <div className="text-[var(--text-muted)]">No API keys yet</div>
                      <div className="mt-1 text-xs text-[var(--text-subtle)]">
                        {db ? "Create one above to let clients connect." : "Set ROUTER_API_KEY in env, or connect Supabase."}
                      </div>
                    </td>
                  </tr>
                )}
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="font-medium">{k.name}</td>
                    <td className="font-mono text-xs text-[var(--text-muted)]">{k.keyMasked}</td>
                    <td>
                      {k.enabled ? (
                        <span className="pill pill-green">active</span>
                      ) : (
                        <span className="pill">disabled</span>
                      )}
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {k.createdAt
                        ? new Date(k.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="text-right">
                      {db && k.id !== "env" ? (
                        <div className="flex justify-end gap-3 text-xs">
                          <button
                            onClick={() => toggle(k)}
                            className="text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text)] hover:underline"
                          >
                            {k.enabled ? "disable" : "enable"}
                          </button>
                          <button
                            onClick={() => remove(k)}
                            className="text-[#ef4444]/80 underline-offset-2 hover:text-[#ef4444] hover:underline"
                          >
                            revoke
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--text-subtle)]">env-managed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
