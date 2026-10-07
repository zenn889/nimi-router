import { dashboardForbidden, hasDashboardSession } from "@/lib/auth";
import { listApiKeys, createApiKey, isDbConfigured } from "@/lib/store";
import { maskSecret } from "@/lib/config";

export const dynamic = "force-dynamic";

function pub(k: { id: string; name: string; key: string; enabled: boolean; createdAt: string }) {
  return { id: k.id, name: k.name, keyMasked: maskSecret(k.key), enabled: k.enabled, createdAt: k.createdAt };
}

export async function GET() {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  const keys = await listApiKeys().catch(() => []);
  return Response.json({ keys: keys.map(pub), db: isDbConfigured() });
}

export async function POST(req: Request) {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  if (!isDbConfigured()) {
    return Response.json(
      { error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY to manage API keys from the UI." },
      { status: 400 }
    );
  }
  let name = "key";
  try {
    name = String((await req.json()).name || "key").trim() || "key";
  } catch {
    /* ignore */
  }
  try {
    const k = await createApiKey(name);
    // Return the raw key ONCE so the user can copy it.
    return Response.json({ id: k.id, name: k.name, key: k.key, enabled: k.enabled });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Create failed." }, { status: 500 });
  }
}
