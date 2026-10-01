export type Tab = "home" | "team" | "agency" | "scouting" | "hq" | "recruiting" | "rivals" | "trophies" | "tournament" | "standings" | "stats" | "calendar" | "player" | "training" | "finances" | "history" | "editor" | "career";

export type SectionId = "week" | "clients" | "agency" | "tour" | "game";

/**
 * The top bar has five sections; each shows its own row of sub-tabs. On phones
 * the same five sections sit in a bottom bar.
 */
export const SECTIONS: { id: SectionId; label: string; tabs: { id: Tab; label: string }[] }[] = [
  { id: "week", label: "Week", tabs: [{ id: "home", label: "This week" }, { id: "tournament", label: "Leaderboards" }, { id: "calendar", label: "Calendar" }] },
  { id: "clients", label: "Clients", tabs: [{ id: "agency", label: "Roster" }, { id: "player", label: "Player" }, { id: "training", label: "Training" }, { id: "team", label: "Team & gear" }] },
  { id: "agency", label: "Agency", tabs: [{ id: "hq", label: "HQ" }, { id: "scouting", label: "Scouting" }, { id: "recruiting", label: "Recruiting" }, { id: "rivals", label: "Rivals" }, { id: "trophies", label: "Trophies" }, { id: "finances", label: "Finances" }] },
  { id: "tour", label: "Tour", tabs: [{ id: "standings", label: "Standings" }, { id: "stats", label: "Stats" }, { id: "history", label: "History" }] },
  { id: "game", label: "Game", tabs: [{ id: "career", label: "Save" }, { id: "editor", label: "Editor" }] },
];

/** Every tab once, in section order. */
export const TABS: { id: Tab; label: string }[] = SECTIONS.flatMap((s) => s.tabs);

export function sectionOf(tab: Tab): (typeof SECTIONS)[number] {
  return SECTIONS.find((s) => s.tabs.some((t) => t.id === tab)) ?? SECTIONS[0]!;
}

/** Navigate to a tab, optionally opening a specific event's leaderboard. */
export type Go = (tab: Tab, eventId?: string) => void;
