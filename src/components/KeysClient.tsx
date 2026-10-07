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

  if (loading) return <div className="text-sm text-zinc-500">Loading API keys…</div>;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">API Keys</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Keys clients send as <code className="inline">Authorization: Bearer &lt;key&gt;</code> to use{" "}
        <code className="inline">{baseUrl}/api/v1</code>.
        {db ? " Stored in Supabase." : " Database not configured — using ROUTER_API_KEY from env (read-only)."}
      </p>

      {newKey && (
        <div className="card mb-6 border-emerald-800">
          <div className="mb-2 font-semibold text-emerald-300">New key created — copy it now, it won't be shown again:</div>
          <div className="flex items-center gap-3">
            <code className="flex-1 break-all rounded bg-black px-3 py-2 font-mono text-sm text-emerald-300">
              {newKey.key}
            </code>
            <CopyButton text={newKey.key} />
          </div>
        </div>
      )}

      {error && (
        <div className="card mb-6 border-red-900 text-sm text-red-300">{error}</div>
      )}

      {db && (
        <div className="card mb-6">
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
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No API keys yet. {db ? "Create one above to let clients connect." : "Set ROUTER_API_KEY in env, or connect Supabase."}
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-4 py-2 font-medium">{k.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-400">{k.keyMasked}</td>
                <td className="px-4 py-2">
                  {k.enabled ? (
                    <span className="text-emerald-400">● active</span>
                  ) : (
                    <span className="text-zinc-500">○ disabled</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {db && k.id !== "env" && (
                    <>
                      <button onClick={() => toggle(k)} className="mr-2 text-xs text-zinc-400 underline">
                        {k.enabled ? "disable" : "enable"}
                      </button>
                      <button onClick={() => remove(k)} className="text-xs text-red-400 underline">
                        revoke
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mt-6">
        <div className="label">Base URL</div>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded bg-black px-3 py-2 font-mono text-sm text-emerald-300">
            {baseUrl}/api/v1
          </code>
          <CopyButton text={`${baseUrl}/api/v1`} />
        </div>
        <div className="label mt-4">Quick test (curl)</div>
        <pre className="code">{`curl ${baseUrl}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'`}</pre>
      </div>
    </div>
  );
}
