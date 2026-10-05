import { Fragment, useState } from "react";
import { coursePar, courseYards, familiarityLabel } from "../../engine";
import { ChallengeBanner } from "../components/Challenge";
import { ShotOfTheWeek } from "../components/Highlights";
import { InboxPanel } from "../components/Inbox";
import {
  agencyProfit,
  FULL_CARD,
  REGION_NAMES,
  seasonWeeks,
  PRO_AGE,
  STATUS_LABELS,
  clientOptions,
  clientPreference,
  courseById,
  ACTIVITIES,
  EVENT_WEEK_ACTIVITIES,
  OFF_WEEK_ACTIVITIES,
  count,
  familiarityAfterPractice,
  fitPlan,
  planCost,
  trainingBoost,
  travelMode,
  weekDays,
  type DayActivity,
  afterPracticeTrip,
  familiarityWith,
  practiceCourses,
  practiceTripCost,
  PRACTICE_TRIP_FATIGUE,
  eventsInWeek,
  pointsList,
  rosterLimit,
  type ClientChoice,
  type ClientChoices,
  type EntryOption,
  type World,
  absWeek,
} from "../../season";
import { TIER_LABELS, fitWord, formWord, millions, money, signed } from "../format";
import type { Go } from "../nav";
import { GoalsPanel } from "../components/Goals";
import { loadTempo, saveTempo, type Game, type WeekTempo } from "../useGame";
import { RoundPlanPicker, TEMPO_LABELS } from "../components/WeekTempo";
import { TournamentEmblem } from "../components/TournamentLogo";
import { PlayerName } from "../components/PlayerLink";

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

/** A concrete visible choice for clients whose week has not been edited yet. */
function defaultWeekChoice(world: World, id: string): ClientChoice {
  const wp = world.players[id]!;
  if (wp.injury) return { kind: "rest" };
  const options = clientOptions(world, id).filter((o) => o.access !== "not-invited" && o.access !== "injured");
  const preferredId = clientPreference(world, id);
  const event = options.find((o) => o.event.id === preferredId) ?? options[0];
  return event ? { kind: "enter", eventId: event.event.id } : { kind: "rest" };
}

export function Home({ world, game, go, week }: { world: World; game: Game; go: Go; week: WeekChoices }) {
  const seasonOver = world.week > seasonWeeks(world);
  const last = game.state.reports[game.state.reports.length - 1];
  return (
    <main>
      <WeekHero world={world} game={game} week={week} />
      <AgencyStrip world={world} />
      <Alerts world={world} go={go} />
      <ChallengeBanner world={world} />
      <InboxPanel world={world} game={game} />
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
          <ShotOfTheWeek world={world} />
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
          <GoalsPanel world={world} game={game} />
        </div>
      </div>
    </main>
  );
}

/** The top of the dashboard: this week's main event and which clients are in it. */
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
  // Where each client is headed with the choices made so far ("his call" = his own pick).
  const going = (eventId: string) =>
    world.clientIds.filter((id) => {
      const c = week.choices[id] ?? defaultWeekChoice(world, id);
      return c.kind === "enter" && c.eventId === eventId;
    });
  const here = going(main.id);
  return (
    <section className="hero">
      <div className="hero-logo"><TournamentEmblem event={main} course={course} size={84} /></div>
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
              : <>{here.map((id, i) => <Fragment key={id}>{i ? ", " : ""}<PlayerName id={id}>{world.players[id]!.player.name}</PlayerName></Fragment>)} {here.length === 1 ? "is" : "are"} in the field</>}
          {events.length > 1 && <span className="hero-also"> · also this week: {events.slice(1).map((e) => e.name).join(", ")}</span>}
        </div>
      </div>
    </section>
  );
}

