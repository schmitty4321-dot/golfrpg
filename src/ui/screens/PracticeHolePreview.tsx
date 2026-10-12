import { useEffect, useRef, useState } from "react";
import { createRng, REAL_COURSES, generatePlayer } from "../../engine";
import { clubCarry, playPracticeShot, startPracticeHole, type PracticeHole, type PracticeStroke } from "../../engine/practiceHole";
import { sweetSpotMs, type SwingClub, type SwingLie, type SwingShot } from "../../engine/swing";
import { illustratedArtFor, projectArtPoint } from "../illustratedArt";

// Development review of a practice hole, played shot by shot. The swing is the broadcast three-click
// (public/swing/broadcast-swing.html), shown in a frame below the picture.
const course = REAL_COURSES.find((c) => c.id === "waialae")!;
const player = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });
const LIE_LABEL: Record<string, string> = { tee: "Tee", fairway: "Fairway", rough: "Rough", bunker: "Bunker", green: "Green", water: "Water", holed: "Holed" };
const SWING_LIE: Record<string, SwingLie> = { tee: "fairway", fairway: "fairway", rough: "light", bunker: "fairwaySand", green: "greenSand" };

interface SwingStrike { power: number; timingMs: number }
interface SwingElement extends HTMLElement { golfSwing?: { configure: (options: Record<string, unknown>) => boolean } }

