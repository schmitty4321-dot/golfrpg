import { useEffect, useState } from "react";
import { Agency } from "./screens/Agency";
import { Calendar } from "./screens/Calendar";
import { ClientPicker } from "./components/ClientPicker";
import { Scouting } from "./screens/Scouting";
import { Career } from "./screens/Career";
import { Finances } from "./screens/Finances";
import { HistoryScreen } from "./screens/History";
import { Editor } from "./screens/Editor";
import { EventScreen } from "./screens/EventScreen";
import { Home } from "./screens/Home";
import { NewGame } from "./screens/NewGame";
import { PlayerScreen } from "./screens/PlayerScreen";
import { SeasonReview } from "./screens/SeasonReview";
import { Standings } from "./screens/Standings";
import { Stats } from "./screens/Stats";
import { Tournament } from "./screens/Tournament";
import { Training } from "./screens/Training";
import { TABS, type Go, type Tab } from "./nav";
import { MoreMenu } from "./components/MoreMenu";
import { useGame } from "./useGame";

type Theme = "system" | "light" | "dark";

export function App() {
  const game = useGame();
  const { world, busy, loaded, review } = game.state;
  const [tab, setTab] = useState<Tab>("home");
  const [eventId, setEventId] = useState<string | undefined>();
  const [picked, setPicked] = useState<string | undefined>();
  // The client shown on the Player and Training tabs: the picked one if still signed, else the first.
  const clientId = world && picked && world.clientIds.includes(picked) ? picked : world?.clientIds[0];
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
    // Leaving the event screen finishes the week (anything unplayed plays itself), then moves on.
    if (game.state.live || game.state.liveWeek) void game.dismissLive();
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
          <span className="brand-name">Fairway Manager</span>
        </div>
        {world && (
          <nav className="nav" aria-label="Main">
            {TABS.filter((t) => !t.more).map((t) => (
              <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>{t.label}</button>
            ))}
            <MoreMenu tab={tab} go={go} />
          </nav>
        )}
        <div className="topbar-right" style={{ marginLeft: world ? undefined : "auto" }}>
          {world?.edited && <span className="badge" title="This world has been changed in the editor">Edited</span>}
          {world && <span className="topbar-season">S{world.season} · Wk {Math.min(world.week, game.lib.seasonWeeks(world))}</span>}
          <button className="btn btn-small" onClick={() => setTheme(nextTheme[theme])} title={`Theme: ${theme} (click to switch)`} aria-label={`Theme: ${theme}`}>
            {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"}
          </button>
        </div>
      </header>

      {!loaded ? null : !world ? (
        <NewGame game={game} />
      ) : game.state.live || game.state.liveWeek ? (
        <EventScreen
          key={`${world.season}-${game.state.live?.week ?? world.week}`}
          world={world}
          game={game}
          onDone={() => {
            void game.dismissLive();
            go("home");
          }}
        />
      ) : tab === "home" ? (
        <Home world={world} game={game} go={go} />
      ) : tab === "agency" ? (
        <Agency world={world} game={game} />
      ) : tab === "scouting" ? (
        <Scouting world={world} game={game} />
      ) : tab === "tournament" ? (
        <Tournament world={world} game={game} eventId={eventId} setEventId={setEventId} />
      ) : tab === "standings" ? (
        <Standings world={world} />
      ) : tab === "stats" ? (
        <Stats world={world} game={game} />
      ) : tab === "calendar" ? (
        <Calendar world={world} game={game} go={go} />
      ) : (tab === "player" || tab === "training") && !clientId ? (
        <main><section className="panel"><p className="empty">You have no clients. Sign one from the Scouting tab.</p></section></main>
      ) : tab === "player" ? (
        <>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 20px 0" }}><ClientPicker world={world} value={clientId!} onChange={setPicked} /></div>
          <PlayerScreen world={world} clientId={clientId!} />
        </>
      ) : tab === "training" ? (
        <>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 20px 0" }}><ClientPicker world={world} value={clientId!} onChange={setPicked} /></div>
          <Training world={world} game={game} clientId={clientId!} />
        </>
      ) : tab === "editor" ? (
        <Editor world={world} game={game} />
      ) : tab === "history" ? (
        <HistoryScreen world={world} />
      ) : tab === "finances" ? (
        <Finances world={world} />
      ) : (
        <Career world={world} game={game} />
      )}

      {review && world && <SeasonReview world={world} summary={review} onClose={() => { game.dismissReview(); go("home"); }} />}
      {busy && (
        <div className="busy" role="status">
          <div><span className="spinner" aria-hidden />{busy}</div>
        </div>
      )}
    </>
  );
}
