/** 9Router-style stat card: centered, uppercase label, big tabular value. */
export default function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "brand" | "green" | "blue" | "amber";
}) {
  const tones: Record<string, string> = {
    brand: "text-[var(--brand)]",
    green: "text-[#22c55e]",
    blue: "text-[#3b82f6]",
    amber: "text-[#f59e0b]",
  };
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone ? tones[tone] : ""}`} title={value}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-[var(--text-muted)]">{sub}</span>}
    </div>
  );
}
