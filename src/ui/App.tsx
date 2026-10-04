import { useEffect, useState } from "react";
import { AchievementsScreen } from "./screens/Achievements";
import { Agency } from "./screens/Agency";
import { Calendar } from "./screens/Calendar";
import { ClientPicker } from "./components/ClientPicker";
import { Scouting } from "./screens/Scouting";
import { Career } from "./screens/Career";
import { Finances } from "./screens/Finances";
import { Headquarters } from "./screens/Headquarters";
import { Recruiting, Rivals, Trophies } from "./screens/Market";
import { MatchPlayScreen, RyderCupScreen } from "./screens/MatchPlay";
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
import { Team } from "./screens/Team";
import { SECTIONS, sectionOf, type Go, type SectionId, type Tab } from "./nav";
import { AppRail, StatusStrip } from "./components/Nav";
import type { ClientChoices } from "../season";
import { useGame } from "./useGame";
import { WaialaeTracerPreview } from "./screens/WaialaeTracerPreview";
import { IllustrationCalibrator } from "./screens/IllustrationCalibrator";

type Theme = "system" | "light" | "dark";

export function App() {
  const game = useGame();
  const { world, busy, loaded, review } = game.state;
  const [tab, setTab] = useState<Tab>("home");
  const [eventId, setEventId] = useState<string | undefined>();
  const [picked, setPicked] = useState<string | undefined>();
  // Where each section was left, so coming back to it returns there.
  const [lastIn, setLastIn] = useState<Partial<Record<SectionId, Tab>>>({});
  const [choices, setChoices] = useState<ClientChoices>({});
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

  const demo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("demo") : null;
  if (demo === "waialae-tracer") return <WaialaeTracerPreview />;
  if (demo === "art-calibrator") return <IllustrationCalibrator />;

  const go: Go = (t, id) => {
    setTab(t);
    setLastIn((l) => ({ ...l, [sectionOf(t).id]: t }));
    if (id) setEventId(id);
    window.scrollTo(0, 0);
  };

  const nextTheme: Record<Theme, Theme> = { system: "dark", dark: "light", light: "system" };
  const inEvent = Boolean(game.state.live || game.state.liveWeek);
  // Keep a live tournament available on This week while allowing the other screens to be viewed.
  const showEvent = inEvent && tab === "home";

  const openSection = (s: SectionId) => {
    const section = SECTIONS.find((x) => x.id === s)!;
    // The Week section is the way back to a tournament that is still in progress.
    if (inEvent && s === "week") {
      if (!showEvent) go("home");
      return;
    }
    // Tapping the section you're in goes back to its first screen.
    go(sectionOf(tab).id === s ? section.tabs[0]!.id : lastIn[s] ?? section.tabs[0]!.id);
  };
  const seasonOver = world ? world.week > game.lib.seasonWeeks(world) : false;
  const action = !world || inEvent || busy
    ? null
    : seasonOver
      ? { label: "Close season", run: () => void game.closeSeason() }
      : {
          label: `Play week ${world.week}`,
          run: () => {
            setTab("home");
            void game.play(choices, 1);
            setChoices({});
          },
        };

  return (
    <>
      {!world && <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="12" height="14" viewBox="0 0 12 14"><path d="M2 1v13" stroke="#fff" strokeWidth="1.6" /><path d="M2 1l8 3.2L2 7.4z" fill="#fff" /></svg>
          </span>
          <span className="brand-name">Fairway Manager</span>
        </div>
        <div className="topbar-right" style={{ marginLeft: "auto" }}>
          <button className="btn btn-small" onClick={() => setTheme(nextTheme[theme])} title={`Theme: ${theme} (click to switch)`} aria-label={`Theme: ${theme}`}>
            {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"}
          </button>
        </div>
      </header>}
      {world ? <div className="app-shell"><AppRail tab={tab} open={openSection} go={go} season={world.season} theme={theme} onTheme={() => setTheme(nextTheme[theme])} /><div className="app-main"><StatusStrip world={world} action={action} />{showEvent ? (
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
        <Home world={world} game={game} go={go} week={{ choices, setChoices }} />
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
      ) : (tab === "player" || tab === "training" || tab === "team") && !clientId ? (
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
      ) : tab === "team" ? (
        <>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 20px 0" }}><ClientPicker world={world} value={clientId!} onChange={setPicked} /></div>
          <Team world={world} game={game} clientId={clientId!} />
        </>
      ) : tab === "editor" ? (
        <Editor world={world} game={game} />
      ) : tab === "achievements" ? (
        <AchievementsScreen world={world} />
      ) : tab === "ryder" ? (
        <RyderCupScreen world={world} />
      ) : tab === "matchplay" ? (
        <MatchPlayScreen world={world} />
      ) : tab === "history" ? (
        <HistoryScreen world={world} />
      ) : tab === "recruiting" ? (
        <Recruiting world={world} game={game} />
      ) : tab === "trophies" ? (
        <Trophies world={world} />
      ) : tab === "rivals" ? (
        <Rivals world={world} />
      ) : tab === "hq" ? (
        <Headquarters world={world} game={game} />
      ) : tab === "finances" ? (
        <Finances world={world} game={game} />
      ) : (
        <Career world={world} game={game} />
      )}</div></div> : !loaded ? null : <NewGame game={game} />}
      {review && world && <SeasonReview world={world} summary={review} onClose={() => { game.dismissReview(); go("home"); }} />}
      {busy && (
        <div className="busy" role="status">
          <div><span className="spinner" aria-hidden />{busy}</div>
        </div>
      )}
    </>
  );
}
