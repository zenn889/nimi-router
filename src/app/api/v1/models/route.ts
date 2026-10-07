import { checkApiKey, unauthorized } from "@/lib/auth";
import { listProviders } from "@/lib/store";

export const dynamic = "force-dynamic";

interface ModelEntry {
  id: string;
  object: "model";
  owned_by: string;
}

/** Aggregate model list across enabled providers (OpenAI /v1/models shape). */
export async function GET(req: Request) {
  if (!(await checkApiKey(req))) return unauthorized();

  const seen = new Map<string, ModelEntry>();
  const providers = (await listProviders().catch(() => [])).filter((p) => p.enabled);

  await Promise.all(
    providers.map(async (p) => {
      if (p.models.includes("*")) {
        // Discover the provider's own model catalogue (using its first key).
        try {
          const res = await fetch(`${p.baseUrl}/models`, {
            headers: { Authorization: `Bearer ${p.apiKeys[0]}` },
          });
          if (res.ok) {
            const data = await res.json();
            for (const m of data?.data ?? []) {
              if (m?.id && !seen.has(m.id))
                seen.set(m.id, { id: m.id, object: "model", owned_by: p.name });
            }
          }
        } catch {
          /* ignore — provider stays listed without catalogue */
        }
      } else {
        for (const m of p.models) {
          if (!seen.has(m)) seen.set(m, { id: m, object: "model", owned_by: p.name });
        }
      }
    })
  );

  return Response.json({ object: "list", data: [...seen.values()] });
}
