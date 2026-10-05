import { useEffect, useMemo, useState } from "react";
import {
  pinLabel,
  pinTuck,
  tuckWord,
  autoFinishRound,
  catchUpTo,
  holeLayout,
  liveBoard,
  markAsked,
  nextDecisions,
  playLiveHole,
  traceHole,
  traceSeed,
  type CallKind,
  type HoleCall,
  type HoleTrace,
  type LiveTournament,
  type TickerItem,
} from "../../engine";
import { useHoleMap } from "../holeMaps";
import { HoleDrawing, ShotSequence } from "./ShotTracer";
import { hasIllustratedTracerArt, IllustratedTracer } from "./IllustratedTracer";
import { toPar } from "../format";
import { LiveScorecard } from "./LiveScorecard";
import { PlayerName } from "./PlayerLink";

interface Played {
  index: number;
  trace: HoleTrace;
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
 * holes); elsewhere he plays his own game. Each hole
 * then plays out in the shot tracer. Your other clients in the event play
 * the same holes alongside him, on their round plans.
 */
export function HoleByHole({ t, who = t.controlledId, name, onChange, onRoundDone, onTicker }: { t: LiveTournament; who?: string; name: string; onChange: () => void; onRoundDone: () => void; onTicker?: (items: TickerItem[]) => void }) {
  const course = t.config.course;
  const player = t.config.field.find((p) => p.id === who)!;
  const cur = t.live[who] ?? null;
  const [calls, setCalls] = useState<HoleCall>({});
  const [played, setPlayed] = useState<Played | null>(null);
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(course.id !== "waialae");
  const narrow = useNarrow();

  const index = cur ? cur.holes.length : course.holes.length;
  const upcoming = cur ? course.holes[index]! : null;
  const decisions = useMemo(() => (cur && upcoming ? nextDecisions(t, who) : []), [cur, upcoming, t, who, index]); // eslint-disable-line react-hooks/exhaustive-deps
  // What the drawing shows: the hole just played (animated), or the next one.
  const preview: HoleTrace | null = upcoming ? { layout: holeLayout(course, upcoming, t.round - 1), shots: [], score: 0, result: "" } : null;
  const shown = played ?? (preview ? { index, trace: preview } : null);
  const map = useHoleMap(shown?.trace.layout.real);

  useEffect(() => {
    if (!played || step >= played.trace.shots.length) return;
    const id = setTimeout(() => setStep((s) => s + 1), step === 0 ? 350 : 900);
    return () => clearTimeout(id);
  }, [played, step]);

  const entry = t.entries.find((e) => e.player.id === who)!;
  const wind = () => t.weather[t.round - 1]!.windMph[cur?.wave ?? entry.waves[t.round - 1] ?? "AM"];

  function playOne(call: HoleCall | null): Played {
    const i = t.live[who]!.holes.length;
    const hole = course.holes[i]!;
    const windMph = wind();
    const score = playLiveHole(t, call, who);
    // Your other clients keep pace, a hole at a time.
    const others = catchUpTo(t, i + 1, who);
    if (others.length) onTicker?.(others);
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
    markAsked(t, who, decisions.map((d) => d.kind));
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
    } while (t.live[who] && !nextDecisions(t, who).length);
    setPlayed(last);
    setStep(0);
    setCalls({});
    onChange();
  }

  function finishRound() {
    let last: Played | null = null;
    while (t.live[who]) last = playOne(null);
    autoFinishRound(t);
    setPlayed(last);
    setStep(last ? last.trace.shots.length : 0);
    onChange();
  }

  const board = liveBoard(t, who);
  const me = board.find((r) => r.player.id === who);
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
          <h2><PlayerName id={who}>{name}</PlayerName>: round {t.round}, hole by hole</h2>
          <span className="secondary small">
            Today {today.length ? toPar(today.reduce((a, b) => a + b, 0) - todayPar) : "E"} thru {today.length}
            {me && ` · ${toPar(me.toPar)} overall · ${tied ? "T" : ""}${myPos}${myPos === 1 ? " (leading)" : ""}`}
          </span>
        </div>
      </div>

      {showHole && (
        <p className="hbh-hole">
          <strong>Hole {(shown?.index ?? 0) + 1}</strong>
          <span>Par {showHole.par}</span>
          <span>{showHole.yards} yds</span>
          {showHole.tourAverage !== undefined && <span title="Tour average to par">Avg {toPar(Math.round((showHole.tourAverage - showHole.par) * 100) / 100)}</span>}
          <span>Wind {Math.round(wind())} mph</span>
          <span title="Where the pin is cut today: tucked pins play harder, accessible ones easier">
            Pin: {pinLabel(holeLayout(course, showHole, t.round - 1)).toLowerCase()}
            {tuckWord(pinTuck(course, showHole, t.round - 1)) && `, ${tuckWord(pinTuck(course, showHole, t.round - 1))}`}
          </span>
        </p>
      )}

      <div className="tracer-body hbh-body">
        <div className="hbh-drawing">
          {shown && hasIllustratedTracerArt(shown.trace) ? (
            <IllustratedTracer trace={shown.trace} step={played ? step : 0} courseName={course.name} />
          ) : shown ? (
            <HoleDrawing trace={shown.trace} step={played ? step : 0} photo={photo} map={map} />
          ) : null}
          <div className="hole-credit">
            {map?.aerial && (
              <div className="tabs" role="tablist" aria-label="Hole view" style={{ margin: 0 }}>
                <button role="tab" aria-selected={photo} onClick={() => setPhoto(true)}>Photo</button>
                <button role="tab" aria-selected={!photo} onClick={() => setPhoto(false)}>Map</button>
              </div>
            )}
            {shown?.trace.layout.real && (
              <span className="muted small">
{course.id === "waialae" ? "Illustrated hole · " : photo && map?.aerial ? "Aerial photo: USDA NAIP / USGS · " : ""}Hole map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
              </span>
            )}
          </div>
        </div>

        <div className="hbh-side">
          <LiveScorecard course={course} scores={today} current={cur ? index : null} onPick={replay} activeNineOnly />
          {played ? (
            <>
              <p style={{ marginTop: 0 }}>
                <strong>{step >= played.trace.shots.length ? played.trace.result : "…"}</strong>
              </p>
              <ShotSequence trace={played.trace} step={step} />
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
                  return (
                    <fieldset key={d.kind} className="call">
                      <legend>{d.question}</legend>
                      <div className="call-options">
                        <button className="choice" aria-pressed={chosen === undefined} onClick={() => pick(d.kind, undefined)}>
                          <strong>His call</strong>
                        </button>
                        {d.options.map((o) => {
                          return (
                            <button key={o.value} className="choice" aria-pressed={chosen === o.value} onClick={() => pick(d.kind, o.value)} title={o.blurb}>
                              <strong>{o.label}</strong>
                              <span className="small muted call-blurb">{o.blurb}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })
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
                <tr key={r.player.id} className={r.player.id === who ? "me" : t.controlledIds.includes(r.player.id) ? "mine" : ""}>
                  <td className="num">{board.findIndex((x) => x.toPar === r.toPar) + 1}</td>
                  <td><PlayerName id={r.player.id}>{r.player.name}</PlayerName></td>
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
