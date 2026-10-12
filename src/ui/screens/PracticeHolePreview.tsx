import { useEffect, useRef, useState } from "react";
import { createRng, REAL_COURSES, generatePlayer } from "../../engine";
import { clubCarry, playPracticeShot, startPracticeHole, type PracticeHole, type PracticeStroke } from "../../engine/practiceHole";
import { sweetSpotMs, type SwingClub, type SwingLie, type SwingShot } from "../../engine/swing";
import { illustratedArtFor, projectArtPoint, type ArtMatrix } from "../illustratedArt";

// Development review of a practice hole, played shot by shot. The swing is the broadcast three-click
// (public/swing/broadcast-swing.html), shown in a frame below the picture. The landing target is a marker
// on the picture: drag it, and the swing's power and the tracer both work towards it.
const course = REAL_COURSES.find((c) => c.id === "waialae")!;
const player = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });
const LIE_LABEL: Record<string, string> = { tee: "Tee", fairway: "Fairway", rough: "Rough", bunker: "Bunker", green: "Green", water: "Water", holed: "Holed" };
const SWING_LIE: Record<string, SwingLie> = { tee: "fairway", fairway: "fairway", rough: "light", bunker: "fairwaySand", green: "greenSand" };

interface SwingStrike { power: number; timingMs: number }
interface SwingElement extends HTMLElement { golfSwing?: { configure: (options: Record<string, unknown>) => boolean } }
type Pt = { x: number; y: number };

/** Picture pixels back to course yards: the inverse of the picture's projection. */
function unprojectArtPoint(m: ArtMatrix, px: number, py: number): Pt {
  const [a, b, c] = m.x;
  const [d, e, f] = m.y;
  const det = a * e - b * d;
  const u = px - c;
  const v = py - f;
  return { x: (e * u - b * v) / det, y: (-d * u + a * v) / det };
}

/** The broadcast swing, in its own frame so its script and styles run as they were written. */
function BroadcastSwing({ lie, club, shot, targetPower, onStrike, onSwingStart, onSwingEnd }: {
  lie: SwingLie; club: SwingClub; shot: SwingShot; targetPower: number; onStrike: (s: SwingStrike) => void; onSwingStart: () => void; onSwingEnd: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const latestStrike = useRef(onStrike);
  latestStrike.current = onStrike;
  const onStartRef = useRef(onSwingStart);
  onStartRef.current = onSwingStart;
  const onEndRef = useRef(onSwingEnd);
  onEndRef.current = onSwingEnd;
  const swing = (): SwingElement | null => (frame.current?.contentDocument?.getElementById("golf-bar") as SwingElement | null) ?? null;

  useEffect(() => {
    const el = swing();
    if (!ready || !el) return;
    const onShot = (e: Event) => {
      const d = (e as CustomEvent<{ power: number; timingMs: number }>).detail;
      latestStrike.current({ power: d.power, timingMs: d.timingMs });
      onEndRef.current();
    };
    el.addEventListener("golf-shot", onShot);
    // The swing begins on its first press (the Swing button, or Space or Enter in the frame); its cancel button ends it.
    const doc = frame.current?.contentDocument;
    const onDown = (e: Event) => {
      const t = e.target as Element | null;
      if (t?.closest?.("#gb-swing")) onStartRef.current();
    };
    const onKey = (e: Event) => {
      const k = e as KeyboardEvent;
      if ((k.code === "Space" || k.code === "Enter") && !k.repeat) onStartRef.current();
    };
    const onCancel = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("#gb-cancel")) onEndRef.current();
    };
    doc?.addEventListener("pointerdown", onDown, true);
    doc?.addEventListener("keydown", onKey, true);
    doc?.addEventListener("click", onCancel, true);
    return () => {
      el.removeEventListener("golf-shot", onShot);
      doc?.removeEventListener("pointerdown", onDown, true);
      doc?.removeEventListener("keydown", onKey, true);
      doc?.removeEventListener("click", onCancel, true);
    };
  }, [ready]);

  useEffect(() => {
    // Aim comes from the target on the picture, so the swing's own aim stays straight.
    swing()?.golfSwing?.configure({ lie, club, shot, aim: 0, target: Math.max(10, Math.min(110, targetPower)), wind: 0, crosswind: 0, shape: 0, strength: 50, height: 0 });
  }, [ready, lie, club, shot, targetPower]);

  return <iframe ref={frame} src={`${import.meta.env.BASE_URL}swing/broadcast-swing.html`} title="Three-click swing" onLoad={() => setReady(true)} style={{ width: "100%", height: 400, border: 0 }} />;
}

