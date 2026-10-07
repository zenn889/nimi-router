import { cookies } from "next/headers";
import { findApiKey, listApiKeys } from "./store";

export const SESSION_COOKIE = "nimi-session";

/** Single dashboard password from env (PASSWORD, or legacy DASHBOARD_PASSWORD). */
export function getDashboardPassword(): string | null {
  return process.env.PASSWORD || process.env.DASHBOARD_PASSWORD || null;
}

/**
 * Client API key check for /api/v1/*.
 * Keys are managed in the dashboard (DB) with env ROUTER_API_KEY as fallback.
 * Open access only when no keys are configured anywhere.
 */
export async function checkApiKey(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (key) {
    const rec = await findApiKey(key).catch(() => null);
    return !!(rec && rec.enabled);
  }

  const keys = await listApiKeys().catch(() => []);
  return keys.filter((k) => k.enabled).length === 0;
}

export function unauthorized() {
  return Response.json(
    { error: { message: "Invalid or missing API key.", type: "authentication_error" } },
    { status: 401 }
  );
}

/** Dashboard session check (set after PASSWORD login). */
export async function hasDashboardSession(): Promise<boolean> {
  if (!getDashboardPassword()) return true;
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value === "ok";
}

export function dashboardForbidden() {
  return Response.json({ error: "Dashboard login required." }, { status: 403 });
}
