import { useState } from "react";
import { coursePar, courseYards, familiarityLabel } from "../../engine";
import { ChallengeBanner } from "../components/Challenge";
import { ShotOfTheWeek } from "../components/Highlights";
import { InboxPanel } from "../components/Inbox";
import {
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
  buildFields,
  planWeek,
  rankMap,
  pointsList,
  type ClientChoice,
  type ClientChoices,
  type EntryOption,
  type World,
  approachBlock,
  isDiscovered,
  STAFF_ROLES,
  hiredStaffer,
  rosterCount,
  rosterLimit,
} from "../../season";
import { TIER_LABELS, fitWord, formWord, millions, money, signed } from "../format";
import type { Go } from "../nav";
import { GoalsPanel } from "../components/Goals";
import { loadTempo, saveTempo, type Game, type WeekTempo } from "../useGame";
import { RoundPlanPicker, TEMPO_LABELS } from "../components/WeekTempo";
import { TournamentEmblem } from "../components/TournamentLogo";
import { CutoutPortrait } from "../components/Portrait";

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
      <WeekCommandCenter world={world} game={game} go={go} week={week} />
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

const VENUE_BANNERS: Record<string, string> = {
  waialae: "art/week-venues/waialae.png",
  "pga-west-stadium": "art/week-venues/pga-west-stadium.png",
  "torrey-pines-south": "art/week-venues/torrey-pines-south.png",
  "tpc-scottsdale": "art/week-venues/tpc-scottsdale.png",
  "pebble-beach": "art/week-venues/pebble-beach.png",
  "bay-hill": "art/week-venues/bay-hill.webp",
  "pga-national-champion": "art/week-venues/pga-national-champion.webp",
  riviera: "art/week-venues/riviera.webp",
  "augusta-national": "art/week-venues/augusta-national.webp",
  "innisbrook-copperhead": "art/week-venues/innisbrook-copperhead.webp",
  "barton-creek-fazio-canyons": "art/week-venues/barton-creek-fazio-canyons.webp",
  "tpc-san-antonio-oaks": "art/week-venues/tpc-san-antonio-oaks.webp",
};

const DECISION_ART = {
  amateurs: ["recruit-amateurs-a.png", "recruit-amateurs-b.png", "recruit-amateurs-c.png"],
  pros: ["recruit-pros-a.png", "recruit-pros-b.png", "recruit-pros-c.png"],
  sponsor: ["sponsor-expiring-a.png", "sponsor-expiring-b.png", "sponsor-expiring-c.png"],
  extension: ["extension-talks-a.png", "extension-talks-b.png", "extension-talks-c.png"],
  plans: ["round-plans-a.png", "round-plans-b.png", "round-plans-c.png"],
  condition: ["player-condition-a.png", "player-condition-b.png", "player-condition-c.png"],
  staff: ["open-staff-a.png", "open-staff-b.png", "open-staff-c.png"],
} as const;
const decisionArtUrl = (file: string) => `art/week-decisions/options/${file}`;

function MastheadFact({ kind, label, value, note }: { kind: "purse" | "weather" | "course"; label: string; value: string; note?: string }) {
  const icon = kind === "purse"
    ? <><path d="M7 3h10v5a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 13v4M8 20h8" /></>
    : kind === "weather"
      ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>
      : <><path d="M7 21V3M7 4l10 4-10 4M4 21h16" /><ellipse cx="15" cy="18" rx="4" ry="2" /></>;
  return <div className="week-event-fact"><span><svg viewBox="0 0 24 24" aria-hidden>{icon}</svg></span><div><small>{label}</small><strong>{value}</strong>{note && <em>{note}</em>}</div></div>;
}

