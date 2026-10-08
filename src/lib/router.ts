// Core routing engine: OpenAI-compatible proxy with smart fallback.
// Provider chain (priority) -> key rotation (round-robin) with auto-cooldown.
// Token usage is captured for both streaming and non-streaming responses.
// Request logs go to in-memory stats AND to Supabase (when configured).

import { maskSecret } from "./config";
import { listProviders, persistLog, type ProviderRecord, type LogEntry } from "./store";
import { orderedKeys, cooldownKey } from "./keypool";
import { recordRequest, addTokens, type TokenUsage } from "./stats";

/** Keys eligible for routing: enabled (not per-key disabled) ones. */
export function activeKeys(p: ProviderRecord): string[] {
  const disabled = new Set(p.disabledKeys ?? []);
  if (disabled.size === 0) return p.apiKeys;
  return p.apiKeys.filter((k) => !disabled.has(maskSecret(k)));
}

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function isRetryable(status: number): boolean {
  if (RETRYABLE.has(status)) return true;
  // Another key/provider may have a working credential or correct endpoint.
  if (status === 401 || status === 403 || status === 404) return true;
  return false;
}

function errJson(message: string, status: number) {
  return Response.json({ error: { message, type: "router_error" } }, { status });
}

function toUsage(u: unknown): TokenUsage | null {
  if (!u || typeof u !== "object") return null;
  const o = u as Record<string, unknown>;
  const total = Number(o.total_tokens ?? 0);
  if (!total) return null;
  return {
    prompt_tokens: Number(o.prompt_tokens ?? 0),
    completion_tokens: Number(o.completion_tokens ?? 0),
    total_tokens: total,
  };
}

/** Extract `usage` from a buffered (non-streaming) JSON response. */
async function extractUsage(res: Response): Promise<TokenUsage | null> {
  try {
    const data = await res.clone().json();
    return toUsage(data?.usage);
  } catch {
    return null;
  }
}

/**
 * Wrap an SSE stream so token usage is captured as it flows through,
 * and `onDone` fires when the stream closes (for final DB logging).
 */
function wrapStreamForUsage(
  body: ReadableStream<Uint8Array>,
  onUsage: (u: TokenUsage) => void,
  onDone: () => void
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buf = "";
  let reported = false;
  let done = false;

  function finish() {
    if (!done) {
      done = true;
      try {
        onDone();
      } catch {
        /* never break the stream */
      }
    }
  }

  function scan(text: string) {
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]" || reported) continue;
      try {
        const u = toUsage(JSON.parse(payload)?.usage);
        if (u) {
          reported = true;
          onUsage(u);
        }
      } catch {
        /* partial chunk — ignore */
      }
    }
  }

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        const text = decoder.decode(chunk, { stream: true });
        const lines = (buf + text).split("\n");
        buf = lines.pop() ?? "";
        scan(lines.join("\n"));
      },
      flush() {
        if (buf.trim()) scan(buf);
        buf = "";
        finish();
      },
    })
  );
}

interface AttemptCtx {
  time: string;
  model: string;
  provider: string;
  key: string;
  keyMasked: string;
}

/** Log to both in-memory stats and Supabase (when configured). */
async function logAttempt(
  ctx: AttemptCtx,
  success: boolean,
  latencyMs: number,
  usage: TokenUsage | null,
  error?: string
): Promise<void> {
  const entry: LogEntry = {
    time: ctx.time,
    model: ctx.model,
    provider: ctx.provider,
    keyMasked: ctx.keyMasked,
    success,
    latencyMs,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    error,
  };
  recordRequest({ ...entry, key: ctx.key });
  await persistLog(entry);
}

/**
 * Proxy an OpenAI chat-completions body through the provider/key chain.
 * Returns the upstream Response directly (streaming SSE passes through).
 */
export async function proxyChatCompletion(body: Record<string, unknown>): Promise<Response> {
  const model = String(body.model || "");
  if (!model) return errJson("Missing 'model' in request body.", 400);

  const all = await listProviders().catch(() => [] as ProviderRecord[]);
  const chain = all.filter(
    (p) => p.enabled && activeKeys(p).length > 0 && (p.models.includes("*") || p.models.includes(model))
  );
  if (chain.length === 0) {
    return errJson(
      `No enabled provider configured for model "${model}". Add one in the dashboard or via PROVIDERS_JSON.`,
      404
    );
  }

  // Ask OpenAI-style providers to include usage in the final SSE chunk.
  const wantsStream = body.stream === true;
  const reqBody: Record<string, unknown> = { ...body };
  if (wantsStream && !reqBody.stream_options) {
    reqBody.stream_options = { include_usage: true };
  }
  const payload = JSON.stringify(reqBody);

  const failures: string[] = [];

  for (const p of chain) {
    for (const key of orderedKeys(p.name, activeKeys(p))) {
      const started = Date.now();
      const ctx: AttemptCtx = {
        time: new Date().toISOString(),
        model,
        provider: p.name,
        key,
        keyMasked: maskSecret(key),
      };

      let upstream: Response;
      try {
        upstream = await fetch(`${p.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: payload,
        });
      } catch (e) {
        const latencyMs = Date.now() - started;
        const msg = e instanceof Error ? e.message : String(e);
        failures.push(`${p.name}/${ctx.keyMasked}: ${msg.slice(0, 100)}`);
        await logAttempt(ctx, false, latencyMs, null, "network error");
        continue; // next key
      }

      const latencyMs = Date.now() - started;

      if (!isRetryable(upstream.status)) {
        // Definitive answer — pass through, capturing usage.
        if (wantsStream && upstream.ok && upstream.body) {
          // In-memory log now (live view); DB log once when the stream closes.
          recordRequest({
            time: ctx.time, model, provider: p.name, key, keyMasked: ctx.keyMasked,
            success: true, latencyMs, promptTokens: 0, completionTokens: 0, totalTokens: 0,
          });
          let usage: TokenUsage | null = null;
          const wrapped = wrapStreamForUsage(
            upstream.body,
            (u) => {
              usage = u;
              addTokens(p.name, key, u);
            },
            () => {
              // Single DB log with final token counts.
              persistLog({
                time: ctx.time,
                model,
                provider: p.name,
                keyMasked: ctx.keyMasked,
                success: true,
                latencyMs,
                promptTokens: usage?.prompt_tokens ?? 0,
                completionTokens: usage?.completion_tokens ?? 0,
                totalTokens: usage?.total_tokens ?? 0,
              });
            }
          );
          return new Response(wrapped, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: upstream.headers,
          });
        }
        const usage = upstream.ok ? await extractUsage(upstream) : null;
        await logAttempt(ctx, upstream.ok, latencyMs, usage, upstream.ok ? undefined : `upstream ${upstream.status}`);
        return upstream;
      }

      // Retryable failure — cool this key down, try the next key/provider.
      const text = await upstream.text().catch(() => "");
      const errMsg = `HTTP ${upstream.status}`;
      failures.push(`${p.name}/${ctx.keyMasked}: ${errMsg}${text ? ` — ${text.slice(0, 80)}` : ""}`);
      await logAttempt(ctx, false, latencyMs, null, errMsg);

      if (upstream.status === 429) cooldownKey(p.name, key, 60_000);
      else if (upstream.status === 401 || upstream.status === 403) cooldownKey(p.name, key, 5 * 60_000);
      else cooldownKey(p.name, key, 30_000);
    }
  }

  return errJson(
    `All providers/keys failed for model "${model}": ${failures.join(" | ")}`,
    502
  );
}

export type { ProviderRecord };
