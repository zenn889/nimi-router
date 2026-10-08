"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const TITLES: Record<string, string> = {
  "/": "Endpoint & Key",
  "/providers": "Providers",
  "/usage": "Usage",
  "/playground": "Playground",
  "/docs": "Docs",
};

function titleFor(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  const match = Object.keys(TITLES)
    .filter((k) => k !== "/")
    .find((k) => pathname.startsWith(k + "/"));
  return match ? TITLES[match] : "nimi-router";
}

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg)]/80 px-4 backdrop-blur-xl lg:px-8">
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] lg:hidden"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>
      <h1 className="flex-1 text-[17px] font-semibold tracking-tight">{titleFor(pathname)}</h1>
      <ThemeToggle />
    </header>
  );
}