/** The week's event, strongest entrants and seven decisions that must be cleared. */
function WeekCommandCenter({ world, game, go, week }: { world: World; game: Game; go: Go; week: WeekChoices }) {
  // Hold one option while this page is open; leaving and returning mounts a fresh set.
  const [artFrame] = useState(() => Math.floor(Math.random() * 3));
  // Cards you've opened this week, remembered until the week is played (this browser only).
  const visitKey = `fm-visited-${world.seed}-${world.season}-${world.week}`;
  const [visited, setVisited] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(visitKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const visit = (key: string) => {
    if (visited.includes(key)) return;
    const next = [...visited, key];
    setVisited(next);
    try {
      localStorage.setItem(visitKey, JSON.stringify(next));
    } catch {
      // Not remembered; the card still shows as reviewed until the page is left.
    }
  };
  const weeks = seasonWeeks(world);
  if (world.week > weeks) {
    return <section className="hero week-command-season-over"><div className="hero-body"><div className="hero-kicker">{world.agency.name} · Season {world.season}</div><h1 className="hero-title">The season is over</h1><div className="hero-meta">Close it to hand out cards, settle contracts and see how your agency did.</div></div><button className="btn btn-primary hero-play" onClick={() => void game.closeSeason()}>Close the season <span aria-hidden>▸</span></button></section>;
  }
  const events = eventsInWeek(world);
  const main = events[0];
  if (!main) return null;
  const course = courseById(world, main.courseId);
  const field = buildFields(world, planWeek(world, new Map())).find((x) => x.event.id === main.id)?.field ?? [];
  const ranks = rankMap(world);
  const featured = field.map((id) => world.players[id]!).filter(Boolean).sort((x, y) => (ranks.get(x.player.id) ?? 9999) - (ranks.get(y.player.id) ?? 9999)).slice(0, 4);
  // Players you could approach this week: known to the agency, not a client, and with nothing blocking the approach.
  // Players you could approach if you had room: known to the agency, not a client, and nothing but a full roster in the way.
  const full = rosterCount(world) >= rosterLimit(world.agency.reputation, world.agency.hq);
  const approachable = (amateur: boolean) => Object.values(world.players).filter((wp) => {
    if (wp.client || (wp.career.status === "amateur") !== amateur || !isDiscovered(world, wp.player.id)) return false;
    const block = approachBlock(world, wp.player.id);
    return !block || (full && block.startsWith("Your agency can manage"));
  }).length;
  const rosterNote = full ? ` · roster full (${rosterCount(world)} of ${rosterLimit(world.agency.reputation, world.agency.hq)})` : "";
  const amateurs = approachable(true);
  const pros = approachable(false);
  const offers = world.clientIds.reduce((sum, id) => sum + world.players[id]!.client!.offers.length, 0);
  const expiring = world.clientIds.filter((id) => world.players[id]!.client!.contract.untilSeason <= world.season).length;
  const tired = world.clientIds.filter((id) => world.players[id]!.player.condition < 80).length;
  const staffOpen = STAFF_ROLES.filter((role) => !hiredStaffer(world, role)).length;
  const scrollPlans = () => document.getElementById("weekly-player-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const playWeek = () => void game.play(Object.fromEntries(world.clientIds.map((id) => [id, week.choices[id] ?? defaultWeekChoice(world, id)])));
  const temperature = 68 + ((world.week * 7 + main.courseId.length) % 13);
  const weather = course.windiness > .62 ? `${temperature}°  Breezy` : course.firmness < .42 ? `${temperature}°  Overcast` : `${temperature}°  Sunny`;
  const decisions = [
    { key: "amateurs", icon: "◉", title: "Recruit amateurs", copy: "Find and evaluate the next generation of talent.", status: `${amateurs} approachable${rosterNote}`, action: "Search amateurs", run: () => go("recruiting") },
    { key: "pros", icon: "♟", title: "Recruit pros", copy: "Identify professionals who may be open to representation.", status: `${pros} approachable${rosterNote}`, action: "View prospects", run: () => { try { sessionStorage.setItem("fm-scouting-status", "pros"); } catch { /* the list just opens unfiltered */ } go("scouting"); setTimeout(() => document.getElementById("player-reports")?.scrollIntoView({ block: "start" }), 60); } },
    { key: "sponsor", icon: "◆", title: "Sponsor deal expiring", copy: "Review offers before the commercial window closes.", status: offers ? `${offers} offer${offers === 1 ? "" : "s"} waiting` : "No offers waiting", action: "Review deals", run: () => go("partnerships"), urgent: offers > 0 },
    { key: "extension", icon: "▤", title: "Extension talks", copy: "Discuss contract extensions with eligible clients.", status: `${expiring} contract${expiring === 1 ? "" : "s"} end this season`, action: "Open talks", run: () => go("agency") },
    { key: "plans", icon: "⚑", title: "Round plans", copy: "Set the approach each client takes into this week's event.", status: `${world.clientIds.length} client${world.clientIds.length === 1 ? "" : "s"} to review`, action: "Set plans", run: scrollPlans },
    { key: "condition", icon: "♥", title: "Player condition", copy: "Check fitness, fatigue and training before travel.", status: `${world.clientIds.length - tired} good · ${tired} tired`, action: "Review players", run: () => go("training") },
    { key: "staff", icon: "♜", title: "Open staff spots", copy: "Strengthen the team around your clients.", status: staffOpen ? `${staffOpen} role${staffOpen === 1 ? "" : "s"} open` : "Every role filled", action: "Hire staff", run: () => go("hq") },
  ] as const;
  // Done: nothing left to act on this week. Reviewed: you've opened it. Either counts toward the ring.
  const done: Partial<Record<(typeof decisions)[number]["key"], boolean>> = { sponsor: offers === 0, extension: expiring === 0, condition: tired === 0, staff: staffOpen === 0 };
  const stateOf = (key: (typeof decisions)[number]["key"]): "done" | "visited" | "" => (done[key] ? "done" : visited.includes(key) ? "visited" : "");
  const clear = decisions.filter((d) => stateOf(d.key)).length;
  return <section className="week-command-center">
    <div className="week-event-masthead">
      <img src={VENUE_BANNERS[main.courseId] ?? "art/player-command/hero.png"} alt={`Illustrated view of ${course.name}`} />
      <div className="week-event-shade" />
      <div className="week-event-copy"><span>Week {world.week} of {weeks} · {TIER_LABELS[main.tier]}</span><h1>{main.name}</h1><p>{course.name}{course.info ? ` · ${course.info.city}` : ""}</p></div>
      <div className="week-event-facts"><MastheadFact kind="purse" label="Purse" value={money(main.purse)} /><MastheadFact kind="weather" label="Weather" value={weather} /><MastheadFact kind="course" label="Course" value={course.name} note={`Par ${coursePar(course)} · ${courseYards(course).toLocaleString("en-US")} yds`} /></div>
      <div className="week-featured-field"><small>Top players in the field</small><div>{featured.map((wp) => <article key={wp.player.id}><CutoutPortrait player={wp.player} height={190} title={wp.player.name} /><b>#{ranks.get(wp.player.id) ?? "—"}</b><span>{wp.player.name}</span></article>)}</div></div>
      <div className="week-event-actions"><div className="week-ready"><strong>{clear} of 7</strong><span>ready</span></div><button className="btn btn-primary" onClick={playWeek}>Play week {world.week} <span aria-hidden>›</span></button></div>
    </div>
    <div className="week-decisions-heading"><div><span>WEEKLY COMMAND CENTER</span><h2>Seven decisions before Thursday</h2><p>Clear the board, then play the week.</p></div></div>
    <div className="week-decision-grid">{decisions.map((d, index) => {
      const images = DECISION_ART[d.key];
      const image = images[(artFrame + index) % images.length]!;
      const state = stateOf(d.key);
      return <article className={`week-decision-card ${"urgent" in d && d.urgent && !state ? "urgent" : ""} ${state}`} key={d.key}>{state && <span className="week-decision-check">{state === "done" ? "✓ Done" : "✓ Reviewed"}</span>}<img key={image} className="week-decision-rotating-art" src={decisionArtUrl(image)} alt="" /><div className="week-decision-copy"><span className="week-decision-icon">{d.icon}</span><h3>{d.title}</h3><p>{d.copy}</p><strong>{d.status}</strong><button className="btn btn-primary" onClick={() => { visit(d.key); d.run(); }}>{d.action} <span aria-hidden>›</span></button></div></article>;
    })}</div>
    <div className="week-complete-strip"><strong>Completed this week — {clear}</strong><span>✓ Decisions already clear stay out of your way.</span></div>
  </section>;
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
    <section className="panel" id="weekly-player-plans">
      <div className="panel-head">
        <h2>Week {world.week}: where does everyone play?</h2>
        <span className="muted small">{remaining} weeks left</span>
      </div>
      <div className="week-round-plans" aria-label="Round plans">
        {world.clientIds.map((id) => {
          const wp = world.players[id]!;
          return <div key={id}><strong>{wp.player.name}</strong><RoundPlanPicker plan={wp.client!.roundPlan ?? "steady"} onPick={(p) => game.act((w) => (w.players[id]!.client!.roundPlan = p))} /></div>;
        })}
      </div>
      <WeekEvents world={world} />
      {world.clientIds.map((id) => (
        <ClientWeek key={`${id}-${world.week}`} world={world} game={game} id={id} choice={choices[id] ?? defaultWeekChoice(world, id)} onChoose={(c) => set(id, c)} />
      ))}
      <div className="btn-row" style={{ marginTop: 14 }}>
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
    </section>
  );
}

/** This week's events, shown once above the clients instead of on every client's card. */
function WeekEvents({ world }: { world: World }) {
  const seen = new Map<string, EntryOption>();
  for (const id of world.clientIds) {
    for (const o of clientOptions(world, id)) if (playable(o) && !seen.has(o.event.id)) seen.set(o.event.id, o);
  }
  if (seen.size === 0) return null;
  return (
    <div className="week-events">
      {[...seen.values()].map((o) => (
        <div key={o.event.id} className="week-event">
          <TournamentEmblem event={o.event} course={o.course} size={48} />
          <div className="week-event-text">
            <span className="schedule-choice-kicker">{o.event.devFinals ? `Dev Finals ${o.event.devFinals}/4` : TIER_LABELS[o.event.tier]}</span>
            <strong>{o.event.name}</strong>
            <span className="secondary small">
              {o.course.name}{o.course.info ? `, ${o.course.info.city}` : ""} · {o.course.style} · par {coursePar(o.course)} · {courseYards(o.course).toLocaleString("en-US")} yds · {REGION_NAMES[o.event.region]} · {millions(o.event.purse)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** An event he can actually play this week: not a tour he isn't on, and not while injured. */
const playable = (o: EntryOption): boolean => o.access !== "not-invited" && o.access !== "injured";

/** One client's week as a single row: his choice, what it means, and his days in one line. */
function ClientWeek({ world, game, id, choice, onChoose }: { world: World; game: Game; id: string; choice: ClientChoice; onChoose: (c: ClientChoice) => void }) {
  const wp = world.players[id]!;
  const options = clientOptions(world, id);
  const events = options.filter(playable);
  const entered = choice.kind === "enter" ? options.find((o) => o.event.id === choice.eventId) : undefined;
  const courses = practiceCourses(world);
  const tripCourse = choice.kind === "practice" ? choice.courseId : (courses.find((c) => c.next && world.schedule.some((e) => e.courseId === c.courseId && e.tier === "major" && e.week > world.week)) ?? courses[0])?.courseId;
  const canPractice = !!tripCourse && !wp.injury && wp.career.status !== "amateur";
  const [showDays, setShowDays] = useState(false);
  const fit = entered ? fitWord(entered.fit) : null;
  return (
    <article className="client-week">
      <div className="client-week-head">
        <div className="client-week-who">
          <strong>{wp.player.name}</strong>
          <span className="secondary small">
            {STATUS_LABELS[wp.career.status]} · condition {Math.round(wp.player.condition)}% · form {formWord(wp.player.form).toLowerCase()}
            {wp.injury ? ` · injured (${wp.injury.weeksLeft} wk)` : ""}
          </span>
        </div>
        <div className="client-week-picks" role="radiogroup" aria-label={`${wp.player.name}'s week`}>
          {events.map((o) => (
            <button key={o.event.id} className="week-pick" role="radio" aria-checked={choice.kind === "enter" && choice.eventId === o.event.id} onClick={() => onChoose({ kind: "enter", eventId: o.event.id })}>
              ⛳ {o.event.name}
            </button>
          ))}
          {canPractice && (
            <button className="week-pick" role="radio" aria-checked={choice.kind === "practice"} onClick={() => onChoose({ kind: "practice", courseId: tripCourse! })}>
              Practice trip
            </button>
          )}
          <button className="week-pick" role="radio" aria-checked={choice.kind === "rest"} onClick={() => onChoose({ kind: "rest" })}>
            Rest
          </button>
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
      <div className="schedule-choice-chips client-week-chips">
        {entered && fit && (
          <>
            <span className="schedule-chip" style={{ borderColor: ACCESS_TONE[entered.access] }}>{entered.detail}</span>
            <span className={`schedule-chip ${fit.tone}`}>{fit.label} {signed(entered.fit, 2)}/round</span>
            <span className={`schedule-chip ${!entered.debut && entered.familiarity >= 40 ? "good" : "warn"}`}>{entered.debut ? "Course debut" : `${familiarityLabel(entered.familiarity)} ${Math.round(entered.familiarity)}`}</span>
          </>
        )}
        {choice.kind === "rest" && (
          <>
            <span className="schedule-chip good">Recovers from {Math.round(wp.player.condition)}%</span>
            <span className="schedule-chip">No travel · no entry fees</span>
          </>
        )}
        {choice.kind === "practice" && (
          <>
            <label className="client-week-inline small">
              Practise at{" "}
              <select value={choice.courseId} onChange={(e) => onChoose({ kind: "practice", courseId: e.target.value })}>
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>{c.name}{c.next ? ` (${c.next})` : ""}</option>
                ))}
              </select>
            </label>
            <span className="schedule-chip good">Familiarity {Math.round(familiarityWith(wp, choice.courseId))} → {Math.round(afterPracticeTrip(wp, choice.courseId))}</span>
            <span className="schedule-chip warn">−{PRACTICE_TRIP_FATIGUE}% condition</span>
            <span className="schedule-chip">{money(practiceTripCost(world, choice.courseId))}</span>
            <label className="client-week-inline small">
              <input type="checkbox" checked={!!choice.live} onChange={(e) => onChoose({ ...choice, live: e.target.checked })} /> Play it hole by hole
            </label>
          </>
        )}
      </div>
      {(choice.kind === "enter" || choice.kind === "rest") && (
        <DayPlanner world={world} id={id} choice={choice} entered={entered} onChoose={onChoose} open={showDays} onToggle={() => setShowDays((s) => !s)} />
      )}
    </article>
  );
}

/** The client's days this week: travel first, then one activity a free day. Folded to one line until opened. */
function DayPlanner({ world, id, choice, entered, onChoose, open, onToggle }: { world: World; id: string; choice: Extract<ClientChoice, { kind: "enter" | "rest" }>; entered: EntryOption | undefined; onChoose: (c: ClientChoice) => void; open: boolean; onToggle: () => void }) {
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
  const notes: string[] = [];
  if (cost.condition !== 0) notes.push(`Condition ${cost.condition}%`);
  if (cost.fees > 0) notes.push(money(cost.fees));
  if (practice > 0 && entered) notes.push(`Familiarity ${Math.round(entered.familiarity)} → ${Math.round(familiarityAfterPractice(wp, entered.course.id, practice))}${entered.debut ? ", no debut nerves" : ""}`);
  if (boost.training > 1) notes.push(`Training +${Math.round((boost.training - 1) * 100)}%`);
  if (boost.fitness > 1) notes.push(`Fitness +${Math.round((boost.fitness - 1) * 100)}%`);
  if (count(plan, "sponsor") > 0) notes.push("Sponsor goodwill");
  if (count(plan, "media") > 0) notes.push("Agency profile");
  if (cost.condition === 0 && cost.fees === 0 && !count(plan, "media")) notes.push("All rest: nothing gained, nothing spent");
  const line = [...days.map((d, i) => (i < travel ? `${d} ✈ Travel` : `${d} ${ACTIVITIES[plan[i - travel]!].short}`)), ...(event ? [`Thu–Sun ${event.name}`] : [])].join(" · ");
  if (!open) {
    return (
      <div className="planner-summary small">
        <span className="planner-summary-days">{line}</span>
        <span className="secondary">{notes.join(" · ")}</span>
        <button className="linkish" onClick={onToggle}>Change days</button>
      </div>
    );
  }
  return (
    <div className="planner">
      <div className="planner-head small">
        <strong>{event ? `Before ${event.name}` : "His week off"}</strong>
        {travel > 0 && <span className="muted"> · {travel} travel day{travel === 1 ? "" : "s"} ({travelMode(world, wp).label.toLowerCase()})</span>}
        <button className="linkish" style={{ marginLeft: 10 }} onClick={onToggle}>Done</button>
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
      <div className="planner-sum small secondary">{notes.map((n) => <span key={n}>{n}</span>)}</div>
    </div>
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
