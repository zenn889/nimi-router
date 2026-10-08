"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "Endpoint & Key", icon: "api" },
  { href: "/providers", label: "Providers", icon: "dns" },
  { href: "/usage", label: "Usage", icon: "bar_chart" },
  { href: "/playground", label: "Playground", icon: "chat" },
  { href: "/docs", label: "Docs", icon: "menu_book" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-[var(--sidebar)] backdrop-blur-xl">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-5 pb-6 pt-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--brand)] text-xl font-black text-white shadow-[0_2px_12px_-2px_rgba(229,106,74,0.5)]">
          n
        </span>
        <span className="leading-tight">
          <span className="block text-[17px] font-bold tracking-tight">
            nimi<span className="text-[var(--brand)]">-router</span>
          </span>
          <span className="block text-[11px] font-medium text-[var(--text-muted)]">AI model router</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`navlink ${active ? "navlink-active" : ""}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <div className="card !p-4">
          <div className="flex items-center gap-2.5">
            <span className="dot-live" />
            <span className="text-xs font-semibold">Router online</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Requests route with automatic fallback across providers.
          </p>
          <button onClick={logout} className="btn-ghost mt-3 w-full !py-2 text-xs">
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
