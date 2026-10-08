"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg)]">
      {/* mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* sidebar — desktop */}
      <div className="hidden border-r border-[var(--border-subtle)] lg:flex">
        <Sidebar />
      </div>

      {/* sidebar — mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-[var(--border-subtle)] transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* main */}
      <main className="relative flex h-full min-w-0 flex-1 flex-col">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-6 lg:p-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
