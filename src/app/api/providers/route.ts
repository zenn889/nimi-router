import { dashboardForbidden, hasDashboardSession } from "@/lib/auth";
import {
  listProviders, createProvider, importEnvProviders, isDbConfigured, type ProviderRecord,
} from "@/lib/store";
import { maskSecret } from "@/lib/config";

export const dynamic = "force-dynamic";

function pub(p: ProviderRecord) {
  return {
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    apiKeys: p.apiKeys,
    apiKeysMasked: p.apiKeys.map(maskSecret),
    models: p.models,
    priority: p.priority,
    enabled: p.enabled,
  };
}

export async function GET() {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  const providers = await listProviders().catch(() => []);
  return Response.json({ providers: providers.map(pub), db: isDbConfigured() });
}

export async function POST(req: Request) {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  if (!isDbConfigured()) {
    return Response.json(
      { error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY to manage providers from the UI." },
      { status: 400 }
    );
  }
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = String(b.name || "").trim();
  const baseUrl = String(b.baseUrl || "").trim().replace(/\/+$/, "");
  const apiKeys = Array.isArray(b.apiKeys)
    ? [...new Set((b.apiKeys as unknown[]).map(String).map((s) => s.trim()).filter(Boolean))]
    : [];
  const models = String(b.models || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!name || !baseUrl || apiKeys.length === 0) {
    return Response.json({ error: "name, baseUrl, and at least one apiKey are required." }, { status: 400 });
  }

  try {
    const p = await createProvider({
      name,
      baseUrl,
      apiKeys,
      models: models.length ? models : ["*"],
      priority: Number(b.priority ?? 0),
      enabled: b.enabled !== false,
    });
    return Response.json({ provider: pub(p) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Create failed." }, { status: 500 });
  }
}

/** Import providers from PROVIDERS_JSON env into the DB (action=import). */
export async function PUT(req: Request) {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "import") {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  try {
    const n = await importEnvProviders();
    return Response.json({ imported: n });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Import failed." }, { status: 500 });
  }
}