function AgencyStrip({ world }: { world: World }) {
  const a = world.agency;
  const season = agencyProfit(a.ledger);
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
          <span className="stat-value">{world.clientIds.length} / {rosterLimit(a.reputation, a.hq)}</span>
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
  // Each line follows the client's name, which links to his page.
  const items: { id: string; text: string; tab: "agency" | "training"; tone: string }[] = [];
  for (const id of world.clientIds) {
    const wp = world.players[id]!;
    const m = wp.client!;
    if (m.contract.untilSeason <= world.season) items.push({ id, text: `'s contract ends this season. Extend it or he leaves.`, tab: "agency", tone: "var(--critical)" });
    if (m.offers.length) {
      const left = Math.min(...m.offers.map((x) => x.expiresAbsWeek)) - absWeek(world.season, world.week);
      items.push({ id, text: ` has ${m.offers.length} sponsor offer${m.offers.length === 1 ? "" : "s"} waiting (the first lapses ${left <= 0 ? "this week" : `in ${left} week${left === 1 ? "" : "s"}`}).`, tab: "agency", tone: "var(--good)" });
    }
    if (m.happiness < 40) items.push({ id, text: ` is unhappy (${Math.round(m.happiness)}).`, tab: "agency", tone: "var(--serious)" });
  }
  if (items.length === 0) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Needs your attention</h2></div>
      <ul className="news">
        {items.map((it, i) => (
          <li key={i} className="access" style={{ color: "var(--text)" }}>
            <span className="dot" style={{ background: it.tone }} aria-hidden />
            <span><PlayerName id={it.id}>{world.players[it.id]!.player.name}</PlayerName>{it.text} <button className="linkish" onClick={() => go(it.tab)}>Open</button></span>
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
    const concrete = Object.fromEntries(world.clientIds.map((id) => [id, choices[id] ?? defaultWeekChoice(world, id)]));
    void game.play(concrete, weeks, weeks === 1 ? tempo : "quick");
    setChoices(() => ({}));
  };
  const [tempo, setTempo] = useState<WeekTempo>(loadTempo);
  const pickTempo = (t: WeekTempo) => {
    setTempo(t);
    saveTempo(t);
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Week {world.week}: where does everyone play?</h2>
        <span className="muted small">{remaining} weeks left</span>
      </div>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={() => play(1)}>Play week {world.week}</button>
        <div className="tabs tempo-tabs" role="radiogroup" aria-label="How to play the week">
          {(Object.keys(TEMPO_LABELS) as WeekTempo[]).map((k) => (
            <button key={k} role="radio" aria-checked={tempo === k} aria-selected={tempo === k} title={TEMPO_LABELS[k].blurb} onClick={() => pickTempo(k)}>
              {TEMPO_LABELS[k].label}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => play(Math.min(4, remaining))} title="Your clients pick their own schedules after this week">Auto 4 weeks</button>
        <button className="btn" onClick={() => play(remaining)} title="Your clients pick their own schedules after this week">Auto to season end</button>
      </div>
      <div className="week-round-plans" aria-label="Round plans">
        {world.clientIds.map((id) => {
          const wp = world.players[id]!;
          return <div key={id}><strong><PlayerName id={id}>{wp.player.name}</PlayerName></strong><RoundPlanPicker plan={wp.client!.roundPlan ?? "steady"} onPick={(p) => game.act((w) => (w.players[id]!.client!.roundPlan = p))} /></div>;
        })}
      </div>
      {world.clientIds.map((id) => (
        <ClientWeek key={`${id}-${world.week}`} world={world} game={game} id={id} choice={choices[id] ?? defaultWeekChoice(world, id)} onChoose={(c) => set(id, c)} />
      ))}
    </section>
  );
}

function ClientWeek({ world, game, id, choice, onChoose }: { world: World; game: Game; id: string; choice: ClientChoice; onChoose: (c: ClientChoice) => void }) {
  const wp = world.players[id]!;
  const options = clientOptions(world, id);
  const sel = (c: ClientChoice) => JSON.stringify(c) === JSON.stringify(choice);
  const entered = choice.kind === "enter" ? options.find((o) => o.event.id === choice.eventId) : undefined;
  const courses = practiceCourses(world);
  const tripCourse = choice.kind === "practice" ? choice.courseId : (courses.find((c) => c.next && world.schedule.some((e) => e.courseId === c.courseId && e.tier === "major" && e.week > world.week)) ?? courses[0])?.courseId;
  return (
    <article className="event-card">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ fontSize: 16 }}><PlayerName id={id}>{wp.player.name}</PlayerName></h2>
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
      <div className="choice-list schedule-choice-list" role="radiogroup" aria-label={`${wp.player.name}'s week`}>
        {options.map((o) => <EventChoice key={o.event.id} o={o} checked={choice.kind === "enter" && choice.eventId === o.event.id} onChoose={() => onChoose({ kind: "enter", eventId: o.event.id })} />)}
        <button className="choice schedule-choice" role="radio" aria-checked={sel({ kind: "rest" })} onClick={() => onChoose({ kind: "rest" })}>
          <span className="schedule-choice-head">
            <span className="schedule-choice-logo"><ScheduleChoiceIcon kind="rest" /></span>
            <span className="schedule-choice-title"><span className="schedule-choice-kicker">Recovery</span><strong>Rest week</strong><span className="secondary small">Recover condition from {Math.round(wp.player.condition)}%</span></span>
          </span>
          <span className="schedule-choice-chips"><span className="schedule-chip good">No travel</span><span className="schedule-chip">No entry fees</span></span>
        </button>
        {tripCourse && !wp.injury && wp.career.status !== "amateur" && (
          <button className="choice schedule-choice" role="radio" aria-checked={choice.kind === "practice"} onClick={() => onChoose({ kind: "practice", courseId: tripCourse })}>
            <span className="schedule-choice-head">
              <span className="schedule-choice-logo"><ScheduleChoiceIcon kind="practice" /></span>
              <span className="schedule-choice-title"><span className="schedule-choice-kicker">Preparation</span><strong>Practice trip</strong><span className="secondary small">{courses.find((c) => c.courseId === tripCourse)?.name ?? "Choose a course"}</span></span>
            </span>
            <span className="schedule-choice-chips">
              <span className="schedule-chip good">Familiarity {Math.round(familiarityWith(wp, tripCourse))} → {Math.round(afterPracticeTrip(wp, tripCourse))}</span>
              <span className="schedule-chip warn">−{PRACTICE_TRIP_FATIGUE}% condition</span>
              <span className="schedule-chip">{money(practiceTripCost(world, tripCourse))}</span>
            </span>
          </button>
        )}
      </div>
      {(choice.kind === "enter" || choice.kind === "rest") && (
        <DayPlanner world={world} id={id} choice={choice} entered={entered} onChoose={onChoose} />
      )}
      {choice.kind === "practice" && (
        <div className="practice-toggle small">
          <label>
            <strong>Practise at</strong>{" "}
            <select value={choice.courseId} onChange={(e) => onChoose({ kind: "practice", courseId: e.target.value })}>
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.name}{c.next ? ` (${c.next})` : ""}
                </option>
              ))}
            </select>
          </label>
          <span>
            Familiarity {Math.round(familiarityWith(wp, choice.courseId))} → {Math.round(afterPracticeTrip(wp, choice.courseId))} · −{PRACTICE_TRIP_FATIGUE}% condition against a week's rest · {money(practiceTripCost(world, choice.courseId))}
          </span>
        </div>
      )}
    </article>
  );
}

