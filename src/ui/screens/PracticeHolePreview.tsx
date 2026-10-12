import { useEffect, useRef, useState } from "react";
import { createRng, REAL_COURSES, generatePlayer } from "../../engine";
import { clubCarry, playPracticeShot, puttPower, startPracticeHole, type PracticeHole, type PracticeStroke } from "../../engine/practiceHole";
import { meterFactor, sweetSpotMs, type SwingClub, type SwingLie, type SwingShot } from "../../engine/swing";
import { illustratedArtFor, pictureLieAt, projectArtPoint, type ArtMatrix } from "../illustratedArt";
import { GreenTopDown } from "../components/GreenTopDown";
import { pointAt, projectAlong, type HoleLayout } from "../../engine/tracer";

// Development review of a practice hole, played shot by shot. The swing is the broadcast three-click
// (public/swing/broadcast-swing.html), shown in a frame below the picture. The landing target is a marker
// on the picture: drag it, and the swing's power and the tracer both work towards it.
const course = REAL_COURSES.find((c) => c.id === "waialae")!;
// Two golfers who take turns: an excellent player and a poor one, to see how the meter differs.
function golferAt(seed: number, level: number, label: string) {
  const p = generatePlayer(createRng(seed), { tier: "tour", nationality: "USA" });
  const skills = ["drivingDistance", "drivingAccuracy", "longIrons", "fairwayWoods", "midIrons", "wedges", "distanceControl", "chipping", "pitching", "bunkerPlay"];
  for (const k of skills) (p.attributes as unknown as Record<string, number>)[k] = level;
  p.name = `${p.name} (${label})`;
  return p;
}
const PLAYERS = [golferAt(19, 20, "excellent"), golferAt(23, 4, "poor")];
const LIE_LABEL: Record<string, string> = { tee: "Tee", fairway: "Fairway", rough: "Rough", bunker: "Bunker", tree: "Trees", green: "Green", water: "Water", holed: "Holed" };
const SWING_LIE: Record<string, SwingLie> = { tee: "tee", fairway: "fairway", rough: "light", bunker: "fairwaySand", tree: "tree", green: "green" };

interface SwingStrike { power: number; timingMs: number }
interface SwingElement extends HTMLElement { golfSwing?: { configure: (options: Record<string, unknown>) => boolean } }
type Pt = { x: number; y: number };

/** The usual target for a club: its carry from the ball, along the line of play (the middle of the fairway), short of the pin. */
function fairwayTarget(layout: HoleLayout, ball: Pt, carry: number): Pt {
  const toPin = projectAlong(layout.path, layout.pin);
  const along = Math.min(toPin, projectAlong(layout.path, ball) + carry);
  return pointAt(layout.path, along, 0);
}

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
function BroadcastSwing({ lie, club, shot, speed, targetPower, onStrike, onSwingStart, onSwingEnd, onClubPick }: {
  lie: SwingLie; club: SwingClub; shot: SwingShot; speed: number; targetPower: number; onStrike: (s: SwingStrike) => void; onSwingStart: () => void; onSwingEnd: () => void; onClubPick: (c: SwingClub) => void;
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

  // The club the player picks in the frame goes back to the page, so the page and the frame agree.
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    const pick = doc?.getElementById("gb-club") as HTMLSelectElement | null | undefined;
    const onPick = () => { if (pick) onClubPick(pick.value as SwingClub); };
    pick?.addEventListener("input", onPick);
    return () => pick?.removeEventListener("input", onPick);
  }, [ready]);
  // Only the settings the page owns are sent, and only when they change: a re-send would overwrite the player's own picks.
  useEffect(() => { swing()?.golfSwing?.configure({ lie, shot }); }, [ready, lie, shot]);
  useEffect(() => { swing()?.golfSwing?.configure({ club }); }, [ready, club]);
  // The meter runs at the player's speed for this club: a stronger player has a slower meter.
  useEffect(() => { swing()?.golfSwing?.configure({ speed }); }, [ready, speed]);
  useEffect(() => { swing()?.golfSwing?.configure({ target: Math.max(10, Math.min(110, targetPower)), aim: 0 }); }, [ready, targetPower]);

  return <iframe ref={frame} src={`${import.meta.env.BASE_URL}swing/broadcast-swing.html`} title="Three-click swing" onLoad={() => setReady(true)} style={{ width: "100%", height: 306, border: 0 }} />;
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

/** A picture the ball can be aimed on: its size, and how yards map onto its pixels. */
type PlateView = { width: number; height: number; matrix: ArtMatrix };

