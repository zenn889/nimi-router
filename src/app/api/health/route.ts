import { listProviders, isDbConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers = await listProviders().catch(() => []);
  return Response.json({
    ok: true,
    service: "nimi-router",
    providers: providers.length,
    db: isDbConfigured(),
    time: new Date().toISOString(),
  });
}
