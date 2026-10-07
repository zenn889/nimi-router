import { dashboardForbidden, hasDashboardSession } from "@/lib/auth";
import { deleteApiKey, setApiKeyEnabled } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  const { id } = await params;
  let enabled = true;
  try {
    enabled = (await req.json()).enabled !== false;
  } catch {
    /* ignore */
  }
  try {
    await setApiKeyEnabled(decodeURIComponent(id), enabled);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Update failed." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasDashboardSession())) return dashboardForbidden();
  const { id } = await params;
  try {
    await deleteApiKey(decodeURIComponent(id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Delete failed." }, { status: 500 });
  }
}
