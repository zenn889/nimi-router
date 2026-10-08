// Provider configuration — loaded from environment variables.
// Works on Vercel (serverless) with zero database needed.

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  /** One or more API keys — requests rotate across them (round-robin). */
  apiKeys: string[];
  /** Explicit model list, or ["*"] to accept any model (passthrough). */
  models: string[];
  /** Lower = tried first. */
  priority: number;
  enabled: boolean;
  /** Masked keys excluded from routing. */
  disabledKeys: string[];
}

function parseProviders(): ProviderConfig[] {
  const raw = process.env.PROVIDERS_JSON;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p: Record<string, unknown>, i: number) => {
        // Accept `apiKeys: [...]` or legacy `apiKey: "..."`.
        const keys = Array.isArray(p.apiKeys)
          ? (p.apiKeys as unknown[]).map(String).filter(Boolean)
          : p.apiKey
            ? [String(p.apiKey)]
            : [];
        return {
          name: String(p.name || `provider-${i + 1}`),
          baseUrl: String(p.baseUrl || "").replace(/\/+$/, ""),
          apiKeys: [...new Set(keys)],
          models: Array.isArray(p.models) && p.models.length > 0 ? (p.models as string[]) : ["*"],
          priority: typeof p.priority === "number" ? p.priority : i,
          enabled: p.enabled !== false,
          disabledKeys: Array.isArray(p.disabledKeys) ? (p.disabledKeys as unknown[]).map(String).filter(Boolean) : [],
        };
      })
      .filter((p) => p.baseUrl && p.apiKeys.length > 0)
      .sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

export function getProviders(): ProviderConfig[] {
  return parseProviders();
}

/** Providers able to serve `model`, in fallback order. */
export function providersForModel(model: string): ProviderConfig[] {
  return getProviders().filter(
    (p) => p.enabled && (p.models.includes("*") || p.models.includes(model))
  );
}

/** API key clients must send as `Authorization: Bearer <key>`. Null = open access. */
export function getRouterApiKey(): string | null {
  return process.env.ROUTER_API_KEY || null;
}

/** Mask a secret for display: sk-abc...xyz */
export function maskSecret(s: string): string {
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 6)}••••${s.slice(-4)}`;
}
