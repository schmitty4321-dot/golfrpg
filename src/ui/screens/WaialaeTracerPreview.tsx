import { useEffect, useMemo, useState } from "react";
import { createRng, generatePlayer, REAL_COURSES, traceHole, traceSeed, type PlayerEventResult, type TournamentResult } from "../../engine";
import { ProjectedHole } from "../components/ProjectedHole";
import { useHoleMap } from "../holeMaps";
import { LiveScorecard } from "../components/LiveScorecard";
import { HoleDrawing, ShotTracer } from "../components/ShotTracer";
import { hasIllustratedTracerArt, IllustratedTracer } from "../components/IllustratedTracer";

// `?course=` picks any illustrated course (Waialae by default).
const params = new URLSearchParams(window.location.search);
const course = REAL_COURSES.find((item) => item.id === (params.get("course") ?? "waialae")) ?? REAL_COURSES.find((item) => item.id === "waialae")!;
const player = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });
// A review fixture for the actual tournament modal, without creating a career save.
const card = course.holes.map(h => h.par);
const par = card.reduce((sum, score) => sum + score, 0);
const row: PlayerEventResult = {
  player, holes: [card], rounds: [par], waves: ["AM"], total: par, toPar: 0,
  madeCut: true, position: 1, positionLabel: "1", earnings: 0,
  sg: { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 }, sgPerRound: 0,
};
const result: TournamentResult = {
  name: "Waialae prototype", course, par, leaderboard: [row], cutLine: null, playoff: null,
  weather: [{ windMph: { AM: 9, PM: 9 }, rain: false }],
};
/** Development-only review of the tracer in its eventual game context. */
export function WaialaeTracerPreview() {
  const [modal, setModal] = useState(false);
  const requestedHole = Number(params.get("hole"));
  const [holeNumber, setHoleNumber] = useState(requestedHole >= 1 && requestedHole <= course.holes.length ? requestedHole : 1);
  const trace = useMemo(() => {
    const hole = course.holes[holeNumber - 1]!;
    return traceHole({
      course,
      hole,
      score: hole.par,
      player,
      windMph: 9,
      seed: traceSeed("Waialae tracer preview", player.id, holeNumber),
      round: 0,
    });
  }, [holeNumber]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(params.get("view") === "current");
  const map = useHoleMap(trace.layout.real);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (step < trace.shots.length) setStep(step + 1);
      else setPlaying(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [playing, step, trace]);
  const selectHole = (number: number) => {
    setHoleNumber(number);
    setStep(0);
    setPlaying(false);
  };
  return (
    <main className="tracer-preview">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1>{player.name} · Sony Open in Hawaii</h1>
            <span className="secondary small">Round 1 · Hole {holeNumber} · Par {trace.layout.par} · {trace.layout.yards} yds · Wind 9 mph</span>
          </div>
          <a className="btn btn-small" href={window.location.pathname}>Return to game</a>
        </div>
        <LiveScorecard course={course} scores={course.holes.slice(0, 3).map((hole) => hole.par)} current={holeNumber - 1} onPick={(index) => index < 3 && selectHole(index + 1)} />
        <div className="btn-row tracer-preview-holes" aria-label="Rendered hole previews">
          {[1, 2, 3].map((number) => (
            <button key={number} className={`btn btn-small${number === holeNumber ? " btn-primary" : ""}`} onClick={() => selectHole(number)}>
              Hole {number}
            </button>
          ))}
        </div>
        <div className="tabs" role="group" aria-label="Hole view">
          <button aria-pressed={!current} onClick={() => setCurrent(false)}>Illustrated 3D</button>
          <button aria-pressed={current} onClick={() => setCurrent(true)}>Current view</button>
        </div>
        <button className="btn btn-small" onClick={() => setModal(true)}>Open game replay</button>
        <div className="tracer-preview-layout">
          {!current && course.id === "waialae" && holeNumber === 1
            ? <ProjectedHole trace={trace} step={step} map={map} />
            : !current && hasIllustratedTracerArt(trace)
            ? <IllustratedTracer trace={trace} step={step} courseName={course.name} />
            : <HoleDrawing trace={trace} step={step} photo={true} map={map} />}
          <aside>
            <h2>Shot replay</h2>
            <p className="secondary">{trace.result}</p>
            <div className="btn-row">
              <button className="btn" onClick={() => setPlaying(v => !v)}>{playing ? "Pause" : "Play"}</button>
              <button className="btn" onClick={() => { setStep(0); setPlaying(true); }}>Replay hole</button>
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn" disabled={step === 0} onClick={() => { setPlaying(false); setStep(value => Math.max(0, value - 1)); }}>Previous shot</button>
              <button className="btn btn-primary" disabled={step >= trace.shots.length} onClick={() => { setPlaying(false); setStep(value => Math.min(trace.shots.length, value + 1)); }}>Next shot</button>
            </div>
            <ol className="shot-list" style={{ marginTop: 16 }}>
              {trace.shots.map((shot, index) => (
                <li key={shot.stroke} className={index < step ? "" : "pending"}>
                  <span>{index < step ? shot.text : "…"}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>
      {modal && <ShotTracer result={result} row={row} round={0} hole={holeNumber - 1} onClose={() => setModal(false)} />}
    </main>
  );
}
