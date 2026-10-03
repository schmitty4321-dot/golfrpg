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
  startLiveRound,
  traceHole,
  traceSeed,
  type CallKind,
  type HoleCall,
  type HoleSituation,
  type HoleTrace,
  type LiveTournament,
  type Moment,
} from "../../engine";
import type { LiveEvent, World } from "../../season";
import type { Game, LiveWeek } from "../useGame";
import { toPar } from "../format";
import { useHoleMap } from "../holeMaps";
import { HoleDrawing } from "./ShotTracer";
import { hasIllustratedTracerArt, IllustratedTracer } from "./IllustratedTracer";
import { PLAN_LABELS, RoundPlanPicker, setRoundPlan, tickerLine } from "./WeekTempo";
import { RoundCalls } from "./RoundCalls";

/** A moment you've answered: the hole, played out in the tracer. */
interface Replay {
  name: string;
  round: number;
  index: number;
  trace: HoleTrace;
  courseName: string;
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
      setReplay({ name: player.name, round: m.round, index: m.index, trace, courseName: course.name });
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
            <h2>{replay.name}: hole {replay.index + 1}, round {replay.round}</h2>
            <strong>{step >= replay.trace.shots.length ? replay.trace.result : "…"}</strong>
          </div>
          <div className="moment-body">
            <TraceDrawing trace={replay.trace} step={step} courseName={replay.courseName} />
            <div>
              <ol className="shot-list">
                {replay.trace.shots.map((s, i) => (
                  <li key={i} className={i < step ? (i === step - 1 ? "current" : "") : "pending"}>
                    <span>{i < step ? s.text : "…"}</span>
                  </li>
                ))}
              </ol>
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
          {!moment && !replay && !playing && !allDone && <button className="btn btn-primary" onClick={startRound}>Play round {round + 1}</button>}
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
                <strong>{name}</strong>
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

const pct = (x: number) => `${Math.round(x * 100)}%`;

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
  const shown = odds?.mine ?? odds?.his;
  return (
    <section className="panel moment-card">
      <div className="panel-head">
        <div>
          <span className="badge">{stakeWords(m.situation, m.playoff)}</span>
          <h2 style={{ marginTop: 6 }}>{name}: {m.playoff ? "playoff on the 18th" : `round ${m.round}, hole ${m.index + 1}`}</h2>
          <span className="secondary small">
            {eventName ? `${eventName} · ` : ""}Par {hole.par} · {hole.yards} yds
          </span>
        </div>
      </div>
      <div className="moment-body">
        <TraceDrawing trace={preview} step={0} courseName={course.name} />
        <div>
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
          {shown && odds && (
            <p className="secondary small">
              Expected {shown.expected.toFixed(2)} · birdie or better {pct(shown.birdie)} · bogey or worse {pct(shown.bogey)}
              {odds.mine && ` (his call: ${odds.his.expected.toFixed(2)})`}
            </p>
          )}
          <div className="btn-row">
            <button className="btn btn-primary" onClick={onPlay}>{m.playoff ? "Go to the playoff" : `Play hole ${m.index + 1}`}</button>
            {plan !== "steady" && <button className="btn" onClick={onPlan}>Play it his plan's way ({PLAN_LABELS[plan].label.toLowerCase()})</button>}
          </div>
        </div>
      </div>
    </section>
  );
}