/** How high a shot climbs at its peak, in picture pixels: longer shots go higher. */
function apexHeight(yards: number): number {
  return Math.min(180, yards * 0.5);
}

/** Where the ball is part-way through its flight: along the ground track, lifted in a parabola above it. */
function flightPoint(a: Pt, b: Pt, t: number, apex: number) {
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const lift = 4 * apex * t * (1 - t);
  return { x, y, lift, ballY: y - lift, scale: 1 + (lift / Math.max(apex, 1)) * 0.25 };
}

const SHOT_ANIMATION_MS = 1100;

/** Runs the flight from 0 to 1 each time a new stroke is played; the flight line and the yards box both read it. */
function useFlight(strokeCount: number): number {
  const [progress, setProgress] = useState(1);
  const count = useRef(strokeCount);
  useEffect(() => {
    if (strokeCount === count.current) return;
    count.current = strokeCount;
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
  }, [strokeCount]);
  return progress;
}

/** The yards box in the bottom right of the picture: counts up with the flight and stops on the landing distance. */
function YardsBox({ strokes, progress }: { strokes: PracticeStroke[]; progress: number }) {
  const last = strokes[strokes.length - 1];
  const yards = last ? Math.round(last.yards * progress) : 0;
  return (
    <div aria-live="off" style={{ position: "absolute", right: 14, bottom: 14, padding: "8px 14px", borderRadius: 8, background: "rgba(10, 20, 15, 0.78)", color: "#fff", fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 110, textAlign: "right", pointerEvents: "none" }}>
      {yards} <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.8 }}>yds</span>
    </div>
  );
}

/** The shot lines on the picture. The newest stroke climbs and falls to where it landed, with its shadow on the ground. */
function ShotLines({ strokes, progress, dot, ball, width, height }: { strokes: PracticeStroke[]; progress: number; dot: (p: Pt) => Pt; ball: Pt; width: number; height: number }) {
  const last = strokes.length - 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
      {strokes.map((s, i) => {
        const a = dot(s.from);
        const b = dot(s.to);
        const color = s.penalty ? "#ff5a4a" : "#bce764";
        const apex = apexHeight(s.yards);
        if (i === last && progress < 1) {
          const p = flightPoint(a, b, progress, apex);
          const shadowOpacity = 0.25 + 0.25 * (1 - p.lift / Math.max(apex, 1));
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={5} strokeDasharray="1 1" pathLength={1} strokeDashoffset={1 - progress} opacity={0.8} />
              <ellipse cx={p.x} cy={p.y} rx={16} ry={7} fill="#000" opacity={shadowOpacity} />
              <circle cx={p.x} cy={p.ballY} r={12 * p.scale} fill="#fff" stroke="#000" strokeWidth={3} />
            </g>
          );
        }
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={5} strokeDasharray="14 10" />
            <circle cx={b.x} cy={b.y} r={12} fill={color} stroke="#fff" strokeWidth={3} />
          </g>
        );
      })}
      {progress >= 1 && <circle cx={ball.x} cy={ball.y} r={18} fill="#fff" stroke="#000" strokeWidth={4} />}
    </svg>
  );
}

