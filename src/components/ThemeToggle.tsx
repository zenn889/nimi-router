"use client";

import { useEffect } from "react";

export default function ThemeToggle() {
  useEffect(() => {
    // keep in sync if theme was set by the inline script
    const dark = document.documentElement.classList.contains("dark");
    setDark(dark);
  }, []);

  function setDark(dark: boolean) {
    const el = document.getElementById("theme-toggle");
    if (el) el.setAttribute("data-dark", dark ? "true" : "false");
  }

  function toggle() {
    const html = document.documentElement;
    const dark = html.classList.toggle("dark");
    try {
      localStorage.setItem("nimi-theme", dark ? "dark" : "light");
    } catch {}
    setDark(dark);
  }

  return (
    <button
      id="theme-toggle"
      data-dark="true"
      onClick={toggle}
      title="Toggle theme"
      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
    >
      <span className="material-symbols-outlined text-[20px] dark:hidden">light_mode</span>
      <span className="material-symbols-outlined hidden text-[20px] dark:inline">dark_mode</span>
    </button>
  );
}