/** The client's days this week: travel first, then one activity a free day. */
function DayPlanner({ world, id, choice, entered, onChoose }: { world: World; id: string; choice: Extract<ClientChoice, { kind: "enter" | "rest" }>; entered: EntryOption | undefined; onChoose: (c: ClientChoice) => void }) {
  const wp = world.players[id]!;
  const event = choice.kind === "enter" ? entered?.event : undefined;
  if (choice.kind === "enter" && !event) return null;
  const { days, travel } = weekDays(world, wp, event?.region ?? null);
  const allowed = event ? EVENT_WEEK_ACTIVITIES : OFF_WEEK_ACTIVITIES;
  const plan = fitPlan(choice.days ?? (choice.kind === "enter" && choice.practice ? ["practice"] : undefined), days.length - travel, allowed);
  const set = (i: number, a: DayActivity) => {
    const next = [...plan];
    next[i] = a;
    const { practice: _drop, ...rest } = choice as { practice?: boolean };
    void _drop;
    onChoose({ ...(rest as typeof choice), days: next });
  };
  const cost = planCost(plan);
  const practice = count(plan, "practice");
  const boost = trainingBoost(plan);
  return (
    <div className="planner">
      <div className="planner-head small">
        <strong>{event ? `Before ${event.name}` : "His week off"}</strong>
        {travel > 0 && <span className="muted"> · {travel} travel day{travel === 1 ? "" : "s"} ({travelMode(world, wp).label.toLowerCase()})</span>}
      </div>
      <div className="planner-days">
        {days.map((d, i) =>
          i < travel ? (
            <div key={d} className="planner-day travel"><span className="planner-dname">{d}</span><span>✈ Travel</span></div>
          ) : (
            <label key={d} className={`planner-day act-${plan[i - travel]}`}>
              <span className="planner-dname">{d}</span>
              <select value={plan[i - travel]} onChange={(e) => set(i - travel, e.target.value as DayActivity)} aria-label={`${wp.player.name}, ${d}`}>
                {allowed.map((a) => <option key={a} value={a}>{ACTIVITIES[a].short}</option>)}
              </select>
            </label>
          ),
        )}
        {event && <div className="planner-day event"><span className="planner-dname">Thu–Sun</span><span>⛳ {event.name}</span></div>}
      </div>
      <div className="planner-sum small secondary">
        {cost.condition !== 0 && <span>Condition {cost.condition}%</span>}
        {cost.fees > 0 && <span>{money(cost.fees)}</span>}
        {practice > 0 && entered && <span>Familiarity {Math.round(entered.familiarity)} → {Math.round(familiarityAfterPractice(wp, entered.course.id, practice))}{entered.debut ? ", no debut nerves" : ""}</span>}
        {boost.training > 1 && <span>Training +{Math.round((boost.training - 1) * 100)}%</span>}
        {boost.fitness > 1 && <span>Fitness +{Math.round((boost.fitness - 1) * 100)}%</span>}
        {count(plan, "sponsor") > 0 && <span>Sponsor goodwill</span>}
        {count(plan, "media") > 0 && <span>Agency profile</span>}
        {cost.condition === 0 && cost.fees === 0 && !count(plan, "media") && <span>All rest: nothing gained, nothing spent.</span>}
      </div>
    </div>
  );
}

