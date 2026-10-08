import ProviderDetailClient from "@/components/ProviderDetailClient";

export const dynamic = "force-dynamic";

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProviderDetailClient id={id} />;
}
