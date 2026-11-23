import { useId } from "react";
import type { HoleTrace, Pt, Shot } from "../../engine";

/** How close to the green (yards beyond its edge) the ball has to be before the green cam comes on. */
const NEAR = 22;

/** The green cam is on once the ball is on or around the green (and stays on until the hole is done). */
export function greenCamShots(trace: HoleTrace, step: number): Shot[] | null {
  const g = trace.layout.green;
  const shown = trace.shots.slice(0, step);
  const last = shown[shown.length - 1];
  if (!last) return null;
  const near = (p: Pt) => Math.hypot(p.x - g.x, p.y - g.y) <= g.r + NEAR;
  return near(last.to) || last.lie === "holed" ? shown : null;
}

/**
 * The green from above, drawn from the hole's layout: the green and fringe, nearby sand and water,
 * the pin, and every shot played on or around it, with feet left after each putt. It is turned so
 * the approach comes in from the bottom, the way the player sees it.
 */
export function GreenCam({ trace, step }: { trace: HoleTrace; step: number }) {
  const id = `gc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const shots = greenCamShots(trace, step);
  if (!shots) return null;
  const L = trace.layout;
  const g = L.green;
  // Turn the view so the first shot to arrive near the green came in from the bottom of the frame.
  const arrival = shots.find((s) => Math.hypot(s.to.x - g.x, s.to.y - g.y) <= g.r + NEAR) ?? shots[shots.length - 1]!;
  const inAngle = Math.atan2(g.y - arrival.from.y, g.x - arrival.from.x);
  const turn = Math.PI / 2 - inAngle;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  // Yards around the green centre, turned, with forward up the screen.
  const view = (p: Pt): Pt => {
    const x = p.x - g.x;
    const y = p.y - g.y;
    return { x: x * cos - y * sin, y: -(x * sin + y * cos) };
  };
  const half = g.r + 14;
  const local = shots.filter((s) => Math.hypot(s.to.x - g.x, s.to.y - g.y) <= g.r + NEAR + 6);
  const last = shots[shots.length - 1]!;
  const pin = view(L.pin);
  const ball = view(last.to);
  const holed = last.lie === "holed";
  const sand = L.bunkers.filter((b) => Math.hypot(b.x - g.x, b.y - g.y) <= half + b.r + 4);
  const water = L.water.filter((poly) => poly.some((p) => Math.hypot(p.x - g.x, p.y - g.y) <= half * 1.6));
  return (
    <div className="green-cam" aria-label="The green from above">
      <span className="green-cam-label">Green</span>
      <svg viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`} role="img" aria-label={`The green: ${last.text}`}>
        <defs>
          <clipPath id={`${id}-clip`}><rect x={-half} y={-half} width={half * 2} height={half * 2} /></clipPath>
          <radialGradient id={`${id}-green`} cx="45%" cy="40%" r="70%">
            <stop offset="0" stopColor="#7cc86a" />
            <stop offset="1" stopColor="#3f9446" />
          </radialGradient>
        </defs>
        <g clipPath={`url(#${id}-clip)`}>
          <rect x={-half} y={-half} width={half * 2} height={half * 2} fill="#2f6b34" />
          {water.map((poly, i) => (
            <polygon key={`w${i}`} points={poly.map((p) => { const q = view(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ")} fill="#2f7fb8" />
          ))}
          {sand.map((b, i) => { const q = view(b); return <circle key={`b${i}`} cx={q.x} cy={q.y} r={b.r} fill="#efe1b8" stroke="#d6c38f" strokeWidth={0.4} />; })}
          <circle cx={0} cy={0} r={g.r + 2.5} fill="#4c9a48" />
          <circle cx={0} cy={0} r={g.r} fill={`url(#${id}-green)`} />
          {local.map((s, i) => {
            const a = view(s.from);
            const b = view(s.to);
            const putt = s.kind === "putt";
            // A shot from beyond the frame comes in from its edge.
            const len = Math.hypot(a.x - b.x, a.y - b.y) || 1;
            const far = Math.hypot(a.x, a.y) > half * 1.3;
            const start = far ? { x: b.x + ((a.x - b.x) / len) * half * 1.2, y: b.y + ((a.y - b.y) / len) * half * 1.2 } : a;
            return (
              <g key={`s${i}`} className={putt ? "green-cam-putt" : "green-cam-shot"}>
                <line x1={start.x} y1={start.y} x2={b.x} y2={b.y} />
                {putt && !far ? <circle cx={a.x} cy={a.y} r={0.9} className="green-cam-mark" /> : null}
              </g>
            );
          })}
          <circle cx={pin.x} cy={pin.y} r={0.75} fill="#111" />
          <line x1={pin.x} y1={pin.y} x2={pin.x} y2={pin.y - 7} stroke="#fff" strokeWidth={0.45} />
          <path d={`M ${pin.x} ${pin.y - 7} l 4 1.3 l -4 1.3 z`} fill="#e0393e" />
          {!holed && <circle cx={ball.x} cy={ball.y} r={1.1} fill="#fff" stroke="#111" strokeWidth={0.3} />}
        </g>
      </svg>
      <span className="green-cam-caption">{holed ? "In the hole" : last.feet !== undefined ? `${last.feet} ft left` : ""}</span>
    </div>
  );
}
