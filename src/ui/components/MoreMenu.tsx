import { useEffect, useRef, useState } from "react";
import { TABS, type Go, type Tab } from "../nav";

/** The less-used tabs (History, Editor, Save), tucked into one button. */
export function MoreMenu({ tab, go }: { tab: Tab; go: Go }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    // The bar scrolls sideways on phones, so place the menu from where the button actually is on screen.
    const r = button.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 168)) });
    setOpen(!open);
  };
  const items = TABS.filter((t) => t.more);
  const current = items.find((t) => t.id === tab);
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
    <div className="more" ref={ref}>
      <button ref={button} aria-haspopup="menu" aria-expanded={open} aria-current={current ? "page" : undefined} onClick={toggle}>
        {current ? current.label : "More"} ▾
      </button>
      {open && (
        <div className="more-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
          {items.map((t) => (
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
      )}
    </div>
  );
}
