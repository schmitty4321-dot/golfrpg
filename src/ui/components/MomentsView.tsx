import { useEffect, useMemo, useState } from "react";
import {
  answerMoment,
  autoFinishRound,
  callOdds,
  featureHoles,
  clientActive,
  finishLive,
  holeLayout,
  inRound,
  liveBoard,
  liveSnapshot,
  nextMoment,
  pendingPlayoff,
  planCall,
  standingsAfterRound,
  startLiveRound,
  traceHole,
  traceSeed,
  type CallKind,
  type HoleCall,
  type HoleSituation,
  type HoleTrace,
  type LiveTournament,
  type Moment,
  type Course,
  type RoundPlan,
} from "../../engine";
import type { LiveEvent, World } from "../../season";
import { CALLS_PER_ROUND, type Game, type LiveWeek } from "../useGame";
import { toPar } from "../format";
import { useHoleMap } from "../holeMaps";
import { HoleDrawing, ShotSequence } from "./ShotTracer";
import { hasIllustratedTracerArt, IllustratedTracer } from "./IllustratedTracer";
import { PLAN_LABELS, RoundPlanPicker, setRoundPlan, tickerLine } from "./WeekTempo";
import { RoundCalls } from "./RoundCalls";
import { LiveScorecard } from "./LiveScorecard";
import { PlayerName } from "./PlayerLink";

/** A moment you've answered: the hole, played out in the tracer. */
interface Replay {
  id: string;
  name: string;
  round: number;
  index: number;
  trace: HoleTrace;
  courseName: string;
  /** His card for the round so far, hole by hole, and the course to draw it against. */
  scores: number[];
  course: Course;
}

/** A client's hole scores in a round: the round in progress, or a finished one. */
function roundScores(t: LiveTournament, id: string, round: number): number[] {
  const live = t.live[id];
  if (live && t.round === round) return live.holes;
  return t.entries.find((e) => e.player.id === id)?.holes[round - 1] ?? [];
}

/** Where a client stands after the last round played (null before round 1 or once he's out). */
function standing(t: LiveTournament, id: string): { position: number; label: string; back: number } | null {
  if (t.round < 1 || inRound(t) || !clientActive(t, id)) return null;
  const rows = standingsAfterRound(liveSnapshot(t), t.round);
  const r = rows.find((x) => x.player.id === id);
  if (!r) return null;
  return { position: r.position, label: r.positionLabel, back: r.toPar - rows[0]!.toPar };
}

/**
 * The plan your caddie would pick for the next round, and why: protect a
 * place inside the cut line or a lead, attack when he needs birdies, else steady.
 */
export function suggestPlan(t: LiveTournament, id: string): { plan: RoundPlan; why: string } | null {
  const st = standing(t, id);
  if (!st) return null;
  const next = t.round + 1;
  const cutTop = t.config.cutTop;
  if (next === 2 && cutTop !== undefined) {
    if (st.position > cutTop + 5) return { plan: "attack", why: `${st.label} after round 1: he needs birdies to make the cut` };
    if (st.position > cutTop - 15) return { plan: "protect", why: `${st.label}: around the cut line, no big numbers` };
    return { plan: "steady", why: `${st.label}: safely inside the cut line` };
  }
  if (next === 3) {
    if (st.back >= 6 && st.position > 10) return { plan: "attack", why: `${st.back} back at halfway: he needs a move on Saturday` };
    return { plan: "steady", why: `${st.label}, ${st.back <= 0 ? "leading" : `${st.back} back`}` };
  }
  if (next === 4) {
    if (st.back <= -2) return { plan: "protect", why: `Leads by ${-st.back}: make them come to him` };
    if (st.back >= 3 && st.back <= 7) return { plan: "attack", why: `${st.back} back going into Sunday: he has to go and get it` };
    return { plan: "steady", why: st.back <= 2 ? `${st.back <= 0 ? "In the lead" : `${st.back} back`}: play his game` : `${st.label}: a solid finish` };
  }
  return null;
}

