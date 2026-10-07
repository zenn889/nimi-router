import type { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "emerald",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  accent?: "emerald" | "sky" | "violet" | "amber";
}) {
  const accents: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/0 text-emerald-300",
    sky: "from-sky-500/20 to-sky-500/0 text-sky-300",
    violet: "from-violet-500/20 to-violet-500/0 text-violet-300",
    amber: "from-amber-500/20 to-amber-500/0 text-amber-300",
  };
  return (
    <div className="card card-hover group relative overflow-hidden">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accents[accent]} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{label}</div>
          <div className="text-zinc-600 transition-colors group-hover:text-zinc-400">{icon}</div>
        </div>
        <div className="mt-2 bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-[32px] font-bold leading-none tracking-tight text-transparent">
          {value}
        </div>
        {sub && <div className="mt-2 text-xs text-zinc-500">{sub}</div>}
      </div>
    </div>
  );
}

export const Icons = {
  activity: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
  ),
  zap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  ),
  layers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg>
  ),
};
