import { headers } from "next/headers";
import EndpointClient from "@/components/EndpointClient";

export const dynamic = "force-dynamic";

/** 9Router-style home: Endpoint & Key. */
export default async function HomePage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "your-domain.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return (
    <div className="mx-auto max-w-4xl">
      <div className="anim-fade-up mb-6">
        <h1 className="section-title">Endpoint & Key</h1>
        <p className="section-sub">
          Point your clients at the endpoint below — requests route with automatic fallback across providers.
        </p>
      </div>
      <EndpointClient baseUrl={`${proto}://${host}`} />
    </div>
  );
}
