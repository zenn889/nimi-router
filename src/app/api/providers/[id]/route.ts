import { dashboardForbidden, hasDashboardSession } from "@/lib/auth";
import { updateProvider, deleteProvider } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  const { id } = await params;
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = String(b.name).trim();
  if (b.baseUrl !== undefined) patch.baseUrl = String(b.baseUrl).trim().replace(/\/+$/, "");
  if (b.apiKeys !== undefined && Array.isArray(b.apiKeys)) {
    patch.apiKeys = [...new Set((b.apiKeys as unknown[]).map(String).map((s) => s.trim()).filter(Boolean))];
  }
  if (b.models !== undefined) {
    const models = Array.isArray(b.models)
      ? (b.models as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
      : String(b.models).split(",").map((s) => s.trim()).filter(Boolean);
    patch.models = models.length ? models : ["*"];
  }
  if (b.priority !== undefined) patch.priority = Number(b.priority);
  if (b.enabled !== undefined) patch.enabled = b.enabled !== false;
  if (b.disabledKeys !== undefined && Array.isArray(b.disabledKeys)) {
    patch.disabledKeys = [...new Set((b.disabledKeys as unknown[]).map(String).map((s) => s.trim()).filter(Boolean))];
  }

  try {
    await updateProvider(decodeURIComponent(id), patch as never);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Update failed." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  const { id } = await params;
  try {
    await deleteProvider(decodeURIComponent(id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Delete failed." }, { status: 500 });
  }
}
