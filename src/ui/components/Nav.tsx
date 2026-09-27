import type { ReactNode } from "react";
import { eventsInWeek, seasonWeeks, type World } from "../../season";
import { millions } from "../format";
import { SECTIONS, sectionOf, type SectionId, type Tab } from "../nav";

const ICONS: Record<SectionId, ReactNode> = {
  // Flag on a green.
  week: <><path d="M8 3v15" /><path d="M8 3l8 3.5L8 10" /><ellipse cx="10" cy="19" rx="7" ry="2" /></>,
  // Two people.
  clients: <><circle cx="8" cy="8" r="3" /><path d="M2.5 19c.6-3.4 2.8-5 5.5-5s4.9 1.6 5.5 5" /><circle cx="16" cy="8.5" r="2.5" /><path d="M15 14.2c2.6-.2 4.6 1.3 5.3 4.8" /></>,
  // Briefcase.
  agency: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  // Trophy.
  tour: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" /></>,
  // A save disk.
  game: <><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
};

function Icon({ id }: { id: SectionId }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[id]}
    </svg>
  );
}

/** The five sections: the top bar on desktop, the bottom bar on phones. */
export function SectionBar({ tab, open, variant }: { tab: Tab; open: (s: SectionId) => void; variant: "top" | "bottom" }) {
  const current = sectionOf(tab).id;
  return (
    <nav className={variant === "top" ? "nav" : "bottom-nav"} aria-label="Sections">
      {SECTIONS.map((s) => (
        <button key={s.id} aria-current={current === s.id ? "page" : undefined} onClick={() => open(s.id)}>
          {variant === "bottom" && <Icon id={s.id} />}
          <span>{s.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** The current section's screens, as a row of pills. */
export function SubTabs({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const section = sectionOf(tab);
  return (
    <div className="subtabs" role="tablist" aria-label={section.label}>
      {section.tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

/**
 * Where the season stands, on every screen, and the button that moves the
 * game on (play the week, or close the season once it's over).
 */
export function StatusStrip({ world, action }: { world: World; action: { label: string; run: () => void } | null }) {
  const weeks = seasonWeeks(world);
  const events = world.week <= weeks ? eventsInWeek(world) : [];
  const main = events[0];
  return (
    <div className="status-strip">
      <div className="status-items">
        <b>{world.week > weeks ? `Season ${world.season} over` : `Week ${world.week} of ${weeks}`}</b>
        {main && (
          <span className="status-event">
            {main.name}
            {events.length > 1 && <span className="muted"> +{events.length - 1}</span>}
          </span>
        )}
        <span className="status-extra">{world.clientIds.length} client{world.clientIds.length === 1 ? "" : "s"}</span>
        <span className="status-extra">Bank {millions(world.agency.bank)}</span>
        <span className="status-extra">Rep {Math.round(world.agency.reputation)}</span>
        {world.edited && <span className="badge" title="This world has been changed in the editor">Edited</span>}
      </div>
      {action && (
        <button className="btn btn-primary btn-small status-continue" onClick={action.run}>
          {action.label} <span aria-hidden>▸</span>
        </button>
      )}
    </div>
  );
}