export function PracticeHolePreview() {
  const hole = course.holes[0]!;
  const [state, setState] = useState<PracticeHole>(() => startPracticeHole(course, hole, 0));
  const progress = useFlight(state.strokes.length);
  const [club, setClub] = useState<SwingClub>("driver");
  const [target, setTarget] = useState<Pt | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const picture = useRef<HTMLDivElement>(null);
  const art = illustratedArtFor("waialae", 1)!;
  const base = import.meta.env.BASE_URL;
  const lie = (LIE_LABEL[state.lie] ? state.lie : "fairway") as string;
  const swingLie = SWING_LIE[lie] ?? "fairway";
  const playClub: SwingClub = lie === "green" ? "wedge" : club;
  const windowMs = sweetSpotMs(player, playClub, swingLie);
  const carry = clubCarry(player, playClub);
  // Where he's aiming: the marker, or the pin until he moves it.
  const aimAt: Pt = target ?? state.layout.pin;
  const toTarget = Math.hypot(aimAt.x - state.ball.x, aimAt.y - state.ball.y);
  const power = Math.min(110, Math.round((toTarget / carry) * 100));
  const [swinging, setSwinging] = useState(false);
  const flying = progress < 1;
  // The target and its yardage show only between shots: not during a swing, not in flight.
  const showTarget = !flying && !swinging && !state.holed;

  const dot = (p: Pt) => projectArtPoint(art.matrix, p);

  // Dragging the target: the pointer on the picture, converted to yards and kept on the hole's map.
  const dragTo = (clientX: number, clientY: number) => {
    const rect = picture.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((clientX - rect.left) / rect.width) * art.width;
    const py = ((clientY - rect.top) / rect.height) * art.height;
    const yards = unprojectArtPoint(art.matrix, px, py);
    const b = state.layout.bounds;
    setTarget({ x: Math.max(b.minX, Math.min(b.maxX, yards.x)), y: Math.max(b.minY, Math.min(b.maxY, yards.y)) });
  };
  const startDrag = (e: React.PointerEvent) => {
    if (!showTarget) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => dragTo(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    dragTo(e.clientX, e.clientY);
  };

  const onStrike = (strike: SwingStrike) => {
    if (state.holed) return;
    const next = playPracticeShot(state, player, { club: playClub, power: strike.power, timingMs: strike.timingMs, aim: 0, target: aimAt });
    const s = next.strokes[next.strokes.length - 1] as PracticeStroke;
    setState(next);
    setLog((l) => [...l, `${s.stroke}. ${s.penalty ? "Into the water, penalty, back to where it was struck" : `${Math.round(s.yards)} yds to ${LIE_LABEL[s.lieAfter] ?? s.lieAfter}`} · timing ${Math.round(strike.timingMs)} ms · power ${Math.round(strike.power)}%`]);
  };
  const reset = () => {
    setState(startPracticeHole(course, hole, 0));
    setLog([]);
    setTarget(null);
  };

  const marker = dot(aimAt);
  const ballPx = dot(state.ball);
  return (
    <main className="tracer-preview practice-hole">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1>Practice · {course.name}, hole 1</h1>
            <span className="secondary small">Par {hole.par} · {hole.yards} yds · {player.name} · lie: {LIE_LABEL[state.lie] ?? state.lie} · {Math.round(toTarget)} yds to the target · sweet spot ±{windowMs} ms</span>
          </div>
          <a className="btn btn-small" href={window.location.pathname}>Return to game</a>
        </div>
        <div className="practice-picture" ref={picture} style={{ position: "relative", touchAction: "none" }}>
          <img src={`${base}${art.image}`} alt={`${course.name}, hole 1`} style={{ width: "100%", display: "block" }} />
          <svg viewBox={`0 0 ${art.width} ${art.height}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
            {showTarget && <line x1={ballPx.x} y1={ballPx.y} x2={marker.x} y2={marker.y} stroke="#fff" strokeWidth={3} strokeDasharray="6 8" opacity={0.6} />}
          </svg>
          {showTarget && (
            <div style={{ position: "absolute", left: `${(((ballPx.x + marker.x) / 2) / art.width) * 100}%`, top: `${(((ballPx.y + marker.y) / 2) / art.height) * 100}%`, transform: "translate(-50%, -50%)", padding: "4px 10px", borderRadius: 6, background: "rgba(10, 20, 15, 0.8)", color: "#ffd60a", fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", pointerEvents: "none" }}>
              {Math.round(toTarget)} yds
            </div>
          )}
          <ShotLines strokes={state.strokes} progress={progress} dot={dot} ball={ballPx} width={art.width} height={art.height} />
          {showTarget && (
            <div
              role="slider"
              aria-label="Landing target: drag to move"
              onPointerDown={startDrag}
              style={{ position: "absolute", left: `${(marker.x / art.width) * 100}%`, top: `${(marker.y / art.height) * 100}%`, width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: "50%", border: "3px solid #ffd60a", background: "rgba(255, 214, 10, 0.25)", boxShadow: "0 0 0 2px rgba(0,0,0,0.5)", cursor: "grab", touchAction: "none" }}
            />
          )}
          <YardsBox strokes={state.strokes} progress={progress} />
        </div>
        <div className="practice-controls">
          <div className="btn-row" aria-label="Club">
            {(["driver", "iron", "wedge"] as const).map((c) => (
              <button key={c} className={`btn btn-small${club === c ? " btn-primary" : ""}`} onClick={() => setClub(c)} disabled={lie === "green"}>{c === "driver" ? "Driver" : c === "iron" ? "7 iron" : "Wedge"}</button>
            ))}
            <button className="btn btn-small" onClick={() => setTarget(null)} disabled={flying || target === null}>Move target to the pin</button>
          </div>
          <span className="secondary small">Drag the yellow target on the picture. Power to reach it: {power}%.</span>
          <BroadcastSwing lie={swingLie} club={playClub} shot={lie === "green" ? "splash" : "normal"} targetPower={power} onStrike={onStrike} onSwingStart={() => setSwinging(true)} onSwingEnd={() => setSwinging(false)} />
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
