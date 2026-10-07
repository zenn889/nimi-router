import { dashboardForbidden, hasDashboardSession } from "@/lib/auth";
import { getStats } from "@/lib/stats";
import { dbStats, isDbConfigured } from "@/lib/store";
import { coolingSnapshot } from "@/lib/keypool";
import { maskSecret } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Dashboard stats API. Route handlers share module state with the router,
 * so stats/cooling are accurate here (RSC pages must fetch this endpoint —
 * they run in a separate module graph under Turbopack).
 * Uses Supabase aggregates when configured, otherwise in-memory stats.
 */
export async function GET() {
  if (!(await hasDashboardSession())) return dashboardForbidden();

  const cooling = coolingSnapshot();
  const coolByKey = new Map(cooling.map((c) => [`${c.provider}::${maskSecret(c.key)}`, c.msLeft]));

  const db = await dbStats().catch(() => null);
  if (db) {
    return Response.json({
      ...db,
      keys: db.keys.map((k) => ({
        ...k,
        cooling: coolByKey.has(`${k.provider}::${k.keyMasked}`),
        cooldownMs: coolByKey.get(`${k.provider}::${k.keyMasked}`) ?? 0,
      })),
      db: true,
    });
  }

  const s = getStats();
  return Response.json({
    ...s,
    keys: s.keys.map((k) => {
      const keyMasked = maskSecret(k.key);
      return {
        provider: k.provider,
        keyMasked,
        requests: k.requests,
        success: k.success,
        failed: k.failed,
        promptTokens: k.promptTokens,
        completionTokens: k.completionTokens,
        totalTokens: k.totalTokens,
        avgLatencyMs: k.avgLatencyMs,
        cooling: coolByKey.has(`${k.provider}::${keyMasked}`),
        cooldownMs: coolByKey.get(`${k.provider}::${keyMasked}`) ?? 0,
        lastError: k.lastError,
      };
    }),
    db: false,
  });
}