function EventChoice({ o, checked, onChoose }: { o: EntryOption; checked: boolean; onChoose: () => void }) {
  const e = o.event;
  const fit = fitWord(o.fit);
  const disabled = o.access === "not-invited" || o.access === "injured";
  return (
    <button className="choice schedule-choice" role="radio" aria-checked={checked} disabled={disabled} onClick={onChoose}>
      <span className="schedule-choice-head">
        <span className="schedule-choice-logo"><TournamentEmblem event={e} course={o.course} size={64} /></span>
        <span className="schedule-choice-title">
          <span className="schedule-choice-kicker">{e.devFinals ? `Dev Finals ${e.devFinals}/4` : TIER_LABELS[e.tier]}</span>
          <strong>{e.name}</strong>
          <span className="secondary small">{o.course.name}{o.course.info ? `, ${o.course.info.city}` : ""}</span>
        </span>
      </span>
      <span className="schedule-choice-details secondary small">
        <span>{o.course.style} · par {coursePar(o.course)} · {courseYards(o.course).toLocaleString("en-US")} yds</span>
        <span>{REGION_NAMES[e.region]} · {millions(e.purse)}</span>
      </span>
      <span className="schedule-choice-chips">
        <span className="schedule-chip" style={{ borderColor: ACCESS_TONE[o.access] }}>{o.detail}</span>
        <span className={`schedule-chip ${fit.tone}`}>{fit.label} {signed(o.fit, 2)}/round</span>
        <span className={`schedule-chip ${!o.debut && o.familiarity >= 40 ? "good" : "warn"}`}>{o.debut ? "Course debut" : `${familiarityLabel(o.familiarity)} ${Math.round(o.familiarity)}`}</span>
      </span>
    </button>
  );
}

function ScheduleChoiceIcon({ kind }: { kind: "call" | "rest" | "practice" }) {
  return <span className={`schedule-choice-icon ${kind}`} aria-hidden>{kind === "call" ? "CALL" : kind === "rest" ? "REST" : "PRACT"}</span>;
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
            <PlayerName id={r.result.leaderboard[0]!.player.id}>{r.result.leaderboard[0]!.player.name}</PlayerName> won {r.event.name}.{" "}
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
                <td><PlayerName id={id}>{wp.player.name}</PlayerName></td>
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