/** Golf's order: the golfer farther from the hole plays next. A golfer who has holed is skipped. */
function nextToPlay(balls: PracticeHole[], pin: Pt, last: number): number {
  const open = balls.map((_, i) => i).filter((i) => !balls[i]!.holed);
  if (open.length === 0) return last;
  if (open.length === 1) return open[0]!;
  const away = (i: number) => Math.hypot(balls[i]!.ball.x - pin.x, balls[i]!.ball.y - pin.y);
  return away(1) > away(0) ? 1 : 0;
}

export function PracticeHolePreview() {
  const hole = course.holes[0]!;
  // Each golfer has his own ball; the one to play is picked by nextToPlay. history is every stroke in order.
  const [balls, setBalls] = useState<PracticeHole[]>(() => [startPracticeHole(course, hole, 0), startPracticeHole(course, hole, 0)]);
  const [history, setHistory] = useState<PracticeStroke[]>([]);
  const progress = useFlight(history.length);
  const [club, setClub] = useState<SwingClub>("driver");
  const [target, setTarget] = useState<Pt | null>(null);
  const [turn, setTurn] = useState(0);
  const state = balls[turn]!;
  // Only the golfer whose turn it is shows his ball and shot info. The view moves to him as his turn starts, when the shot before him lands.
  const [shown, setShown] = useState(0);
  // The next golfer comes up 1.5 seconds after the ball lands, so the landing can be seen first.
  useEffect(() => {
    if (progress < 1) return;
    const t = window.setTimeout(() => {
      setShown(turn);
      setCamGolfer(null);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [progress]);
  // The approach cam: the golfer whose shot landed within 30 yards, kept up with its flight and resting spot until the next swing starts.
  const [camGolfer, setCamGolfer] = useState<number | null>(null);
  const camBall = balls[camGolfer ?? shown]!;
  const allHoled = balls.every((b) => b.holed);
  // The column lists the golfer whose turn it is, so the next golfer is shown as soon as the shot before him lands.
  const showGolfer = (i: number) => allHoled || i === shown;
  const shownBall = balls[shown]!;
  // The lie picture is the lie where the ball landed, straight away; it moves to the next golfer when his turn comes up.
  const boxLie = SWING_LIE[shownBall.lie] ?? "fairway";
  const player = PLAYERS[turn]!;
  const [log, setLog] = useState<string[]>([]);
  const picture = useRef<HTMLDivElement>(null);
  const insetRef = useRef<HTMLDivElement>(null);
  const art = illustratedArtFor("waialae", 1)!;
  // Bunkers and water are taken from the painting, so a ball lies where the picture shows sand or water.
  const pictureAt = (p: Pt) => pictureLieAt(art, p);
  // Within 50 yards of the pin, a bordered close-up of the green sits over the top half of the picture.
  // It's a crop of the same painting, centred between the ball and the pin so both stay in view.
  const cropW = 420;
  const cropH = 280;
  const midAt = projectArtPoint(art.matrix, { x: (camBall.ball.x + state.layout.pin.x) / 2, y: (camBall.ball.y + state.layout.pin.y) / 2 });
  const x0 = Math.max(0, Math.min(art.width - cropW, midAt.x - cropW / 2));
  const y0 = Math.max(0, Math.min(art.height - cropH, midAt.y - cropH / 2));
  const view: PlateView = { width: art.width, height: art.height, matrix: art.matrix };
  const insetMatrix: ArtMatrix = { x: [art.matrix.x[0], art.matrix.x[1], art.matrix.x[2] - x0], y: [art.matrix.y[0], art.matrix.y[1], art.matrix.y[2] - y0] };
  const insetView: PlateView = { width: cropW, height: cropH, matrix: insetMatrix };
  const insetDot = (p: Pt) => projectArtPoint(insetMatrix, p);
  const base = import.meta.env.BASE_URL;
  const lie = (LIE_LABEL[state.lie] ? state.lie : "fairway") as string;
  const swingLie = SWING_LIE[lie] ?? "fairway";
  const playClub: SwingClub = lie === "green" ? "putter" : club === "putter" ? "wedge" : club;
  const windowMs = sweetSpotMs(player, playClub, swingLie);
  const carry = clubCarry(player, playClub);
  // Where he's aiming: the marker, or the pin until he moves it.
  const aimAt: Pt = target ?? state.layout.pin;
  const toTarget = Math.hypot(aimAt.x - state.ball.x, aimAt.y - state.ball.y);
  const power = state.lie === "green" ? Math.round(puttPower(toTarget)) : Math.min(110, Math.round((toTarget / carry) * 100));
  const [swinging, setSwinging] = useState(false);
  const flying = progress < 1;
  // At the start of each shot, and when the club changes, the target goes to the club's usual carry on the fairway.
  useEffect(() => {
    if (state.lie === "green") {
      // A putt starts aimed 30 feet (10 yards) from the ball toward the hole, or at the hole when it is closer.
      const d = Math.hypot(state.layout.pin.x - state.ball.x, state.layout.pin.y - state.ball.y);
      setTarget(d <= 10 ? state.layout.pin : { x: state.ball.x + ((state.layout.pin.x - state.ball.x) * 10) / d, y: state.ball.y + ((state.layout.pin.y - state.ball.y) * 10) / d });
    } else {
      setTarget(fairwayTarget(state.layout, state.ball, clubCarry(player, playClub)));
    }
  }, [playClub, state.strokes.length, turn]);
  // The target and its yardage show only between shots: not during a swing, not in flight.
  const showTarget = !flying && !swinging && !state.holed && shown === turn;
  // The overhead view: within 30 yards of the pin when the golfer's turn starts.
  const toPin = Math.hypot(state.ball.x - state.layout.pin.x, state.ball.y - state.layout.pin.y);
  const overhead = !flying && shown === turn && toPin <= 30;
  const near = !overhead && camGolfer !== null;

  const dot = (p: Pt) => projectArtPoint(view.matrix, p);

  // Dragging the target: the pointer over a picture (the full hole or the close-up), converted to yards and kept on the hole's map.
  const dragTo = (clientX: number, clientY: number, el: HTMLElement | null, v: PlateView) => {
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    const px = ((clientX - rect.left) / rect.width) * v.width;
    const py = ((clientY - rect.top) / rect.height) * v.height;
    const yards = unprojectArtPoint(v.matrix, px, py);
    const b = state.layout.bounds;
    setTarget({ x: Math.max(b.minX, Math.min(b.maxX, yards.x)), y: Math.max(b.minY, Math.min(b.maxY, yards.y)) });
  };
  const startDrag = (e: React.PointerEvent, el: HTMLElement | null, v: PlateView) => {
    if (!showTarget) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => dragTo(ev.clientX, ev.clientY, el, v);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    dragTo(e.clientX, e.clientY, el, v);
  };

  const onStrike = (strike: SwingStrike) => {
    if (state.holed) return;
    const next = playPracticeShot(state, player, { club: playClub, power: strike.power, timingMs: strike.timingMs, aim: 0, target: aimAt }, pictureAt);
    const s = next.strokes[next.strokes.length - 1] as PracticeStroke;
    const nextBalls = balls.map((b, i) => (i === turn ? next : b));
    setBalls(nextBalls);
    setHistory((h) => [...h, s]);
    setTurn(nextToPlay(nextBalls, state.layout.pin, turn));
    setCamGolfer(!next.holed && Math.hypot(s.to.x - state.layout.pin.x, s.to.y - state.layout.pin.y) <= 30 ? turn : null);
    setLog((l) => [...l, `${player.name} · shot ${s.stroke}. ${s.penalty ? "Into the water, penalty, back to where it was struck" : `${Math.round(s.yards)} yds to ${LIE_LABEL[s.lieAfter] ?? s.lieAfter}`} · timing ${Math.round(strike.timingMs)} ms · power ${Math.round(strike.power)}%`]);
  };
  const reset = () => {
    setBalls([startPracticeHole(course, hole, 0), startPracticeHole(course, hole, 0)]);
    setHistory([]);
    setLog([]);
    setTarget(null);
    setTurn(0);
    setShown(0);
    setCamGolfer(null);
  };

  const strokesBy = (i: number) => balls[i]!.strokes.length;
  const marker = dot(aimAt);
  const ballPx = dot(shownBall.ball);
  return (
    <main className="tracer-preview practice-hole">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1>Practice · {course.name}, hole 1</h1>
            <span className="secondary small">Par {hole.par} · {hole.yards} yds · {PLAYERS[shown]!.name} · lie: {LIE_LABEL[shownBall.lie] ?? shownBall.lie} · {Math.round(toTarget)} yds to the target · sweet spot ±{windowMs} ms</span>
          </div>
          <a className="btn btn-small" href={window.location.pathname}>Return to game</a>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="practice-picture" ref={picture} style={{ position: "relative", touchAction: "none", flex: "3 1 380px", minWidth: 0 }}>
          {overhead ? (
            <GreenTopDown layout={state.layout} ball={state.ball} aim={aimAt} strokes={shownBall.strokes} progress={progress} showAim={showTarget} onAim={setTarget} />
          ) : (<>
          <img src={`${base}${art.image}`} alt={`${course.name}, hole 1`} style={{ width: "100%", display: "block" }} />
          <svg viewBox={`0 0 ${view.width} ${view.height}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
          </svg>
          {showTarget && !near && (
            <div style={{ position: "absolute", left: `${(((ballPx.x + marker.x) / 2) / view.width) * 100}%`, top: `${(((ballPx.y + marker.y) / 2) / view.height) * 100}%`, transform: "translate(-50%, -50%)", padding: "4px 10px", borderRadius: 6, background: "rgba(10, 20, 15, 0.8)", color: "#ffd60a", fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", pointerEvents: "none" }}>
              {Math.round(toTarget)} yds
            </div>
          )}
          <ShotLines strokes={shownBall.strokes} progress={progress} dot={dot} ball={ballPx} width={view.width} height={view.height} />
          {showTarget && !near && (
            <div
              role="slider"
              aria-label="Landing target: drag to move"
              onPointerDown={(e) => startDrag(e, picture.current, view)}
              style={{ position: "absolute", left: `${(marker.x / view.width) * 100}%`, top: `${(marker.y / view.height) * 100}%`, width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: "50%", border: "3px solid #ffd60a", background: "rgba(255, 214, 10, 0.25)", boxShadow: "0 0 0 2px rgba(0,0,0,0.5)", cursor: "grab", touchAction: "none" }}
            />
          )}
          {near && (
            <div ref={insetRef} style={{ position: "absolute", top: 8, left: 8, width: "50%", aspectRatio: `${cropW} / ${cropH}`, overflow: "hidden", border: "3px solid #ffd60a", borderRadius: 8, boxShadow: "0 6px 18px rgba(0, 0, 0, 0.5)", background: "#0a140e", zIndex: 2 }}>
              <img src={`${base}${art.image}`} alt="" style={{ position: "absolute", width: `${(art.width / cropW) * 100}%`, maxWidth: "none", left: `${(-x0 / cropW) * 100}%`, top: `${(-y0 / cropH) * 100}%` }} />
              <ShotLines strokes={camBall.strokes} progress={progress} dot={insetDot} ball={insetDot(camBall.ball)} width={cropW} height={cropH} />
              {showTarget && (
                <div
                  role="slider"
                  aria-label="Landing target: drag to move"
                  onPointerDown={(e) => startDrag(e, insetRef.current, insetView)}
                  style={{ position: "absolute", left: `${(insetDot(aimAt).x / cropW) * 100}%`, top: `${(insetDot(aimAt).y / cropH) * 100}%`, width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: "50%", border: "3px solid #ffd60a", background: "rgba(255, 214, 10, 0.25)", boxShadow: "0 0 0 2px rgba(0,0,0,0.5)", cursor: "grab", touchAction: "none" }}
                />
              )}
            </div>
          )}
          <YardsBox strokes={shownBall.strokes} progress={progress} />
          </>)}
        </div>
        <aside style={{ flex: "1 1 220px", minWidth: 220, border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 8, padding: 12 }}>
          {PLAYERS.map((p, i) => showGolfer(i) ? (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 8px", borderRadius: 6, background: !allHoled && shown === i ? "rgba(34, 238, 227, 0.2)" : "transparent", fontWeight: !allHoled && shown === i ? 700 : 400 }}>
              <span>{p.name}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{balls[i]!.holed ? `holed in ${balls[i]!.score}` : `${strokesBy(i)} ${strokesBy(i) === 1 ? "stroke" : "strokes"}`}</span>
            </div>
          ) : null)}
          <ol className="practice-log" style={{ listStyle: "none", padding: 0, margin: "10px 0 0", maxHeight: 420, overflowY: "auto" }}>
            {log.filter((l) => allHoled || l.startsWith(PLAYERS[shown]!.name)).map((line, i) => <li key={i} style={{ padding: "6px 0", borderTop: "1px solid rgba(0, 0, 0, 0.08)" }}>{line}</li>)}
            {balls.every((b) => b.holed) && <li style={{ padding: "6px 0", borderTop: "1px solid rgba(0, 0, 0, 0.08)" }}><strong>Hole finished (par {hole.par}): {PLAYERS.map((p, i) => `${p.name.split(" (")[0]} ${balls[i]!.score}`).join(" · ")}</strong></li>}
          </ol>
        </aside>
        </div>
        <div className="practice-controls">
          <div className="btn-row" aria-label="Club">
            {(["driver", "iron", "wedge", "putter"] as const).map((c) => (
              <button key={c} className={`btn btn-small${playClub === c ? " btn-primary" : ""}`} onClick={() => setClub(c)} disabled={(c === "putter") !== (lie === "green")}>{c === "driver" ? "Driver" : c === "iron" ? "7 iron" : c === "wedge" ? "Wedge" : "Putter"}</button>
            ))}
            <button className="btn btn-small" onClick={() => setTarget(null)} disabled={flying || target === null}>Move target to the pin</button>
          </div>
          <BroadcastSwing lie={boxLie} club={playClub} shot="normal" speed={meterFactor(player, playClub)} targetPower={power} onStrike={onStrike} onSwingStart={() => { setSwinging(true); setCamGolfer(null); }} onSwingEnd={() => setSwinging(false)} onClubPick={setClub} />
          <button className="btn" onClick={reset}>Start the hole again</button>
        </div>
      </section>
    </main>
  );
}
