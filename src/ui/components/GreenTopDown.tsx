import { useRef } from "react";
import type { PracticeStroke } from "../../engine/practiceHole";
import type { HoleLayout, Pt } from "../../engine/tracer";

/**
 * The photo of Waialae hole 1's green from above. The sand and water are in the photo, so the
 * layout only places the green, the pin and the ball on it.
 */
const PHOTO = {
  src: "art/greens/waialae-1-green.webp",
  width: 1536,
  height: 1024,
  /** The centre of the putting surface, in photo pixels. */
  centre: { x: 732, y: 430 },
  /** A point on the fairway the approach comes in from, in photo pixels: the way back to the tee. */
  back: { x: 200, y: 850 },
  /** The green's radius in photo pixels, matched to the course layout's green radius. */
  radiusPx: 383,
};

interface Props {
  layout: HoleLayout;
  ball: Pt;
  aim: Pt;
  strokes: PracticeStroke[];
  progress: number;
  showAim: boolean;
  onAim: (p: Pt) => void;
}

/**
 * The green from above, in yards. The photo is turned so the way back to the tee points down the
 * screen, and scaled to the layout's green radius. Forward (away from the tee) is up the screen.
 */
export function GreenTopDown({ layout, ball, aim, strokes, progress, showAim, onAim }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const g = layout.green;
  // Yards from the green centre to a point on the course, with forward pointing up the screen.
  const toView = (p: Pt) => ({ x: p.x - g.x, y: -(p.y - g.y) });
  // The view is centred between the ball and the pin, sized to show both with room around them.
  const mid = toView({ x: (ball.x + layout.pin.x) / 2, y: (ball.y + layout.pin.y) / 2 });
  const span = Math.max(Math.hypot(ball.x - layout.pin.x, ball.y - layout.pin.y) / 2 + 12, 18);

  // Turn the photo so the way back to the tee points down (the screen's y runs down), and scale it to the green.
  const backAngle = (Math.atan2(PHOTO.back.y - PHOTO.centre.y, PHOTO.back.x - PHOTO.centre.x) * 180) / Math.PI;
  const turn = 90 - backAngle;
  const scale = g.r / PHOTO.radiusPx;
  const photoTransform = `rotate(${turn}) scale(${scale}) translate(${-PHOTO.centre.x} ${-PHOTO.centre.y})`;

  const dragAim = (e: React.PointerEvent) => {
    if (!showAim) return;
    e.preventDefault();
    const place = (clientX: number, clientY: number) => {
      const rect = svg.current?.getBoundingClientRect();
      if (!rect) return;
      const fx = (clientX - rect.left) / rect.width;
      const fy = (clientY - rect.top) / rect.height;
      // Back from the view to the course: x as is, screen y flipped (up is forward).
      onAim({ x: g.x + mid.x - span + fx * 2 * span, y: g.y - (mid.y - span + fy * 2 * span) });
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
    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#4f8a2f", borderRadius: 8, overflow: "hidden" }}>
      <svg
        ref={svg}
        viewBox={`${mid.x - span} ${mid.y - span} ${2 * span} ${2 * span}`}
        onPointerDown={dragAim}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: showAim ? "crosshair" : "default" }}
        aria-label="Top-down view of the green"
      >
        <rect x={mid.x - span} y={mid.y - span} width={2 * span} height={2 * span} fill="#4f8a2f" />
        {/* The photo of the green, turned and scaled onto the layout. */}
        <image href={`${import.meta.env.BASE_URL}${PHOTO.src}`} x={0} y={0} width={PHOTO.width} height={PHOTO.height} transform={photoTransform} />
        {/* The tracer shows only while the latest shot is flying; earlier shots are not drawn on the green. */}
        {strokes.map((s, i) => {
          if (i !== last || progress >= 1) return null;
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
