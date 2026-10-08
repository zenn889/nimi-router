"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Wrong password. Try again.");
      }
    } catch {
      setError("Login failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-soft)] blur-[120px]" />

      <Card className="anim-fade-up relative w-full max-w-sm !p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-2xl font-black text-white shadow-[0_2px_20px_-2px_rgba(229,106,74,0.5)]">
            n
          </span>
          <span className="text-xl font-bold tracking-tight">
            nimi<span className="text-[var(--brand)]">-router</span>
          </span>
          <span className="mt-1 text-xs text-[var(--text-muted)]">Enter your password to access the dashboard</span>
        </div>

        <form onSubmit={submit}>
          <div className="label">Dashboard password</div>
          <input
            type="password"
            className="input mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
          />
          {error && (
            <div className="anim-fade-in mb-4 rounded-[10px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] p-3 text-center text-sm text-[#ef4444]">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading || !password} className="btn w-full !py-3">
            {loading ? (
              <span className="flex gap-1.5">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
                Unlock dashboard
              </>
            )}
          </button>
        </form>
      </Card>
    </div>
  );
}
