import { coursePar, courseYards } from "../../engine";
import {
  FULL_CARD,
  REGION_NAMES,
  seasonWeeks,
  PRO_AGE,
  STATUS_LABELS,
  clientOptions,
  clientPreference,
  courseById,
  eventsInWeek,
  pointsList,
  rosterLimit,
  type ClientChoice,
  type ClientChoices,
  type EntryOption,
  type World,
} from "../../season";
import { TIER_LABELS, fitWord, formWord, millions, money, signed } from "../format";
import type { Go } from "../nav";
import type { Game } from "../useGame";

const ACCESS_TONE: Record<EntryOption["access"], string> = {
  invited: "var(--good)",
  in: "var(--good)",
  alternate: "var(--warning)",
  monday: "var(--serious)",
  "not-invited": "var(--critical)",
  injured: "var(--critical)",
};

/** The week's choices live in the App so the status bar's Continue plays the same week. */
export interface WeekChoices {
  choices: ClientChoices;
  setChoices: (f: (c: ClientChoices) => ClientChoices) => void;
}

export function Home({ world, game, go, week }: { world: World; game: Game; go: Go; week: WeekChoices }) {
  const seasonOver = world.week > seasonWeeks(world);
  const last = game.state.reports[game.state.reports.length - 1];
  return (
    <main>
      <WeekHero world={world} game={game} week={week} />
      <AgencyStrip world={world} />
      <Alerts world={world} go={go} />
      <div className="grid-2">
        <div className="stack">
          {seasonOver ? (
            <SeasonOver world={world} game={game} />
          ) : world.clientIds.length === 0 ? (
            <section className="panel">
              <h2>No clients</h2>
              <p>Your agency has no one to manage. Head to Scouting to find players and sign them.</p>
              <div className="btn-row">
                <button className="btn btn-primary" onClick={() => go("scouting")}>Find players</button>
                <button className="btn" onClick={() => void game.play({})}>Skip a week</button>
              </div>
            </section>
          ) : (
            <ThisWeek world={world} game={game} week={week} />
          )}
          {last && <LastWeek world={world} report={last} go={go} />}
        </div>
        <div className="stack">
          <CardRace world={world} />
          <section className="panel">
            <div className="panel-head"><h2>News</h2></div>
            {world.news.length === 0 ? (
              <p className="empty">The season hasn't started yet.</p>
            ) : (
              <ul className="news">
                {world.news.slice(0, 12).map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/**
 * The top of the dashboard: this week's main event over its course photo,
 * which of your clients are in it, and the button that plays the week.
 */
function WeekHero({ world, game, week }: { world: World; game: Game; week: WeekChoices }) {
  const weeks = seasonWeeks(world);
  const a = world.agency;
  if (world.week > weeks) {
    return (
      <section className="hero">
        <div className="hero-body">
          <div className="hero-kicker">{a.name} · Season {world.season}</div>
          <h1 className="hero-title">The season is over</h1>
          <div className="hero-meta">Close it to hand out cards, settle contracts and see how your agency did.</div>
        </div>
        <button className="btn btn-primary hero-play" onClick={() => void game.closeSeason()}>Close the season <span aria-hidden>▸</span></button>
      </section>
    );
  }
  const events = eventsInWeek(world);
  const main = events[0];
  if (!main) return null;
  const course = courseById(world, main.courseId);
  const photo = course.info?.photo;
  // Where each client is headed with the choices made so far ("his call" = his own pick).
  const going = (eventId: string) =>
    world.clientIds.filter((id) => {
      const c = week.choices[id] ?? { kind: "auto" };
      return c.kind === "enter" ? c.eventId === eventId : c.kind === "auto" && clientPreference(world, id) === eventId;
    });
  const here = going(main.id).map((id) => world.players[id]!.player.name);
  const play = () => {
    void game.play(week.choices, 1);
    week.setChoices(() => ({}));
  };
  return (
    <section className={`hero${photo ? " hero-photo" : ""}`} style={photo ? { backgroundImage: `url(${import.meta.env.BASE_URL}${photo.file})` } : undefined}>
      <div className="hero-body">
        <div className="hero-kicker">{a.name} · Week {world.week} of {weeks}</div>
        <h1 className="hero-title">{main.name}</h1>
        <div className="hero-meta">
          <span>{TIER_LABELS[main.tier]}</span>
          <span>{course.name}{course.info ? `, ${course.info.city}` : ""}</span>
          <span>par {coursePar(course)}, {courseYards(course).toLocaleString("en-US")} yds</span>
          <span>Purse {millions(main.purse)}</span>
        </div>
        <div className="hero-clients">
          {world.clientIds.length === 0
            ? "You have no clients yet"
            : here.length === 0
              ? "None of your clients is in this event"
              : `${here.join(", ")} ${here.length === 1 ? "is" : "are"} in the field`}
          {events.length > 1 && <span className="hero-also"> · also this week: {events.slice(1).map((e) => e.name).join(", ")}</span>}
        </div>
      </div>
      <button className="btn btn-primary hero-play" onClick={play}>Play week {world.week} <span aria-hidden>▸</span></button>
      {photo && <div className="hero-credit">Photo: <a href={photo.page} target="_blank" rel="noreferrer">{photo.artist || "Wikimedia Commons"}</a>, {photo.license}</div>}
    </section>
  );
}

function AgencyStrip({ world }: { world: World }) {
  const a = world.agency;
  const season = a.ledger.prizeCommission + a.ledger.endorsementCommission - a.ledger.office - a.ledger.scouts;
  return (
    <section className="panel agency-strip">
      <div className="stat-row">
        <div className="stat" style={{ minWidth: 140 }}>
          <span className="stat-label">Reputation</span>
          <span className="stat-value">{Math.round(a.reputation)}</span>
          <div className="meter" aria-hidden><span style={{ width: `${a.reputation}%` }} /></div>
        </div>
        <div className="stat">
          <span className="stat-label">Clients</span>
          <span className="stat-value">{world.clientIds.length} / {rosterLimit(a.reputation)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Bank</span>
          <span className="stat-value">{money(a.bank)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Season profit</span>
          <span className={`stat-value ${season >= 0 ? "good-text" : "bad-text"}`}>{season < 0 ? `−${money(-season)}` : money(season)}</span>
        </div>
      </div>
    </section>
  );
}

function Alerts({ world, go }: { world: World; go: Go }) {
  const items: { text: string; tab: "agency" | "training"; tone: string }[] = [];
  for (const id of world.clientIds) {
    const wp = world.players[id]!;
    const m = wp.client!;
    if (m.contract.untilSeason <= world.season) items.push({ text: `${wp.player.name}'s contract ends this season. Extend it or he leaves.`, tab: "agency", tone: "var(--critical)" });
    if (m.offers.length) items.push({ text: `${wp.player.name} has ${m.offers.length} sponsor offer${m.offers.length === 1 ? "" : "s"} waiting.`, tab: "agency", tone: "var(--good)" });
    if (m.happiness < 40) items.push({ text: `${wp.player.name} is unhappy (${Math.round(m.happiness)}).`, tab: "agency", tone: "var(--serious)" });
  }
  if (items.length === 0) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Needs your attention</h2></div>
      <ul className="news">
        {items.map((it, i) => (
          <li key={i} className="access" style={{ color: "var(--text)" }}>
            <span className="dot" style={{ background: it.tone }} aria-hidden />
            <span>{it.text} <button className="linkish" onClick={() => go(it.tab)}>Open</button></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ThisWeek({ world, game, week }: { world: World; game: Game; week: WeekChoices }) {
  const { choices, setChoices } = week;
  const remaining = seasonWeeks(world) - world.week + 1;
  const set = (id: string, c: ClientChoice) => setChoices((x) => ({ ...x, [id]: c }));
  const play = (weeks: number) => {
    void game.play(choices, weeks);
    setChoices(() => ({}));
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Week {world.week}: where does everyone play?</h2>
        <span className="muted small">{remaining} weeks left</span>
      </div>
      {world.clientIds.map((id) => (
        <ClientWeek key={`${id}-${world.week}`} world={world} game={game} id={id} choice={choices[id] ?? { kind: "auto" }} onChoose={(c) => set(id, c)} />
      ))}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn-primary" onClick={() => play(1)}>Play week {world.week}</button>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => play(Math.min(4, remaining))} title="Your clients pick their own schedules after this week">Auto 4 weeks</button>
        <button className="btn" onClick={() => play(remaining)} title="Your clients pick their own schedules after this week">Auto to season end</button>
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>
        "His call" lets a client choose for himself. Overrule him and keep him out of a major or signature event he's in, and he won't be happy.
      </p>
    </section>
  );
}

function ClientWeek({ world, game, id, choice, onChoose }: { world: World; game: Game; id: string; choice: ClientChoice; onChoose: (c: ClientChoice) => void }) {
  const wp = world.players[id]!;
  const options = clientOptions(world, id);
  const pref = clientPreference(world, id);
  const prefName = pref ? world.schedule.find((e) => e.id === pref)?.name : null;
  const sel = (c: ClientChoice) => JSON.stringify(c) === JSON.stringify(choice);
  return (
    <article className="event-card">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ fontSize: 16 }}>{wp.player.name}</h2>
          <div className="secondary small">
            {STATUS_LABELS[wp.career.status]} · condition {Math.round(wp.player.condition)}% · form {formWord(wp.player.form).toLowerCase()}
            {wp.injury ? ` · injured (${wp.injury.weeksLeft} wk)` : ""}
          </div>
        </div>
      </div>
      {wp.career.status === "amateur" && (
        <div className="access">
          <span className="dot" style={{ background: "var(--pos)" }} aria-hidden />
          <span>
            Amateur: playing college golf, and developing every week. He must turn pro by {PRO_AGE}; as a pro he starts on the developmental tour.{" "}
            <button className="linkish" onClick={() => confirm(`Turn ${wp.player.name} professional now?`) && game.act((w) => game.lib.turnPro(w, id))}>Turn pro now</button>
          </span>
        </div>
      )}
      <div className="choice-list" role="radiogroup" aria-label={`${wp.player.name}'s week`}>
        <button className="choice" role="radio" aria-checked={sel({ kind: "auto" })} onClick={() => onChoose({ kind: "auto" })}>
          <strong>His call</strong>
          <span className="secondary small">{wp.injury ? "He's injured." : prefName ? `He'd play ${prefName}.` : "He'd rest."}</span>
        </button>
        {options.map((o) => <EventChoice key={o.event.id} o={o} checked={sel({ kind: "enter", eventId: o.event.id })} onChoose={() => onChoose({ kind: "enter", eventId: o.event.id })} />)}
        <button className="choice" role="radio" aria-checked={sel({ kind: "rest" })} onClick={() => onChoose({ kind: "rest" })}>
          <strong>Rest</strong>
          <span className="secondary small">Recover condition.</span>
        </button>
      </div>
    </article>
  );
}

function EventChoice({ o, checked, onChoose }: { o: EntryOption; checked: boolean; onChoose: () => void }) {
  const e = o.event;
  const fit = fitWord(o.fit);
  const disabled = o.access === "not-invited" || o.access === "injured";
  return (
    <button className="choice" role="radio" aria-checked={checked} disabled={disabled} onClick={onChoose}>
      <span className="event-title" style={{ gap: 6 }}>
        <span className={`badge${e.tier === "major" ? " badge-major" : ""}`}>{TIER_LABELS[e.tier]}</span>
        <strong>{e.name}</strong>
      </span>
      <span className="secondary small">
        {o.course.name} ({o.course.style}), par {coursePar(o.course)}, {courseYards(o.course).toLocaleString("en-US")} yds · {REGION_NAMES[e.region]} · {millions(e.purse)}
      </span>
      <span className="access small">
        <span className="dot" style={{ background: ACCESS_TONE[o.access] }} aria-hidden />
        <span>{o.detail}</span>
      </span>
      <span className="access small">
        <span className="dot" style={{ background: fit.tone === "good" ? "var(--good)" : fit.tone === "bad" ? "var(--serious)" : "var(--muted)" }} aria-hidden />
        <span>{fit.label} ({signed(o.fit, 2)}/round)</span>
      </span>
    </button>
  );
}

function LastWeek({ world, report, go }: { world: World; report: Game["state"]["reports"][number]; go: Go }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>Week {report.week} results</h2></div>
      <ul className="news">
        {Object.entries(report.clients).map(([id, r]) => (
          <li key={id} style={{ color: "var(--text)" }}>
            {r.summary}{" "}
            {r.record && <button className="linkish" onClick={() => go("tournament", r.record!.eventId)}>Leaderboard</button>}
          </li>
        ))}
        {report.results.map((r) => (
          <li key={r.event.id}>
            {r.result.leaderboard[0]!.player.name} won {r.event.name}.{" "}
            <button className="linkish" onClick={() => go("tournament", r.event.id)}>Leaderboard</button>
          </li>
        ))}
      </ul>
      {world.clientIds.length === 0 && null}
    </section>
  );
}

function SeasonOver({ world, game }: { world: World; game: Game }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>Season {world.season} is over</h2></div>
      <p style={{ marginTop: 0 }}>The Tour Championship is done. Close the season to hand out cards, settle contracts and see how your agency did.</p>
      <button className="btn btn-primary" onClick={() => void game.closeSeason()}>Close the season</button>
    </section>
  );
}

function CardRace({ world }: { world: World }) {
  const list = pointsList(world);
  const pts = (i: number) => (list[i] ? world.players[list[i]!]!.career.seasonPoints : 0);
  const line = list.length >= FULL_CARD && pts(FULL_CARD - 1) > 0 ? pts(FULL_CARD - 1) : null;
  if (world.clientIds.length === 0) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Card race</h2><span className="muted small">Top {FULL_CARD} keep their card</span></div>
      <table>
        <thead><tr><th>Client</th><th className="num">Rank</th><th className="num">Points</th><th className="num">vs {FULL_CARD}th</th></tr></thead>
        <tbody>
          {world.clientIds.map((id) => {
            const wp = world.players[id]!;
            const r = list.indexOf(id);
            const gap = line === null || r < 0 ? null : wp.career.seasonPoints - line;
            return (
              <tr key={id}>
                <td>{wp.player.name}</td>
                <td className="num">{r >= 0 ? `#${r + 1}` : "—"}</td>
                <td className="num">{Math.round(wp.career.seasonPoints)}</td>
                <td className={`num ${gap === null ? "" : gap >= 0 ? "good-text" : "bad-text"}`}>{gap === null ? "—" : `${gap >= 0 ? "+" : "−"}${Math.round(Math.abs(gap))}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
