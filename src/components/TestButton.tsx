"use client";

import { useState } from "react";

interface KeyResult {
  key: string;
  ok: boolean;
  latencyMs: number;
  models?: number;
  error?: string;
}

export default function TestButton({ index }: { index: number }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [results, setResults] = useState<KeyResult[]>([]);

  async function test() {
    setState("loading");
    setResults([]);
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setState("done");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={test} disabled={state === "loading"} className="btn-ghost !px-3 !py-1.5 !text-xs">
        <span className="material-symbols-outlined text-[16px]">network_check</span>
        {state === "loading" ? "Testing…" : "Test keys"}
      </button>
      {state === "done" &&
        results.map((r) => (
          <span key={r.key} className="font-mono text-xs">
            {r.ok ? (
              <span className="text-[#22c55e]">
                ✓ {r.key} · {r.latencyMs}ms{r.models != null ? ` · ${r.models} models` : ""}
              </span>
            ) : (
              <span className="text-[#ef4444]">
                ✗ {r.key} · {r.error}
              </span>
            )}
          </span>
        ))}
    </div>
  );
}
