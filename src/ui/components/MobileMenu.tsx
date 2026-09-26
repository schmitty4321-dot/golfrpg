import { useEffect, useRef, useState, type ReactNode } from "react";
import { TABS, type Go, type Tab } from "../nav";

/**
 * On phones the tab bar doesn't fit: a menu button opens every tab (and the
 * season and theme, which the bar hides on small screens) in one panel.
 */
export function MobileMenu({ tab, go, extra }: { tab: Tab; go: Go; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = TABS.find((t) => t.id === tab);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="mobile-menu" ref={ref}>
      <span className="mobile-menu-current">{current?.label}</span>
      <button className="btn btn-small mobile-menu-button" aria-haspopup="menu" aria-expanded={open} aria-controls="mobile-menu-panel" onClick={() => setOpen(!open)}>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden>
          {open ? <path d="M3 1l10 10M13 1L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : <path d="M1 1h14M1 6h14M1 11h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
        </svg>
        Menu
      </button>
      {open && (
        <div className="mobile-menu-panel" id="mobile-menu-panel" role="menu">
          <div className="mobile-menu-grid">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="menuitem"
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => {
                  setOpen(false);
                  go(t.id);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {extra && <div className="mobile-menu-extra">{extra}</div>}
        </div>
      )}
    </div>
  );
}
