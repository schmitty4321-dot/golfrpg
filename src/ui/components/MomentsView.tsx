import { useEffect, useMemo, useState } from "react";
import {
  answerMoment,
  autoFinishRound,
  callOdds,
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
} from "../../engine";
import type { LiveEvent, World } from "../../season";
import type { Game, LiveWeek } from "../useGame";
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
  const [moment, setMoment] = useState<{ ev: number; m: Moment } | null>(null);
  const [calls, setCalls] = useState<HoleCall>({});
  const [replay, setReplay] = useState<Replay | null>(null);
  const [step, setStep] = useState(0);
  const [ticker, setTicker] = useState<string[]>([]);
  const events = lw.events;
  const round = Math.max(...events.map((e) => e.tournament.round));
  const allDone = events.every((e) => eventDone(e.tournament));
  const playing = events.some((e) => inRound(e.tournament));

  useEffect(() => {
    if (!replay || step >= replay.trace.shots.length) return;
    const id = setTimeout(() => setStep((s) => s + 1), step === 0 ? 350 : 900);
    return () => clearTimeout(id);
  }, [replay, step]);

  /** Plays on to the next moment in any event (or the end of the round). */
  function advance() {
    let found: { ev: number; m: Moment } | null = null;
    const lines: string[] = [];
    game.liveAct((evs) => {
      for (let i = 0; i < evs.length && !found; i++) {
        const t = evs[i]!.tournament;
        if (!inRound(t) && !pendingPlayoff(t).length) continue;
        const { ticker: played, moment: m } = nextMoment(t);
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

  /** Starts the next round in every event that's still going, then plays to the first moment. */
  function startRound() {
    setReplay(null);
    setTicker([]);
    game.liveAct((evs) => {
      for (const e of evs) {
        const t = e.tournament;
        if (t.round >= 4 || inRound(t)) continue;
        // Nobody of yours left in it: play it out.
        if (!stillIn(e)) finishLive(t);
        else startLiveRound(t);
      }
    });
    advance();
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
      advance();
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
            <h2>Week {world.week}: key moments</h2>
            <span className="secondary small">
              {round === 0 ? "Before round 1" : allDone ? "Final round done" : playing ? `Round ${round} in progress` : `After round ${round}`}
            </span>
          </div>
          <span className="muted small">Stops for the cut line, weekend contention and playoffs</span>
        </div>
        <ClientStrip world={world} game={game} events={events} editable={round === 0} />
        <div className="btn-row" style={{ marginTop: 12 }}>
          {!moment && !replay && !playing && !allDone && (
            <>
              <button className="btn btn-primary" onClick={startRound}>Round {round + 1}: key moments</button>
              <button className="btn" onClick={() => game.setLiveMode("follow")}>Round {round + 1}: hole by hole</button>
              <button className="btn" onClick={simWholeRound}>Sim round {round + 1}</button>
            </>
          )}
          {!moment && !replay && playing && <button className="btn btn-primary" onClick={advance}>Play on</button>}
          {!moment && !replay && allDone && <button className="btn btn-primary" onClick={() => void game.completeLiveWeek()}>See the final results</button>}
          {playing && <button className="btn" onClick={simRound}>Sim to the end of the round</button>}
          {!allDone && <button className="btn" onClick={() => void game.completeLiveWeek()}>Sim the rest of the week</button>}
        </div>
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
function ClientStrip({ world, game, events, editable }: { world: World; game: Game; events: LiveEvent[]; editable: boolean }) {
  return (
    <div className="client-strip">
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
              {editable ? (
                <RoundPlanPicker plan={t.plans[id] ?? "steady"} onPick={(p) => setRoundPlan(game, t, id, p)} />
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

function MomentCard({ world, t, eventName, m, calls, setCalls, odds, onPlay, onPlan }: {
  world: World;
  t: LiveTournament;
  eventName: string | null;
  m: Moment;
  calls: HoleCall;
  setCalls: (fn: (c: HoleCall) => HoleCall) => void;
  odds: { his: { expected: number; birdie: number; bogey: number }; mine: { expected: number; birdie: number; bogey: number } | null } | null;
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
                    <button key={o.value} className="choice" aria-pressed={chosen === o.value} onClick={() => pick(d.kind, o.value)} title={o.blurb}>
                      <strong>{o.label}</strong>
                      <span className="small muted call-blurb">{o.blurb}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
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
