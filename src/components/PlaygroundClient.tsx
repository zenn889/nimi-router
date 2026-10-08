"use client";

import { useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const NL = String.fromCharCode(10);

export default function PlaygroundClient({ defaultModel }: { defaultModel: string }) {
  const [model, setModel] = useState(defaultModel);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollDown() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    scrollDown();

    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split(NL);
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              acc += delta;
              const snapshot = acc;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: snapshot };
                return copy;
              });
            }
          } catch {
            /* partial chunk — ignore */
          }
        }
        scrollDown();
      }
      if (!acc) {
        setMessages((prev) => prev.slice(0, -1));
        setError("Empty response — the provider may not support streaming.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setLoading(false);
      scrollDown();
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-4xl flex-col">
      <div className="anim-fade-up mb-5">
        <h1 className="section-title">Playground</h1>
        <p className="section-sub !mb-0">
          Test the router end-to-end — requests go through the same fallback engine as the API.
        </p>
      </div>

      <div className="anim-fade-up mb-4 flex gap-2" style={{ animationDelay: "0.05s" }}>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--text-subtle)]">model</span>
          <input
            className="input pl-[70px] font-mono"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            spellCheck={false}
          />
        </div>
        <button onClick={() => setMessages([])} className="btn-ghost shrink-0 text-sm">
          <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
          Clear
        </button>
      </div>

      <div className="card anim-fade-up mb-4 flex-1 overflow-y-auto" style={{ animationDelay: "0.1s" }}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-soft)]">
              <span className="material-symbols-outlined text-[28px] text-[var(--brand)]">chat</span>
            </div>
            <div className="font-medium">Start a conversation</div>
            <div className="mt-1 max-w-xs text-sm text-[var(--text-muted)]">
              Ask anything to test your provider chain, fallback, and token tracking.
            </div>
          </div>
        )}
        <div className="space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={`anim-fade-up flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  m.role === "user"
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--brand)]"
                }`}
              >
                {m.role === "user" ? "You" : "n"}
              </div>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-tr-md bg-[var(--brand)] text-white"
                    : "rounded-tl-md border border-[var(--border-subtle)] bg-[var(--surface-2)]"
                }`}
              >
                {m.content || (
                  <span className="flex gap-1.5 py-1">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-subtle)]" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-subtle)]" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-subtle)]" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {error && (
          <div className="anim-fade-in mt-4 rounded-[10px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] p-3.5 text-sm text-[#ef4444]">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="anim-fade-up flex gap-2" style={{ animationDelay: "0.15s" }}>
        <input
          className="input !rounded-2xl !py-3.5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message… (Enter to send)"
        />
        <button onClick={send} disabled={loading || !input.trim()} className="btn shrink-0 !rounded-2xl !px-6">
          {loading ? (
            <span className="flex gap-1.5">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          ) : (
            <span className="material-symbols-outlined text-[20px]">send</span>
          )}
        </button>
      </div>
    </div>
  );
}
