export type Tab = "home" | "agency" | "scouting" | "tournament" | "standings" | "calendar" | "player" | "training" | "finances" | "history" | "career";

export const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "This week" },
  { id: "agency", label: "Agency" },
  { id: "scouting", label: "Scouting" },
  { id: "tournament", label: "Leaderboards" },
  { id: "standings", label: "Standings" },
  { id: "calendar", label: "Calendar" },
  { id: "player", label: "Player" },
  { id: "training", label: "Training" },
  { id: "finances", label: "Finances" },
  { id: "history", label: "History" },
  { id: "career", label: "Save" },
];

/** Navigate to a tab, optionally opening a specific event's leaderboard. */
export type Go = (tab: Tab, eventId?: string) => void;
