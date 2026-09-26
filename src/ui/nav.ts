export type Tab = "home" | "agency" | "scouting" | "tournament" | "standings" | "calendar" | "player" | "training" | "finances" | "history" | "editor" | "career";

/** Tabs in the bar; `more: true` ones live in the "More" menu to keep the bar on one line. */
export const TABS: { id: Tab; label: string; more?: boolean }[] = [
  { id: "home", label: "This week" },
  { id: "agency", label: "Agency" },
  { id: "scouting", label: "Scouting" },
  { id: "tournament", label: "Leaderboards" },
  { id: "standings", label: "Standings" },
  { id: "calendar", label: "Calendar" },
  { id: "player", label: "Player" },
  { id: "training", label: "Training" },
  { id: "finances", label: "Finances" },
  { id: "history", label: "History", more: true },
  { id: "editor", label: "Editor", more: true },
  { id: "career", label: "Save", more: true },
];

/** Navigate to a tab, optionally opening a specific event's leaderboard. */
export type Go = (tab: Tab, eventId?: string) => void;
