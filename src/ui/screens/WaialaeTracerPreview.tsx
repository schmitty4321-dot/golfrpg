import { useState } from "react";
import { createRng, generatePlayer, REAL_COURSES, traceHole, traceSeed } from "../../engine";
import { IllustratedTracer } from "../components/IllustratedTracer";
import { LiveScorecard } from "../components/LiveScorecard";

const course = REAL_COURSES.find((item) => item.id === "waialae")!;
const player = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });
const trace = traceHole({
  course,
  hole: course.holes[0]!,
  score: 4,
  player,
  windMph: 9,
  seed: traceSeed("Waialae tracer preview", player.id, 1),
  round: 0,
});

/** Development-only review of the tracer in its eventual game context. */
export function WaialaeTracerPreview() {
  const [step, setStep] = useState(trace.shots.length);
  return (
    <main className="tracer-preview">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1>{player.name} · Sony Open in Hawaii</h1>
            <span className="secondary small">Round 1 · Hole 1 · Par 4 · 480 yds · Wind 9 mph</span>
          </div>
          <a className="btn btn-small" href={window.location.pathname}>Return to game</a>
        </div>
        <LiveScorecard course={course} scores={[4]} current={null} onPick={() => undefined} />
        <div className="tracer-preview-layout">
          <IllustratedTracer trace={trace} step={step} courseName={course.name} />
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
