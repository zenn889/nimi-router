"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
    ),
  },
  {
    href: "/providers",
    label: "Providers",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg>
    ),
  },
  {
    href: "/playground",
    label: "Playground",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    ),
  },
  {
    href: "/keys",
    label: "API Keys",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
    ),
  },
  {
    href: "/docs",
    label: "Docs",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#0b0b0d]/90 p-5 backdrop-blur-xl">
      <Link href="/" className="group mb-10 flex items-center gap-3 px-1">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-emerald-600 text-xl font-black text-black shadow-[0_0_24px_rgba(52,211,153,0.35)] transition-transform group-hover:scale-105">
          n
        </span>
        <span className="leading-tight">
          <span className="block text-[17px] font-bold tracking-tight">
            nimi<span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">-router</span>
          </span>
          <span className="block text-[11px] font-medium text-zinc-500">AI model router</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1.5">
        <div className="label px-3.5">Menu</div>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`navlink ${active ? "navlink-active" : ""}`}>
              <span className={active ? "text-emerald-300" : "text-zinc-500"}>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2.5">
          <span className="dot-live h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-zinc-300">Router online</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          Requests route with automatic fallback across providers.
        </p>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-400 transition-all hover:border-white/20 hover:text-zinc-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