/** The broadcast swing, in its own frame so its script and styles run as they were written. */
function BroadcastSwing({ lie, club, shot, aim, targetPower, onStrike }: {
  lie: SwingLie; club: SwingClub; shot: SwingShot; aim: number; targetPower: number; onStrike: (s: SwingStrike) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const latestStrike = useRef(onStrike);
  latestStrike.current = onStrike;
  const swing = (): SwingElement | null => (frame.current?.contentDocument?.getElementById("golf-bar") as SwingElement | null) ?? null;

  useEffect(() => {
    const el = swing();
    if (!ready || !el) return;
    const onShot = (e: Event) => {
      const d = (e as CustomEvent<{ power: number; timingMs: number }>).detail;
      latestStrike.current({ power: d.power, timingMs: d.timingMs });
    };
    el.addEventListener("golf-shot", onShot);
    return () => el.removeEventListener("golf-shot", onShot);
  }, [ready]);

  useEffect(() => {
    swing()?.golfSwing?.configure({ lie, club, shot, aim, target: Math.max(10, Math.min(110, targetPower)), wind: 0, crosswind: 0, shape: 0, strength: 50, height: 0 });
  }, [ready, lie, club, shot, aim, targetPower]);

  return <iframe ref={frame} src={`${import.meta.env.BASE_URL}swing/broadcast-swing.html`} title="Three-click swing" onLoad={() => setReady(true)} style={{ width: "100%", height: 400, border: 0 }} />;
}


/** Flight arc from a to b (SVG pixels): a quadratic curve bulging to one side, so a longer shot rises higher. */
function arcPoint(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bulge = len * 0.12;
  const cx = mx + (-dy / len) * bulge, cy = my + (dx / len) * bulge;
  return { x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y, cx, cy };
}

const SHOT_ANIMATION_MS = 1000;

/** The shot lines on the picture. The newest stroke is drawn in flight, then settles where it landed. */
function ShotLines({ strokes, dot, ball, width, height }: { strokes: PracticeStroke[]; dot: (p: { x: number; y: number }) => { x: number; y: number }; ball: { x: number; y: number }; width: number; height: number }) {
  const [progress, setProgress] = useState(1);
  const count = useRef(strokes.length);
  useEffect(() => {
    if (strokes.length === count.current) return;
    count.current = strokes.length;
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / SHOT_ANIMATION_MS);
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    setProgress(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [strokes.length]);

  const last = strokes.length - 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
      {strokes.map((s, i) => {
        const a = dot(s.from), b = dot(s.to);
        const color = s.penalty ? "#ff5a4a" : "#bce764";
        if (i === last && progress < 1) {
          const p = arcPoint(a, b, progress);
          const route = `M ${a.x} ${a.y} Q ${arcPoint(a, b, 0.5).cx} ${arcPoint(a, b, 0.5).cy} ${b.x} ${b.y}`;
          return <g key={i}><path d={route} fill="none" stroke={color} strokeWidth={6} strokeDasharray="1 1" pathLength={1} strokeDashoffset={1 - progress} /><circle cx={p.x} cy={p.y} r={12} fill="#fff" stroke="#000" strokeWidth={3} /></g>;
        }
        const route = `M ${a.x} ${a.y} Q ${arcPoint(a, b, 0.5).cx} ${arcPoint(a, b, 0.5).cy} ${b.x} ${b.y}`;
        return <g key={i}><path d={route} fill="none" stroke={color} strokeWidth={6} strokeDasharray="14 10" /><circle cx={b.x} cy={b.y} r={14} fill={color} stroke="#fff" strokeWidth={3} /></g>;
      })}
      {progress >= 1 && <circle cx={ball.x} cy={ball.y} r={18} fill="#fff" stroke="#000" strokeWidth={4} />}
    </svg>
  );
}

export function PracticeHolePreview() {
  const hole = course.holes[0]!;
  const [state, setState] = useState<PracticeHole>(() => startPracticeHole(course, hole, 0));
  const [club, setClub] = useState<SwingClub>("driver");
  const [aim, setAim] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const art = illustratedArtFor("waialae", 1)!;
  const base = import.meta.env.BASE_URL;
  const lie = (LIE_LABEL[state.lie] ? state.lie : "fairway") as string;
  const swingLie = SWING_LIE[lie] ?? "fairway";
  const playClub: SwingClub = lie === "green" ? "wedge" : club;
  const windowMs = sweetSpotMs(player, playClub, swingLie);
  const carry = clubCarry(player, playClub);
  const toPin = Math.hypot(state.layout.pin.x - state.ball.x, state.layout.pin.y - state.ball.y);
  const target = Math.min(110, Math.round((toPin / carry) * 100));

  const onStrike = (strike: SwingStrike) => {
    if (state.holed) return;
    const next = playPracticeShot(state, player, { club: playClub, power: strike.power, timingMs: strike.timingMs, aim });
    const s = next.strokes[next.strokes.length - 1] as PracticeStroke;
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
            <span className="secondary small">Par {hole.par} · {hole.yards} yds · {player.name} · lie: {LIE_LABEL[state.lie] ?? state.lie} · {Math.round(toPin)} yds to the pin · sweet spot ±{windowMs} ms</span>
          </div>
          <a className="btn btn-small" href={window.location.pathname}>Return to game</a>
        </div>
        <div className="practice-picture" style={{ position: "relative" }}>
          <img src={`${base}${art.image}`} alt={`${course.name}, hole 1`} style={{ width: "100%", display: "block" }} />
          <ShotLines strokes={state.strokes} dot={dot} ball={dot(state.ball)} width={art.width} height={art.height} />
        </div>
        <div className="practice-controls">
          <div className="btn-row" aria-label="Club">
            {(["driver", "iron", "wedge"] as const).map((c) => (
              <button key={c} className={`btn btn-small${club === c ? " btn-primary" : ""}`} onClick={() => setClub(c)} disabled={lie === "green"}>{c === "driver" ? "Driver" : c === "iron" ? "7 iron" : "Wedge"}</button>
            ))}
          </div>
          <label>Aim {aim > 0 ? `${aim} yd right` : aim < 0 ? `${-aim} yd left` : "at the pin"}<input type="range" min={-20} max={20} value={aim} onChange={(e) => setAim(Number(e.target.value))} /></label>
          <BroadcastSwing lie={swingLie} club={playClub} shot={lie === "green" ? "splash" : "normal"} aim={aim} targetPower={target} onStrike={onStrike} />
          <button className="btn" onClick={reset}>Start the hole again</button>
        </div>
        <ol className="practice-log">
          {log.map((line, i) => <li key={i}>{line}</li>)}
          {state.holed && <li><strong>Holed in {state.score} (par {hole.par})</strong></li>}
        </ol>
      </section>
    </main>
  );
}