/** Whether broadcast mode goes live for the next round: Friday with a client near the cut line, Sunday with one in the top 10. */
function liveWorthy(events: LiveEvent[], next: number): string | null {
  for (const e of events) {
    const t = e.tournament;
    for (const id of e.clientIds) {
      const st = standing(t, id);
      if (!st) continue;
      const cutTop = t.config.cutTop;
      if (next === 2 && cutTop !== undefined && st.position >= cutTop - 15 && st.position <= cutTop + 20) return "a client is around the cut line";
      if (next === 4 && st.position <= 10) return `a client is ${st.label} going into Sunday`;
    }
  }
  return null;
}

const eventDone = (t: LiveTournament) => t.round >= 4 && !inRound(t) && !pendingPlayoff(t).length;
const stillIn = (e: LiveEvent) => e.tournament.round < 2 || e.clientIds.some((id) => clientActive(e.tournament, id));

/** Where he stands, in words: "1 outside the cut line", "2 back", "leads by 1". */
export function stakeWords(s: HoleSituation, playoff = false): string {
  if (playoff) return "Sudden-death playoff";
  if (s.round === 2 && s.cutMargin !== null) return s.cutMargin > 0 ? `${s.cutMargin} inside the cut line` : s.cutMargin === 0 ? "Right on the cut line" : `${-s.cutMargin} outside the cut line`;
  return s.behind < 0 ? `Leads by ${-s.behind}` : s.behind === 0 ? "Tied for the lead" : `${s.behind} back`;
}

/**
 * The week on "key moments": every client's rounds are simulated together,
 * stopping only where a call matters (the cut line on Friday, contention on
 * the weekend, a playoff). Each stop shows the hole and the odds of each
 * call; the hole then plays out in the tracer.
 */
