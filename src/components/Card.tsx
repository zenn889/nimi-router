import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** 9Router-style card: warm surface, soft border, material icon header. */
export default function Card({ title, subtitle, icon, action, className = "", children }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-alt)] text-[var(--text-muted)]">
                <span className="material-symbols-outlined text-[20px] text-[var(--brand)]">{icon}</span>
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold tracking-tight">{title}</h2>
              {subtitle && <p className="truncate text-xs text-[var(--text-muted)]">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
