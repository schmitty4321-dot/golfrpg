import { useState } from "react";
import { createRng, REAL_COURSES, generatePlayer } from "../../engine";
import { clubCarry, lieAt, playPracticeShot, startPracticeHole, type PracticeHole, type PracticeStroke } from "../../engine/practiceHole";
import { powerSweepMs, strikeSweepMs, sweetSpotMs, type SwingClub } from "../../engine/swing";
import { illustratedArtFor, projectArtPoint } from "../illustratedArt";
import { SwingMeter, type SwingStrike } from "../components/SwingMeter";

// Development review of a practice hole, played shot by shot with the three-click meter below the picture.
const course = REAL_COURSES.find((c) => c.id === "waialae")!;
const player = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });
const LIE_LABEL: Record<string, string> = { tee: "Tee", fairway: "Fairway", rough: "Rough", bunker: "Bunker", green: "Green", water: "Water", holed: "Holed" };

export function PracticeHolePreview() {
  const hole = course.holes[0]!;
  const [state, setState] = useState<PracticeHole>(() => startPracticeHole(course, hole, 0));
  const [club, setClub] = useState<SwingClub>("driver");
  const [aim, setAim] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const art = illustratedArtFor("waialae", 1)!;
  const base = import.meta.env.BASE_URL;
  const lie = state.lie === "tee" || state.lie === "fairway" || state.lie === "rough" || state.lie === "bunker" || state.lie === "green" ? state.lie : "fairway";
  const swingLie = lie === "rough" ? "light" : lie === "bunker" ? "fairwaySand" : lie === "green" ? "greenSand" : "fairway";
  const windowMs = sweetSpotMs(player, club, swingLie);
  const carry = clubCarry(player, club);
  const toPin = Math.hypot(state.layout.pin.x - state.ball.x, state.layout.pin.y - state.ball.y);
  const target = Math.min(100, Math.round((toPin / carry) * 100));

  const onStrike = (strike: SwingStrike) => {
    if (state.holed) return;
    const next = playPracticeShot(state, player, { club: lie === "green" ? "wedge" : club, power: strike.power, timingMs: strike.timingMs, aim });
    const s = next.strokes[next.strokes.length - 1]!;
    setState(next);
    setLog((l) => [...l, `${s.stroke}. ${s.penalty ? "Into the water, penalty, back to where it was struck" : `${Math.round(s.yards)} yds to ${LIE_LABEL[s.lieAfter] ?? s.lieAfter}`} · timing ${Math.round(strike.timingMs)} ms · power ${Math.round(strike.power)}%`]);
  };
  const reset = () => { setState(startPracticeHole(course, hole, 0)); setLog([]); };

  const dot = (p: { x: number; y: number }) => projectArtPoint(art.matrix, p);
  return (
    <main className="tracer-preview practice-hole">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1>Practice · {course.name}, hole 1</h1>
            <span className="secondary small">Par {hole.par} · {hole.yards} yds · {player.name} · lie: {LIE_LABEL[lie]} · {Math.round(toPin)} yds to the pin</span>
          </div>
          <a className="btn btn-small" href={window.location.pathname}>Return to game</a>
        </div>
        <div className="practice-picture" style={{ position: "relative" }}>
          <img src={`${base}${art.image}`} alt={`${course.name}, hole 1`} style={{ width: "100%", display: "block" }} />
          <svg viewBox={`0 0 ${art.width} ${art.height}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
            {state.strokes.map((s: PracticeStroke, i: number) => {
              const a = dot(s.from), b = dot(s.to);
              return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={s.penalty ? "#ff5a4a" : "#bce764"} strokeWidth={6} strokeDasharray="14 10" /><circle cx={b.x} cy={b.y} r={14} fill={s.penalty ? "#ff5a4a" : "#bce764"} stroke="#fff" strokeWidth={3} /></g>;
            })}
            {(() => { const p = dot(state.ball); return <circle cx={p.x} cy={p.y} r={18} fill="#fff" stroke="#000" strokeWidth={4} />; })()}
          </svg>
        </div>
        <div className="practice-controls">
          <div className="btn-row" aria-label="Club">
            {(["driver", "iron", "wedge"] as const).map((c) => (
              <button key={c} className={`btn btn-small${club === c ? " btn-primary" : ""}`} onClick={() => setClub(c)} disabled={lie === "green"}>{c === "driver" ? "Driver" : c === "iron" ? "7 iron" : "Wedge"}</button>
            ))}
          </div>
          <label>Aim {aim > 0 ? `${aim} yd right` : aim < 0 ? `${-aim} yd left` : "at the pin"}<input type="range" min={-20} max={20} value={aim} onChange={(e) => setAim(Number(e.target.value))} /></label>
          <span className="secondary small">Sweet spot ±{windowMs} ms · carry {carry} yd · power to reach the pin {target}%</span>
          <SwingMeter powerSweepMs={powerSweepMs(player, club)} strikeSweepMs={strikeSweepMs(player, club)} windowMs={windowMs} targetPower={target} disabled={state.holed} onStrike={onStrike} />
          <button className="btn" onClick={reset}>Start the hole again</button>
        </div>
        <ol className="practice-log">
          {log.map((line, i) => <li key={i}>{line}</li>)}
          {state.holed && <li><strong>Holed in {state.score} (par {hole.par})</strong></li>}
        </ol>
        <span className="secondary small">{lieAt(state.layout, state.ball) === "water" ? "" : ""}</span>
      </section>
    </main>
  );
}
