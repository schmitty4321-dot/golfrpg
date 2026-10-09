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
  // A person with a plus: signing new talent.
  recruiting: <><circle cx="10" cy="8" r="3.5" /><path d="M4 20c.8-3.6 3.2-5.5 6-5.5s5.2 1.9 6 5.5" /><path d="M19 4v5M16.5 6.5h5" /></>,
  // Trophy.
  tour: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" /></>,
  // A save disk.
  game: <><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
};

const TAB_ICONS: Record<Tab, ReactNode> = {
  home: <><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5M10 20v-6h4v6"/></>,
  tournament: <><path d="M4 18h16M6 15h12M8 12h8"/><path d="M9 4h6l-1 8h-4z"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/></>,
  agency: <><path d="M4 20V8l8-4 8 4v12M8 20v-5h8v5"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></>,
  partnerships: <><path d="M4 9l4-4 4 3 4-3 4 4-5 6-3-2-3 2z"/><path d="M7 15l5 5 5-5"/></>,
  player: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-4.4 3.3-6.5 7.5-6.5s6.7 2.1 7.5 6.5"/></>,
  training: <><path d="M5 8h14M7 5v6M17 5v6M3 10v4M21 10v4M5 16h14M7 13v6M17 13v6"/></>,
  team: <><circle cx="8" cy="9" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 20c.6-3.7 2.7-5.5 5.5-5.5s4.9 1.8 5.5 5.5M14 14c3.5-.8 6.4 1.2 7 5"/></>,
  hq: <><path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01"/></>,
  scouting: <><circle cx="8.5" cy="8.5" r="4.5"/><circle cx="15.5" cy="8.5" r="4.5"/><path d="M12 8.5V19M8 19h8"/></>,
  amateurResults: <><path d="m3 9 9-5 9 5-9 5zM7 12v4c3 2 7 2 10 0v-4M20 10v6"/><circle cx="20" cy="18" r="1"/></>,
  recruiting: <><path d="M4 20h16M6 17l4-4 3 2 5-7"/><path d="m15 8 3-.5.5 3"/></>,
  scoutingBoard: <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/><path d="m16 15 2 2 3-4"/></>,
  rivals: <><path d="m4 20 6-6M14 10l6-6M5 4l15 15M4 4l16 16"/><path d="m4 4 5 1-4 4M20 20l-5-1 4-4"/></>,
  trophies: <><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/></>,
  achievements: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></>,
  finances: <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></>,
  schedule: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M9 14v5M9 14l6 2-6 2"/></>,
  standings: <><path d="M5 20V11h4v9M10 20V4h4v16M15 20v-6h4v6M3 20h18"/></>,
  stats: <><path d="m4 17 5-6 4 3 7-9M16 5h4v4"/><path d="M4 21h16"/></>,
  ryder: <><path d="M5 5h14v10H5z"/><path d="M8 15v5M16 15v5M5 9h14"/></>,
  matchplay: <><circle cx="8" cy="9" r="4"/><circle cx="16" cy="15" r="4"/><path d="m11 12 2 1"/></>,
  history: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M3 12H1"/></>,
  career: <><path d="M5 4h11l3 3v13H5zM8 4v6h7V4M8 20v-6h8v6"/></>,
  editor: <><path d="m5 19 1-5L16.5 3.5a2.1 2.1 0 0 1 3 3L9 17zM13.5 6.5l4 4"/></>,
};

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  home: "Plans and decisions", tournament: "Live results and fields", calendar: "Full season view",
  agency: "Roster and contracts", player: "Detailed player profile", training: "Focus and development", team: "Caddie, travel and clubs",
  hq: "Staff and facilities", partnerships: "Sponsors and relationships", scouting: "Find talent worldwide", recruiting: "Recruiting desk", amateurResults: "Track emerging players", scoutingBoard: "Players you are following",
  rivals: "Competing agencies", trophies: "Titles and legacy", achievements: "Agency milestones", finances: "Revenue, costs and forecasts",
  schedule: "Events and entry dates", standings: "Rankings across the tour", stats: "Performance and records", ryder: "International team golf",
  matchplay: "Brackets and results", history: "Past seasons and champions", career: "Back up your career", editor: "Edit the game world",
};

function TabIcon({ id }: { id: Tab }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{TAB_ICONS[id]}</svg>;
}

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

/** Persistent desktop navigation: major areas first, then the current area's screens. */
export function AppRail({ tab, open, go, season, theme, onTheme }: { tab: Tab; open: (s: SectionId) => void; go: (t: Tab) => void; season: number; theme: string; onTheme: () => void }) {
  const current = sectionOf(tab);
  return (
    <aside className="app-rail">
      <div className="app-rail-brand"><span className="app-rail-monogram"><svg viewBox="0 0 32 38" aria-hidden><path d="M7 34V4"/><path d="M8 5c8-2 12 4 19 1v15c-7 3-11-3-19-1"/></svg></span><strong>FAIRWAY<br />MANAGER</strong><small>Golf agency</small></div>
      <nav className="app-rail-primary" aria-label="Main navigation">
        {SECTIONS.map((s) => <button key={s.id} aria-current={current.id === s.id ? "page" : undefined} onClick={() => open(s.id)}><Icon id={s.id} /><span>{s.label}</span></button>)}
      </nav>
      <div className="app-rail-context">
        <small>{current.label}</small>
        <nav aria-label={`${current.label} screens`}>
          {current.tabs.map((t) => <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}><span className="app-rail-context-icon"><TabIcon id={t.id} /></span><span className="app-rail-context-copy"><strong>{t.label}</strong><em>{TAB_DESCRIPTIONS[t.id]}</em></span><b>›</b></button>)}
        </nav>
      </div>
      <div className="app-rail-footer"><span>Season {season}</span><button onClick={onTheme} title="Change theme">◐ {theme}</button></div>
    </aside>
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
