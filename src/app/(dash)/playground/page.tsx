import { listProviders } from "@/lib/store";
import PlaygroundClient from "@/components/PlaygroundClient";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const providers = await listProviders().catch(() => []);
  const first = providers.find((p) => p.enabled);
  const defaultModel =
    first && !first.models.includes("*") ? first.models[0] : "gpt-4o-mini";

  return <PlaygroundClient defaultModel={defaultModel} />;
}
