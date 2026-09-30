import { useMemo, useState } from "react";
import { createRng, generatePlayer, REAL_COURSES, traceHole, traceSeed } from "../../engine";
import { LiveScorecard } from "../components/LiveScorecard";
import { HoleDrawing } from "../components/ShotTracer";
import { hasIllustratedTracerArt, IllustratedTracer } from "../components/IllustratedTracer";

const course = REAL_COURSES.find((item) => item.id === "waialae")!;
const player = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });
/** Development-only review of the tracer in its eventual game context. */
export function WaialaeTracerPreview() {
  const requestedHole = Number(new URLSearchParams(window.location.search).get("hole"));
  const [holeNumber, setHoleNumber] = useState(requestedHole >= 1 && requestedHole <= 3 ? requestedHole : 1);
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
  const [step, setStep] = useState(99);
  const selectHole = (number: number) => {
    setHoleNumber(number);
    setStep(99);
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
        <div className="tracer-preview-layout">
          {hasIllustratedTracerArt(trace)
            ? <IllustratedTracer trace={trace} step={step} courseName={course.name} />
            : <HoleDrawing trace={trace} step={step} photo={false} map={null} />}
          <aside>
            <h2>Off the tee</h2>
            <p className="secondary">The fairway narrows around the first landing area. What is the call?</p>
            <div className="call-options">
              <button className="choice"><strong>His call</strong><span className="small secondary">Driver · balanced line</span></button>
              <button className="choice"><strong>Driver</strong><span className="small secondary">More distance, more trouble</span></button>
              <button className="choice"><strong>3-wood</strong><span className="small secondary">Shorter, safer approach</span></button>
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => setStep((value) => Math.max(0, value - 1))}>Previous shot</button>
              <button className="btn btn-primary" onClick={() => setStep((value) => Math.min(trace.shots.length, value + 1))}>Next shot</button>
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
    </main>
  );
}
