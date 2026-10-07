import { headers } from "next/headers";
import KeysClient from "@/components/KeysClient";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "your-domain.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return <KeysClient baseUrl={`${proto}://${host}`} />;
}
