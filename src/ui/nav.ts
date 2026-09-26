export type Tab = "home" | "tournament" | "standings" | "calendar" | "player" | "finances" | "career";

export const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "This week" },
  { id: "tournament", label: "Leaderboards" },
  { id: "standings", label: "Standings" },
  { id: "calendar", label: "Calendar" },
  { id: "player", label: "Player" },
  { id: "finances", label: "Finances" },
  { id: "career", label: "Save" },
];

/** Navigate to a tab, optionally opening a specific event's leaderboard. */
export type Go = (tab: Tab, eventId?: string) => void;
