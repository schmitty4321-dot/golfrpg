import { useMemo, useRef } from "react";
import type { PracticeStroke } from "../../engine/practiceHole";
import type { HoleLayout, Pt } from "../../engine/tracer";
import { pictureLieAt, type ArtEntry } from "../illustratedArt";

/** How far from the green centre the top-down view reaches, in yards. */
const REACH = 30;
/** Sampling step for the sand and water around the green, in yards. */
const STEP = 1.5;

interface Props {
  layout: HoleLayout;
  /** The painting the sand and water are read from. */
  art: ArtEntry;
  ball: Pt;
  aim: Pt;
  strokes: PracticeStroke[];
  progress: number;
  showAim: boolean;
  onAim: (p: Pt) => void;
}

/**
 * The green from above, in yards: the putting surface and fringe from the course layout, with the
 * sand and water beside it read from the hole picture. Forward (away from the tee) is up the screen.
 */
export function GreenTopDown({ layout, art, ball, aim, strokes, progress, showAim, onAim }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const g = layout.green;
  // Yards from the green centre to a point on the course, with forward pointing up the screen.
  const toView = (p: Pt) => ({ x: p.x - g.x, y: -(p.y - g.y) });

  const hazards = useMemo(() => {
    const out: { x: number; y: number; kind: "bunker" | "water" }[] = [];
    for (let dx = -REACH; dx <= REACH; dx += STEP) {
      for (let dy = -REACH; dy <= REACH; dy += STEP) {
        const kind = pictureLieAt(art, { x: g.x + dx, y: g.y + dy });
        if (kind === "bunker" || kind === "water") out.push({ x: dx, y: -dy, kind });
      }
    }
    return out;
  }, [art, g.x, g.y]);

  const dragAim = (e: React.PointerEvent) => {
    if (!showAim) return;
    e.preventDefault();
    const place = (clientX: number, clientY: number) => {
      const rect = svg.current?.getBoundingClientRect();
      if (!rect) return;
      const fx = (clientX - rect.left) / rect.width;
      const fy = (clientY - rect.top) / rect.height;
      // Back from the view to the course: x as is, screen y flipped (up is forward).
      onAim({ x: g.x + (-REACH + fx * 2 * REACH), y: g.y - (-REACH + fy * 2 * REACH) });
    };
    const move = (ev: PointerEvent) => place(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    place(e.clientX, e.clientY);
  };

  const pin = toView(layout.pin);
  const ballAt = toView(ball);
  const aimAt = toView(aim);
  const feetToPin = Math.round(Math.hypot(ball.x - layout.pin.x, ball.y - layout.pin.y) * 3);
  const last = strokes.length - 1;

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#3f7d2a", borderRadius: 8, overflow: "hidden" }}>
      <svg
        ref={svg}
        viewBox={`${-REACH} ${-REACH} ${2 * REACH} ${2 * REACH}`}
        onPointerDown={dragAim}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: showAim ? "crosshair" : "default" }}
        aria-label="Top-down view of the green"
      >
        {/* The fringe and the putting surface. */}
        <circle cx={0} cy={0} r={g.r + 1.2} fill="#5aa23c" />
        <circle cx={0} cy={0} r={g.r} fill="#84c75a" />
        {/* Sand and water beside the green, read from the picture. */}
        {hazards.map((h, i) => (
          <rect key={i} x={h.x - STEP / 2} y={h.y - STEP / 2} width={STEP} height={STEP} fill={h.kind === "bunker" ? "#e8d7a0" : "#3d86c6"} />
        ))}
        {/* Shot lines: earlier shots in full, the latest flying in. */}
        {strokes.map((s, i) => {
          const from = toView(s.from);
          const to = toView(s.to);
          const end = i === last ? { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress } : to;
          return <line key={i} x1={from.x} y1={from.y} x2={end.x} y2={end.y} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={0.35} strokeDasharray="1 0.8" />;
        })}
        {/* The pin. */}
        <line x1={pin.x} y1={pin.y} x2={pin.x} y2={pin.y - 3.5} stroke="#f4f5ef" strokeWidth={0.3} />
        <path d={`M ${pin.x} ${pin.y - 3.5} l 1.6 0.6 l -1.6 0.6 Z`} fill="#e53935" />
        <circle cx={pin.x} cy={pin.y} r={0.35} fill="#101010" />
        {/* The ball. */}
        {progress >= 1 && <circle cx={ballAt.x} cy={ballAt.y} r={0.6} fill="#ffffff" stroke="#000" strokeWidth={0.25} />}
        {/* The aim marker: a yellow ring the player drags. */}
        {showAim && <circle cx={aimAt.x} cy={aimAt.y} r={1.1} fill="rgba(255, 214, 10, 0.3)" stroke="#ffd60a" strokeWidth={0.3} />}
      </svg>
      <div style={{ position: "absolute", top: 8, left: 8, padding: "4px 10px", borderRadius: 6, background: "rgba(10, 20, 15, 0.8)", color: "#fff", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}>
        {feetToPin} ft to the pin
      </div>
    </div>
  );
}
