import { dashboardForbidden, hasDashboardSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Detect models available for a baseUrl + API key without saving a provider.
 * Used by the Add Provider form ("Fetch models").
 */
export async function POST(req: Request) {
  if (!(await hasDashboardSession())) return dashboardForbidden();

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const baseUrl = String(b.baseUrl || "").trim().replace(/\/+$/, "");
  const apiKey = String(b.apiKey || "").trim();
  if (!baseUrl || !apiKey) {
    return Response.json({ error: "baseUrl and apiKey are required." }, { status: 400 });
  }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return Response.json({ error: `Upstream returned HTTP ${res.status}.` }, { status: 400 });
    }
    const data = (await res.json()) as { data?: { id?: string }[] };
    const models = Array.isArray(data?.data)
      ? [...new Set(data.data.map((m) => String(m?.id || "")).filter(Boolean))].sort()
      : [];
    return Response.json({ models });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not reach the endpoint." },
      { status: 400 }
    );
  }
}