export function MomentsView({ world, game, lw }: { world: World; game: Game; lw: LiveWeek }) {
  const broadcast = lw.mode === "broadcast";
  const [moment, setMoment] = useState<{ ev: number; m: Moment } | null>(null);
  const [calls, setCalls] = useState<HoleCall>({});
  const [replay, setReplay] = useState<Replay | null>(null);
  const [step, setStep] = useState(0);
  const [ticker, setTicker] = useState<string[]>([]);
  // Broadcast, watching live: the board moves on a hole at a time by itself.
  const [watching, setWatching] = useState(false);
  const [paused, setPaused] = useState(false);
  const events = lw.events;
  const round = Math.max(...events.map((e) => e.tournament.round));
  const allDone = events.every((e) => eventDone(e.tournament));
  const playing = events.some((e) => inRound(e.tournament));
  // Broadcast: a few calls a round across all your clients (letting him play it his way is free).
  const callsLeft = broadcast ? Math.max(0, CALLS_PER_ROUND - (lw.callsUsed?.[round] ?? 0)) : Infinity;
  const nextRound = round + 1;
  const goLive = broadcast && !playing && !allDone ? liveWorthy(events, nextRound) : null;

  // Watching a round: every couple of seconds each client plays his next hole, until a moment or the end of the round.
  useEffect(() => {
    if (!watching || paused || moment || replay) return;
    if (!playing) {
      setWatching(false);
      return;
    }
    const tick = setTimeout(() => advance(callsLeft > 0, Math.max(1, events.reduce((n, e) => n + e.clientIds.filter((id) => e.tournament.live[id]).length, 0))), 1600);
    return () => clearTimeout(tick);
  });

  useEffect(() => {
    if (!replay || step >= replay.trace.shots.length) return;
    const id = setTimeout(() => setStep((s) => s + 1), step === 0 ? 350 : 900);
    return () => clearTimeout(id);
  }, [replay, step]);

  /** Plays on to the next moment in any event (or the end of the round). */
  function advance(stops = callsLeft > 0, maxHoles?: number) {
    let found: { ev: number; m: Moment } | null = null;
    const lines: string[] = [];
    game.liveAct((evs) => {
      for (let i = 0; i < evs.length && !found; i++) {
        const t = evs[i]!.tournament;
        if (!inRound(t) && !pendingPlayoff(t).length) continue;
        const { ticker: played, moment: m } = nextMoment(t, { stops, ...(maxHoles !== undefined ? { maxHoles } : {}) });
        for (const item of played) {
          const line = tickerLine(world, item);
          if (line) lines.push(line);
        }
        if (m) found = { ev: i, m };
      }
    });
    setTicker((x) => [...x, ...lines].slice(-14));
    setMoment(found);
    setCalls({});
  }

  /** Plays the next round in every event straight through, as the plans say. */
  function simWholeRound() {
    setReplay(null);
    setTicker([]);
    game.liveAct((evs) => {
      for (const e of evs) {
        const t = e.tournament;
        if (t.round >= 4 || inRound(t)) continue;
        if (!stillIn(e)) finishLive(t);
        else {
          startLiveRound(t);
          autoFinishRound(t);
        }
      }
    });
  }

  /** Starts the next round in every event that's still going, then plays to the first moment (broadcast: watches it hole by hole). */
  function startRound() {
    setReplay(null);
    setTicker([]);
    game.liveAct((evs) => {
      for (const e of evs) {
        const t = e.tournament;
        if (t.round >= 4 || inRound(t)) continue;
        // Nobody of yours left in it: play it out.
        if (!stillIn(e)) finishLive(t);
        else {
          // At least three holes to watch and play a round, best-placed clients first (placed before the round starts).
          const order = [...e.clientIds].sort((a, b) => (standing(t, a)?.position ?? 999) - (standing(t, b)?.position ?? 999));
          startLiveRound(t);
          if (broadcast) featureHoles(t, order);
        }
      }
    });
    if (broadcast) {
      setWatching(true);
      setPaused(false);
    } else advance();
  }

  function simRound() {
    setReplay(null);
    game.liveAct((evs) => {
      for (const e of evs) autoFinishRound(e.tournament);
    });
    setMoment(null);
  }

  function answer(call: HoleCall | null) {
    if (!moment) return;
    const t = events[moment.ev]!.tournament;
    const m = moment.m;
    const player = t.config.field.find((p) => p.id === m.id)!;
    const course = t.config.course;
    const hole = course.holes[m.index]!;
    const wave = t.live[m.id]?.wave ?? "PM";
    let score: number | null = null;
    // Your own call spends one of the round's calls (a playoff call is always yours to make).
    const spends = broadcast && !m.playoff && !!call && Object.keys(call).length > 0;
    if (spends) game.spendCall(m.round);
    game.liveAct(() => {
      score = answerMoment(t, m, call);
    });
    if (score !== null) {
      const windMph = t.weather[m.round - 1]!.windMph[wave];
      const trace = traceHole({ course, hole, score, player, windMph, seed: traceSeed(t.config.name, player.id, m.round - 1, m.index), call, round: m.round - 1 });
      setReplay({ id: player.id, name: player.name, round: m.round, index: m.index, trace, courseName: course.name, scores: [...roundScores(t, m.id, m.round)], course });
      setStep(0);
      setMoment(null);
    } else {
      advance(callsLeft - (spends ? 1 : 0) > 0);
    }
  }

  const current = moment ? events[moment.ev]!.tournament : null;
  const odds = useMemo(() => {
    if (!moment || moment.m.playoff || !current?.live[moment.m.id]) return null;
    const call = Object.keys(calls).length ? calls : null;
    return { his: callOdds(current, null, moment.m.id), mine: call ? callOdds(current, call, moment.m.id) : null };
  }, [moment, calls, current]);

  return (
    <main className="moments">
      {!moment && !replay && !playing && round >= 1 && <TournamentUpdate events={events} />}
      {!moment && !replay && !playing && !allDone && round >= 1 && <RoundCalls world={world} game={game} events={events} />}
      {moment && current && (
        <MomentCard
          world={world}
          t={current}
          eventName={events.length > 1 ? events[moment.ev]!.event.name : null}
          m={moment.m}
          calls={calls}
          setCalls={setCalls}
          odds={odds}
          callsLeft={broadcast ? callsLeft : null}
          onPlay={() => answer(Object.keys(calls).length ? calls : null)}
          onPlan={() => answer(planCall(current.plans[moment.m.id] ?? "steady", moment.m.decisions))}
        />
      )}

      {replay && (
        <section className="panel moment-card">
          <div className="panel-head">
            <h2><PlayerName id={replay.id}>{replay.name}</PlayerName>: hole {replay.index + 1}, round {replay.round}</h2>
            <strong>{step >= replay.trace.shots.length ? replay.trace.result : "…"}</strong>
          </div>
          <div className="moment-body">
            <TraceDrawing trace={replay.trace} step={step} courseName={replay.courseName} />
            <div>
              <LiveScorecard course={replay.course} scores={replay.scores} current={replay.index} activeNineOnly />
              <ShotSequence trace={replay.trace} step={step} />
              <div className="btn-row">
                {step < replay.trace.shots.length && <button className="btn" onClick={() => setStep(replay.trace.shots.length)}>Show all shots</button>}
                <button className="btn btn-primary" onClick={() => { setReplay(null); advance(); }}>Play on</button>
              </div>
            </div>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Week {world.week}: {broadcast ? "broadcast" : "key moments"}</h2>
            <span className="secondary small">
              {round === 0 ? "Before round 1" : allDone ? "Final round done" : playing ? `Round ${round} in progress` : `After round ${round}`}
            </span>
          </div>
          <span className="muted small">
            {broadcast
              ? playing
                ? `Your calls this round: ${callsLeft} of ${CALLS_PER_ROUND} left`
                : "Quiet rounds sim to a recap; Friday's cut line and Sunday's contention go live"
              : "Stops for the cut line, weekend contention and playoffs"}
          </span>
        </div>
        {playing && <LiveLeaders world={world} events={events} />}
        <ClientStrip world={world} game={game} events={events} editable={round === 0 || (!playing && !allDone)} suggest={round >= 1 && !playing && !allDone} />
        <div className="btn-row" style={{ marginTop: 12 }}>
          {broadcast && !moment && !replay && !playing && !allDone && (
            <>
              {goLive ? (
                <>
                  <button className="btn btn-primary" onClick={startRound} title={`Live because ${goLive}`}>Round {nextRound}: watch live</button>
                  <button className="btn" onClick={simWholeRound}>Sim round {nextRound}</button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={simWholeRound}>Sim round {nextRound}</button>
                  <button className="btn" onClick={startRound}>Watch round {nextRound} live</button>
                </>
              )}
              <button className="btn" onClick={() => game.setLiveMode("follow")}>Hole by hole</button>
            </>
          )}
          {!broadcast && !moment && !replay && !playing && !allDone && (
            <>
              <button className="btn btn-primary" onClick={startRound}>Round {round + 1}: key moments</button>
              <button className="btn" onClick={() => game.setLiveMode("follow")}>Round {round + 1}: hole by hole</button>
              <button className="btn" onClick={simWholeRound}>Sim round {round + 1}</button>
            </>
          )}
          {!moment && !replay && playing && !watching && <button className="btn btn-primary" onClick={() => advance()}>Play on</button>}
          {!moment && !replay && playing && watching && (
            <button className="btn btn-primary" onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</button>
          )}
          {!moment && !replay && allDone && <button className="btn btn-primary" onClick={() => void game.completeLiveWeek()}>See the final results</button>}
          {playing && <button className="btn" onClick={simRound}>Sim to the end of the round</button>}
          {!allDone && <button className="btn" onClick={() => void game.completeLiveWeek()}>Sim the rest of the week</button>}
        </div>
        {goLive && <p className="small go-live">Going live: {goLive}.</p>}
        {ticker.length > 0 && <p className="ticker secondary small" aria-live="polite">{ticker.slice(-5).join(" · ")}</p>}
      </section>

    </main>
  );
}

/**
 * Between rounds: each event's leaderboard at the top, the cut line, and
 * where each of your clients sits (score, today, places moved, shots back).
 */
function TournamentUpdate({ events }: { events: LiveEvent[] }) {
  return (
    <>
      {events.map((e) => {
        const t = e.tournament;
        if (t.round < 1 || inRound(t)) return null;
        const snap = liveSnapshot(t);
        if (!snap.leaderboard.length) return null;
        const round = t.round;
        const rows = standingsAfterRound(snap, round);
        const mine = new Set(e.clientIds);
        const leader = rows[0]!;
        const top = rows.slice(0, 5);
        const extra = rows.filter((r, i) => i >= 5 && mine.has(r.player.id));
        const cut = round >= 2 && snap.cutLine !== null ? snap.cutLine : null;
        const move = (m: number | null) => (m ? <span className={m > 0 ? "good-text" : "bad-text"}>{m > 0 ? `▲${m}` : `▼${-m}`}</span> : <span className="muted">–</span>);
        const row = (r: (typeof rows)[number]) => (
          <tr key={r.player.id} className={mine.has(r.player.id) ? "me" : ""}>
            <td className="num">{r.positionLabel}</td>
            <td><PlayerName id={r.player.id}>{r.player.name}</PlayerName></td>
            <td className="num">{toPar(r.toPar)}</td>
            <td className="num">{r.today ?? "–"}</td>
            <td className="num">{r.positionLabel === "MC" ? <span className="muted">–</span> : move(r.movement)}</td>
          </tr>
        );
        return (
          <section key={e.event.id} className="panel tourney-update">
            <div className="panel-head">
              <h2>{e.event.name}: after round {round}</h2>
              <span className="secondary small">
                <PlayerName id={leader.player.id}>{leader.player.name}</PlayerName> leads at {toPar(leader.toPar)}
                {cut !== null ? ` · cut ${toPar(cut)}` : ""}
              </span>
            </div>
            <ul className="tourney-clients">
              {e.clientIds.map((id) => {
                const r = rows.find((x) => x.player.id === id);
                if (!r) return null;
                const back = r.toPar - leader.toPar;
                const out = !clientActive(t, id);
                const status = out
                  ? `missed the cut at ${toPar(r.toPar)}`
                  : `${r.positionLabel} at ${toPar(r.toPar)}, ${back === 0 ? (r.position === 1 ? "leading" : "tied for the lead") : `${back} back`}${r.today !== null ? `, shot ${r.today} today` : ""}`;
                return (
                  <li key={id}>
                    <strong><PlayerName id={id}>{r.player.name}</PlayerName></strong> <span className="secondary">{status}</span> {!out && move(r.movement)}
                  </li>
                );
              })}
            </ul>
            <table className="hbh-board tourney-board">
              <thead>
                <tr><th className="num">Pos</th><th>Player</th><th className="num">To par</th><th className="num">Today</th><th className="num">Move</th></tr>
              </thead>
              <tbody>
                {top.map(row)}
                {extra.length > 0 && <tr className="gap"><td colSpan={5} className="muted small">…</td></tr>}
                {extra.map(row)}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

function TraceDrawing({ trace, step, courseName }: { trace: HoleTrace; step: number; courseName: string }) {
  const map = useHoleMap(trace.layout.real);
  return (
    <div className="hbh-drawing">
      {hasIllustratedTracerArt(trace) ? <IllustratedTracer trace={trace} step={step} courseName={courseName} /> : <HoleDrawing trace={trace} step={step} photo={!!map?.aerial} map={map} />}
    </div>
  );
}

/** Each client this week: where he stands, today's score and his round plan. */
function ClientStrip({ world, game, events, editable, suggest }: { world: World; game: Game; events: LiveEvent[]; editable: boolean; suggest?: boolean }) {
  const advice = suggest
    ? events
        .flatMap((e) => e.clientIds.map((id) => ({ t: e.tournament, id, s: suggestPlan(e.tournament, id) })))
        .filter((x) => x.s && (x.t.plans[x.id] ?? "steady") !== x.s.plan)
    : [];
  const next = Math.max(...events.map((e) => e.tournament.round)) + 1;
  return (
    <div className="client-strip">
      {advice.length > 0 && (
        <div className="btn-row plan-review">
          <span className="secondary small">
            {next === 4 ? "Saturday night: " : ""}your caddie would change {advice.length} plan{advice.length === 1 ? "" : "s"} for round {next}.
          </span>
          <button className="btn btn-small" onClick={() => { for (const a of advice) setRoundPlan(game, a.t, a.id, a.s!.plan); }}>Use his suggestions</button>
        </div>
      )}
      {events.flatMap((e) => {
        const t = e.tournament;
        const snap = t.round > 0 && !inRound(t) ? liveSnapshot(t) : null;
        return e.clientIds.map((id) => {
          const name = world.players[id]!.player.name;
          let where = "";
          if (t.round === 0) where = "Tees off Thursday";
          else if (!clientActive(t, id)) where = "Missed the cut";
          else if (snap) {
            const row = snap.leaderboard.find((r) => r.player.id === id);
            if (row) where = `${row.positionLabel} · ${toPar(row.toPar)} · today ${row.rounds.length ? row.rounds.at(-1) : "-"}`;
          } else {
            const board = liveBoard(t, id);
            const me = board.find((r) => r.player.id === id);
            if (me) {
              const pos = board.findIndex((r) => r.toPar === me.toPar) + 1;
              const tied = board.filter((r) => r.toPar === me.toPar).length > 1;
              where = `${tied ? "T" : ""}${pos} · ${toPar(me.toPar)} · thru ${me.thru}`;
            }
          }
          return (
            <div key={`${e.event.id}-${id}`} className="client-strip-row">
              <div>
                <strong><PlayerName id={id}>{name}</PlayerName></strong>
                {events.length > 1 && <span className="muted small"> · {e.event.name}</span>}
                <div className="secondary small">{where}</div>
              </div>
              {editable && (t.round === 0 || clientActive(t, id)) ? (
                <div>
                  <RoundPlanPicker plan={t.plans[id] ?? "steady"} onPick={(p) => setRoundPlan(game, t, id, p)} />
                  {suggest && <PlanSuggestion t={t} id={id} />}
                </div>
              ) : (
                <span className="muted small" title={PLAN_LABELS[t.plans[id] ?? "steady"].blurb}>Plan: {PLAN_LABELS[t.plans[id] ?? "steady"].label}</span>
              )}
            </div>
          );
        });
      })}
    </div>
  );
}

type Odds = { expected: number; birdie: number; bogey: number };

/** A small, stable wobble from a string, so the caddie's read is a read, not a readout. */
function wobble(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return ((h >>> 0) / 0xffffffff - 0.5) * 0.12;
}

/**
 * Your caddie's take on a call against letting him play it his way: a rough
 * read, sometimes wrong on close calls, never the numbers.
 */
function caddieRead(his: Odds, mine: Odds, key: string): string {
  const gain = his.expected - mine.expected + wobble(key);
  const verdict = gain > 0.05 ? "Your caddie likes it." : gain < -0.05 ? "Your caddie isn't sold on it." : "Your caddie shrugs: could go either way.";
  const wilder = mine.birdie - his.birdie > 0.03 && mine.bogey - his.bogey > 0.03;
  const tamer = his.birdie - mine.birdie > 0.03 && his.bogey - mine.bogey > 0.03;
  return `${verdict}${wilder ? " More birdie looks, more trouble." : tamer ? " Safer, fewer birdie looks." : ""}`;
}

function MomentCard({ world, t, eventName, m, calls, setCalls, odds, callsLeft, onPlay, onPlan }: {
  world: World;
  t: LiveTournament;
  eventName: string | null;
  m: Moment;
  calls: HoleCall;
  setCalls: (fn: (c: HoleCall) => HoleCall) => void;
  odds: { his: { expected: number; birdie: number; bogey: number }; mine: { expected: number; birdie: number; bogey: number } | null } | null;
  /** Broadcast mode: calls left this round (null: no limit). */
  callsLeft: number | null;
  onPlay: () => void;
  onPlan: () => void;
}) {
  const course = t.config.course;
  const hole = course.holes[m.index]!;
  const name = world.players[m.id]!.player.name;
  const preview: HoleTrace = { layout: holeLayout(course, hole, m.round - 1), shots: [], score: 0, result: "" };
  const plan = t.plans[m.id] ?? "steady";
  const pick = (kind: CallKind, value: string | undefined) =>
    setCalls((c) => {
      const next = { ...c };
      if (value === undefined) delete next[kind];
      else (next as Record<string, string>)[kind] = value;
      return next;
    });
  return (
    <section className="panel moment-card">
      <div className="panel-head">
        <div>
          <span className="badge">{stakeWords(m.situation, m.playoff)}</span>
          <h2 style={{ marginTop: 6 }}><PlayerName id={m.id}>{name}</PlayerName>: {m.playoff ? "playoff on the 18th" : `round ${m.round}, hole ${m.index + 1}`}</h2>
          <span className="secondary small">
            {eventName ? `${eventName} · ` : ""}Par {hole.par} · {hole.yards} yds
          </span>
        </div>
      </div>
      <div className="moment-body">
        <TraceDrawing trace={preview} step={0} courseName={course.name} />
        <div>
          {!m.playoff && <LiveScorecard course={course} scores={roundScores(t, m.id, m.round)} current={m.index} activeNineOnly />}
          {m.decisions.map((d) => {
            const chosen = calls[d.kind];
            return (
              <fieldset key={d.kind} className="call">
                <legend>{d.question}</legend>
                <div className="call-options">
                  <button className="choice" aria-pressed={chosen === undefined} onClick={() => pick(d.kind, undefined)}>
                    <strong>His call</strong>
                  </button>
                  {d.options.map((o) => (
                    <button key={o.value} className="choice" aria-pressed={chosen === o.value} disabled={callsLeft === 0} onClick={() => pick(d.kind, o.value)} title={o.blurb}>
                      <strong>{o.label}</strong>
                      <span className="small muted call-blurb">{o.blurb}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
          {callsLeft !== null && !m.playoff && (
            <p className="small calls-left">
              <strong>{callsLeft} of {CALLS_PER_ROUND} calls left this round.</strong> <span className="muted">{callsLeft === 0 ? "Watch him play it his way." : "Making a call spends one; letting him play it his way is free."}</span>
            </p>
          )}
          {odds?.mine && <p className="secondary small caddie-read">{caddieRead(odds.his, odds.mine, `${m.id}:${m.round}:${m.index}:${JSON.stringify(calls)}`)}</p>}
          <div className="btn-row">
            <button className="btn btn-primary" onClick={onPlay}>{m.playoff ? "Go to the playoff" : `Play hole ${m.index + 1}`}</button>
            {plan !== "steady" && <button className="btn" onClick={onPlan}>Play it his plan's way ({PLAN_LABELS[plan].label.toLowerCase()})</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The plan the caddie suggests for a client's next round, if it differs from the one he's on. */
function PlanSuggestion({ t, id }: { t: LiveTournament; id: string }) {
  const s = suggestPlan(t, id);
  if (!s) return null;
  const same = (t.plans[id] ?? "steady") === s.plan;
  return (
    <div className="muted small">
      {same ? "Your caddie agrees" : <>Suggested: <strong>{PLAN_LABELS[s.plan].label}</strong></>} · {s.why}
    </div>
  );
}

/** While a round plays: the top of each leaderboard, with your clients picked out wherever they are. */
function LiveLeaders({ world, events }: { world: World; events: LiveEvent[] }) {
  return (
    <div className="live-leaders">
      {events.map((e) => {
        const t = e.tournament;
        const lead = e.clientIds.find((id) => t.live[id]) ?? e.clientIds.find((id) => clientActive(t, id));
        if (!lead || !inRound(t)) return null;
        const board = liveBoard(t, lead);
        const mine = new Set(e.clientIds);
        const posOf = (toParScore: number) => {
          const p = board.findIndex((r) => r.toPar === toParScore) + 1;
          return `${board.filter((r) => r.toPar === toParScore).length > 1 ? "T" : ""}${p}`;
        };
        const rows = board.filter((r, i) => i < 5 || mine.has(r.player.id));
        return (
          <table key={e.event.id} className="hbh-board live-leaders-board">
            <caption className="secondary small">{e.event.name}: round {t.round}, live</caption>
            <tbody>
              {rows.map((r) => (
                <tr key={r.player.id} className={mine.has(r.player.id) ? "me" : ""}>
                  <td className="num">{posOf(r.toPar)}</td>
                  <td>{mine.has(r.player.id) ? <PlayerName id={r.player.id}>{world.players[r.player.id]?.player.name ?? r.player.name}</PlayerName> : r.player.name}</td>
                  <td className="num">{toPar(r.toPar)}</td>
                  <td className="num muted small">{mine.has(r.player.id) ? (t.live[r.player.id] ? `thru ${t.live[r.player.id]!.holes.length}` : "F") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
