import { useEffect, useMemo, useState } from "react";
import {
  pinLabel,
  callOdds,
  decisionsFor,
  holeLayout,
  liveBoard,
  playLiveHole,
  traceHole,
  traceSeed,
  type CallKind,
  type HoleCall,
  type HoleSituation,
  type HoleTrace,
  type LiveTournament,
} from "../../engine";
import { useHoleMap } from "../holeMaps";
import { HoleDrawing, LIE_WORDS } from "./ShotTracer";
import { toPar } from "../format";
import { LiveScorecard } from "./LiveScorecard";

interface Played {
  index: number;
  trace: HoleTrace;
}

/** Where the client stands before a hole, for deciding which calls matter. */
function situation(t: LiveTournament): HoleSituation {
  const board = liveBoard(t);
  const me = board.find((r) => r.player.id === t.controlledId)!;
  const cutTop = t.config.cutTop;
  const cutMargin = t.round === 2 && cutTop !== undefined && board.length > cutTop ? board[cutTop - 1]!.toPar - me.toPar : null;
  return { round: t.round, index: t.current!.holes.length, behind: me.toPar - board[0]!.toPar, cutMargin };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A call's odds: full words on a wide screen, just the numbers on a phone (the legend explains them). */
function Odds({ o }: { o: { expected: number; birdie: number; bogey: number } }) {
  return (
    <span className="small secondary odds">
      <span className="odds-long">Avg {o.expected.toFixed(2)} · Birdie {pct(o.birdie)} · Bogey+ {pct(o.bogey)}</span>
      <span className="odds-short">
        <span>{o.expected.toFixed(2)}</span>
        <span>{pct(o.birdie)} / {pct(o.bogey)}</span>
      </span>
    </span>
  );
}

/** True on phone-width screens. */
function useNarrow(): boolean {
  const query = "(max-width: 700px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

/**
 * Your client's round, a hole at a time. On key holes you make the calls
 * (off the tee, going for a par 5, attacking a pin, the putts on the closing
 * holes), with the odds of each; elsewhere he plays his own game. Each hole
 * then plays out in the shot tracer.
 */
export function HoleByHole({ t, name, onChange, onRoundDone }: { t: LiveTournament; name: string; onChange: () => void; onRoundDone: () => void }) {
  const course = t.config.course;
  const player = t.config.field.find((p) => p.id === t.controlledId)!;
  const cur = t.current;
  const [calls, setCalls] = useState<HoleCall>({});
  const [played, setPlayed] = useState<Played | null>(null);
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(true);
  const narrow = useNarrow();

  const index = cur ? cur.holes.length : course.holes.length;
  const upcoming = cur ? course.holes[index]! : null;
  const decisions = useMemo(() => (cur && upcoming ? decisionsFor(upcoming, course, player, situation(t)) : []), [cur, upcoming, course, player, t, index]); // eslint-disable-line react-hooks/exhaustive-deps
  const odds = useMemo(() => {
    if (!cur || !decisions.length) return null;
    const own = callOdds(t, null);
    const byOption: Record<string, ReturnType<typeof callOdds>> = {};
    for (const d of decisions) for (const o of d.options) byOption[`${d.kind}:${o.value}`] = callOdds(t, { [d.kind]: o.value } as HoleCall);
    return { own, byOption };
  }, [decisions]); // eslint-disable-line react-hooks/exhaustive-deps

  // What the drawing shows: the hole just played (animated), or the next one.
  const preview: HoleTrace | null = upcoming ? { layout: holeLayout(course, upcoming, t.round - 1), shots: [], score: 0, result: "" } : null;
  const shown = played ?? (preview ? { index, trace: preview } : null);
  const map = useHoleMap(shown?.trace.layout.real);

  useEffect(() => {
    if (!played || step >= played.trace.shots.length) return;
    const id = setTimeout(() => setStep((s) => s + 1), step === 0 ? 350 : 900);
    return () => clearTimeout(id);
  }, [played, step]);

  const entry = t.entries.find((e) => e.player.id === t.controlledId)!;
  const wind = () => t.weather[t.round - 1]!.windMph[cur?.wave ?? entry.waves[t.round - 1] ?? "AM"];

  function playOne(call: HoleCall | null): Played {
    const i = t.current!.holes.length;
    const hole = course.holes[i]!;
    const windMph = wind();
    const score = playLiveHole(t, call);
    const trace = traceHole({ course, hole, score, player, windMph, seed: traceSeed(t.config.name, player.id, t.round - 1, i), call, round: t.round - 1 });
    return { index: i, trace };
  }

  /** Watch a hole already played this round again. */
  function replay(i: number) {
    const hole = course.holes[i]!;
    const call = entry.calls?.[t.round - 1]?.[i] ?? null;
    const trace = traceHole({ course, hole, score: today[i]!, player, windMph: wind(), seed: traceSeed(t.config.name, player.id, t.round - 1, i), call, round: t.round - 1 });
    setPlayed({ index: i, trace });
    setStep(0);
  }

  function play() {
    const call = Object.keys(calls).length ? calls : null;
    const p = playOne(call);
    setPlayed(p);
    setStep(0);
    setCalls({});
    onChange();
  }

  /** Plays holes with no decisions to make, stopping before the next one that has any. */
  function playToDecision() {
    let last: Played | null = null;
    do {
      last = playOne(null);
    } while (t.current && !decisionsFor(course.holes[t.current.holes.length]!, course, player, situation(t)).length);
    setPlayed(last);
    setStep(0);
    setCalls({});
    onChange();
  }

  function finishRound() {
    let last: Played | null = null;
    while (t.current) last = playOne(null);
    setPlayed(last);
    setStep(last ? last.trace.shots.length : 0);
    onChange();
  }

  const board = liveBoard(t);
  const me = board.find((r) => r.player.id === t.controlledId);
  const myPos = me ? board.findIndex((r) => r.toPar === me.toPar) + 1 : null;
  const tied = me ? board.filter((r) => r.toPar === me.toPar).length > 1 : false;
  const today = cur ? cur.holes : (entry.holes[t.round - 1] ?? []);
  const todayPar = course.holes.slice(0, today.length).reduce((a, h) => a + h.par, 0);
  const showHole = course.holes[shown?.index ?? 0];
  const pick = (kind: CallKind, value: string | undefined) => setCalls((c) => {
    const next = { ...c };
    if (value === undefined) delete next[kind];
    else (next as Record<string, string>)[kind] = value;
    return next;
  });

  return (
    <section className="panel hbh">
      <div className="panel-head">
        <div>
          <h2>{name}: round {t.round}, hole by hole</h2>
          <span className="secondary small">
            Today {today.length ? toPar(today.reduce((a, b) => a + b, 0) - todayPar) : "E"} thru {today.length}
            {me && ` · ${toPar(me.toPar)} overall · ${tied ? "T" : ""}${myPos}${myPos === 1 ? " (leading)" : ""}`}
          </span>
        </div>
      </div>

      <LiveScorecard course={course} scores={today} current={cur ? index : null} onPick={replay} />

      {showHole && (
        <p className="hbh-hole">
          <strong>Hole {(shown?.index ?? 0) + 1}</strong>
          <span>Par {showHole.par}</span>
          <span>{showHole.yards} yds</span>
          {showHole.tourAverage !== undefined && <span title="Tour average to par">Avg {toPar(Math.round((showHole.tourAverage - showHole.par) * 100) / 100)}</span>}
          <span>Wind {Math.round(wind())} mph</span>
          <span title="Where the pin is cut today">Pin: {pinLabel(holeLayout(course, showHole, t.round - 1)).toLowerCase()}</span>
        </p>
      )}

      <div className="tracer-body hbh-body">
        <div className="hbh-drawing">
          {shown && <HoleDrawing trace={shown.trace} step={played ? step : 0} photo={photo} map={map} />}
          <div className="hole-credit">
            {map?.aerial && (
              <div className="tabs" role="tablist" aria-label="Hole view" style={{ margin: 0 }}>
                <button role="tab" aria-selected={photo} onClick={() => setPhoto(true)}>Photo</button>
                <button role="tab" aria-selected={!photo} onClick={() => setPhoto(false)}>Map</button>
              </div>
            )}
            {shown?.trace.layout.real && (
              <span className="muted small">
                {photo && map?.aerial ? "Aerial photo: USDA NAIP / USGS · " : ""}Hole map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
              </span>
            )}
          </div>
        </div>

        <div>
          {played ? (
            <>
              <p style={{ marginTop: 0 }}>
                <strong>{step >= played.trace.shots.length ? played.trace.result : "…"}</strong>
              </p>
              <ol className="shot-list">
                {played.trace.shots.map((s, i) => (
                  <li key={i} className={i < step ? (i === step - 1 ? "current" : "") : "pending"}>
                    {(s.kind === "penalty" || !s.text.startsWith(s.club)) && <span className="muted small">{s.kind === "penalty" ? "Penalty" : s.club}</span>}
                    <span>{i < step ? s.text : "…"}</span>
                    {i < step && s.kind !== "penalty" && s.lie !== "holed" && <span className="muted small">Lies: {LIE_WORDS[s.lie]}</span>}
                  </li>
                ))}
              </ol>
              <div className="btn-row hbh-actions">
                {step < played.trace.shots.length && <button className="btn" onClick={() => setStep(played.trace.shots.length)}>Show all shots</button>}
                {cur ? (
                  <button className="btn btn-primary" onClick={() => { setPlayed(null); setStep(0); }}>Next hole</button>
                ) : (
                  <button className="btn btn-primary" onClick={onRoundDone}>See the round</button>
                )}
              </div>
            </>
          ) : cur && upcoming ? (
            <>
              {decisions.length === 0 ? (
                <p className="secondary">Nothing to decide here: he plays his own game.</p>
              ) : (
                decisions.map((d) => {
                  const chosen = calls[d.kind];
                  const own = odds?.own;
                  return (
                    <fieldset key={d.kind} className="call">
                      <legend>{d.question}</legend>
                      <div className="call-options">
                        <button className="choice" aria-pressed={chosen === undefined} onClick={() => pick(d.kind, undefined)}>
                          <strong>His call</strong>
                          {own && <Odds o={own} />}
                        </button>
                        {d.options.map((o) => {
                          const od = odds?.byOption[`${d.kind}:${o.value}`];
                          return (
                            <button key={o.value} className="choice" aria-pressed={chosen === o.value} onClick={() => pick(d.kind, o.value)} title={o.blurb}>
                              <strong>{o.label}</strong>
                              {od && <Odds o={od} />}
                              <span className="small muted call-blurb">{o.blurb}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })
              )}
              {decisions.length > 0 && (
                <p className="muted small call-legend">
                  <span className="odds-long">Averages and chances are for this hole, from his game today and the conditions.</span>
                  <span className="odds-short">Each option: average score, then birdie / bogey-or-worse chances on this hole.</span>
                </p>
              )}
              <div className="btn-row hbh-actions">
                <button className="btn btn-primary" onClick={play}>Play hole {index + 1}</button>
                <button className="btn" onClick={playToDecision}>{narrow ? "To next call" : "Play to the next decision"}</button>
                <button className="btn" onClick={finishRound}>{narrow ? "Finish round" : "Finish the round"}</button>
              </div>
            </>
          ) : null}

          <details className="hbh-lb" open={!narrow}>
            <summary>
              Leaderboard {me && <span className="muted small">· {name.split(" ").pop()} {tied ? "T" : ""}{myPos}, {toPar(me.toPar)}</span>}
              <span className="muted small"> (everyone through the same hole)</span>
            </summary>
          <table className="hbh-board">
            <tbody>
              {board.slice(0, 8).concat(me && board.indexOf(me) >= 8 ? [me] : []).map((r) => (
                <tr key={r.player.id} className={r.player.id === t.controlledId ? "me" : ""}>
                  <td className="num">{board.findIndex((x) => x.toPar === r.toPar) + 1}</td>
                  <td>{r.player.name}</td>
                  <td className="num">{toPar(r.toPar)}</td>
                  <td className="num muted small">{r.thru === 18 ? "F" : `thru ${r.thru}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </details>
        </div>
      </div>
    </section>
  );
}
