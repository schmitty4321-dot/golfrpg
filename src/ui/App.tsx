import { useEffect, useState } from "react";
import { Calendar } from "./screens/Calendar";
import { Career } from "./screens/Career";
import { Finances } from "./screens/Finances";
import { Home } from "./screens/Home";
import { NewGame } from "./screens/NewGame";
import { PlayerScreen } from "./screens/PlayerScreen";
import { SeasonReview } from "./screens/SeasonReview";
import { Standings } from "./screens/Standings";
import { Tournament } from "./screens/Tournament";
import { TABS, type Go, type Tab } from "./nav";
import { useGame } from "./useGame";

type Theme = "system" | "light" | "dark";

export function App() {
  const game = useGame();
  const { world, busy, loaded, review } = game.state;
  const [tab, setTab] = useState<Tab>("home");
  const [eventId, setEventId] = useState<string | undefined>();
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("theme") as Theme | null) ?? "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Theme just won't be remembered.
    }
  }, [theme]);

  const go: Go = (t, id) => {
    setTab(t);
    if (id) setEventId(id);
    window.scrollTo(0, 0);
  };

  const nextTheme: Record<Theme, Theme> = { system: "dark", dark: "light", light: "system" };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="12" height="14" viewBox="0 0 12 14"><path d="M2 1v13" stroke="#fff" strokeWidth="1.6" /><path d="M2 1l8 3.2L2 7.4z" fill="#fff" /></svg>
          </span>
          Fairway Manager
        </div>
        {world && (
          <nav className="nav" aria-label="Main">
            {TABS.map((t) => (
              <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>{t.label}</button>
            ))}
          </nav>
        )}
        <div className="topbar-right" style={{ marginLeft: world ? undefined : "auto" }}>
          {world && <span>Season {world.season} · Week {Math.min(world.week, 36)}</span>}
          <button className="btn btn-small" onClick={() => setTheme(nextTheme[theme])} title="Switch light / dark / system theme">
            Theme: {theme}
          </button>
        </div>
      </header>

      {!loaded ? null : !world ? (
        <NewGame game={game} />
      ) : tab === "home" ? (
        <Home world={world} game={game} go={go} />
      ) : tab === "tournament" ? (
        <Tournament world={world} game={game} eventId={eventId} setEventId={setEventId} />
      ) : tab === "standings" ? (
        <Standings world={world} />
      ) : tab === "calendar" ? (
        <Calendar world={world} game={game} go={go} />
      ) : tab === "player" ? (
        <PlayerScreen world={world} />
      ) : tab === "finances" ? (
        <Finances world={world} />
      ) : (
        <Career world={world} game={game} />
      )}

      {review && <SeasonReview summary={review} onClose={() => { game.dismissReview(); go("home"); }} />}
      {busy && (
        <div className="busy" role="status">
          <div><span className="spinner" aria-hidden />{busy}</div>
        </div>
      )}
    </>
  );
}
