"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.07] blur-[120px]" />

      <form onSubmit={submit} className="card anim-fade-up relative w-full max-w-sm !p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-emerald-600 text-2xl font-black text-black shadow-[0_0_40px_rgba(52,211,153,0.4)]">
            n
          </span>
          <span className="text-xl font-bold tracking-tight">
            nimi<span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">-router</span>
          </span>
          <span className="mt-1 text-xs text-zinc-500">Enter your dashboard password to continue</span>
        </div>

        <div className="label">Password</div>
        <input
          type="password"
          className="input mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoFocus
        />
        {error && (
          <div className="anim-fade-in mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-center text-sm text-red-300">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading || !password} className="btn w-full !py-3">
          {loading ? (
            <span className="flex gap-1.5">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-black" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-black" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-black" />
            </span>
          ) : (
            "Unlock dashboard"
          )}
        </button>
      </form>
    </div>
  );
}
