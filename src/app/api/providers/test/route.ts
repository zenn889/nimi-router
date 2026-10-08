import { dashboardForbidden, hasDashboardSession } from "@/lib/auth";
import { listProviders } from "@/lib/store";
import { maskSecret } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Test every key of a provider: GET {baseUrl}/models with each key. */
export async function POST(req: Request) {
  if (!(await hasDashboardSession())) return dashboardForbidden();

  let index = -1;
  try {
    index = Number((await req.json()).index);
  } catch {
    /* ignore */
  }
  const providers = await listProviders().catch(() => []);
  const p = providers[index];
  if (!p) return Response.json({ ok: false, error: "Unknown provider." }, { status: 400 });

  const results = await Promise.all(
    p.apiKeys.map(async (key) => {
      const started = Date.now();
      try {
        const res = await fetch(`${p.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        const ms = Date.now() - started;
        if (res.ok) {
          let data: { data?: { id?: string }[] } | null = null;
          try {
            data = await res.json();
          } catch {
            /* ignore */
          }
          const ids = Array.isArray(data?.data)
            ? data.data.map((m) => String(m?.id || "")).filter(Boolean)
            : [];
          return { key: maskSecret(key), ok: true, latencyMs: ms, models: ids.length || undefined, modelIds: ids };
        }
        return { key: maskSecret(key), ok: false, latencyMs: ms, error: `HTTP ${res.status}` };
      } catch (e) {
        return {
          key: maskSecret(key),
          ok: false,
          latencyMs: Date.now() - started,
          error: e instanceof Error ? e.message : "network error",
        };
      }
    })
  );

  const availableModels = [...new Set(results.flatMap((r) => ("modelIds" in r && Array.isArray(r.modelIds) ? r.modelIds as string[] : [])))];

  return Response.json({
    results: results.map(({ modelIds, ...r }) => r),
    allOk: results.every((r) => r.ok),
    availableModels,
  });
}
