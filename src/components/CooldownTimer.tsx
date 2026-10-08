"use client";

import { useEffect, useState } from "react";

/** 9Router-style live cooldown countdown. Ticks every second. */
export default function CooldownTimer({ msLeft }: { msLeft: number }) {
  const [left, setLeft] = useState(msLeft);

  useEffect(() => {
    setLeft(msLeft);
    if (msLeft <= 0) return;
    const t = setInterval(() => {
      setLeft((v) => {
        const n = v - 1000;
        if (n <= 0) {
          clearInterval(t);
          return 0;
        }
        return n;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [msLeft]);

  if (left <= 0) return null;
  const s = Math.ceil(left / 1000);
  const label = s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return (
    <span className="pill pill-amber font-mono">
      <span className="material-symbols-outlined text-[14px]">timer</span>
      {label}
    </span>
  );
}
