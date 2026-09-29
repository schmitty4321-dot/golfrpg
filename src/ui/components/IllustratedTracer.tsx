import type { HoleTrace, Pt, Shot } from "../../engine";

const ART_WIDTH = 1600;
const ART_HEIGHT = 900;
const artUrl = `${import.meta.env.BASE_URL}art-demo/waialae-hole-01-course.png`;
const SHOT_COLORS = ["#ffd84f", "#53d8ff", "#ff6d63", "#f7f4df", "#d59cff", "#ffad4a"];

export function hasIllustratedTracerArt(trace: HoleTrace): boolean {
  return trace.layout.real?.courseId === "waialae" && trace.layout.real.hole === 1;
}

/**
 * Projects the tracer's tee-at-zero yard coordinates onto the fixed oblique
 * camera used by Waialae Hole 1. Illustration and gameplay share the same
 * source geometry, so only the camera transform belongs in this layer.
 */
function project(trace: HoleTrace, point: Pt): Pt {
  const { minX, maxX, minY, maxY } = trace.layout.bounds;
  const along = (point.y - minY) / Math.max(1, maxY - minY);
  const across = (point.x - minX) / Math.max(1, maxX - minX) - 0.5;
  return {
    x: 190 + 1240 * along - 180 * across,
    y: 760 - 600 * along - 90 * across,
  };
}

function arc(trace: HoleTrace, shot: Shot): string {
  const a = project(trace, shot.from);
  const b = project(trace, shot.to);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = shot.kind === "putt" ? 34 : Math.min(180, Math.max(72, distance * 0.28));
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2 - lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function IllustratedTracer({ trace, step, courseName }: { trace: HoleTrace; step: number; courseName: string }) {
  const shots = trace.shots.filter((shot) => shot.kind !== "penalty");
  const revealed = shots.slice(0, step);
  const finalShot = revealed[revealed.length - 1];

  return (
    <section className="illustrated-replay" aria-label={`Illustrated replay of ${courseName}, hole ${trace.layout.real?.hole ?? 1}`}>
      <div className="illustrated-stage">
        <img src={artUrl} alt="Elevated illustrated view of Waialae Hole 1" />
        <div className="illustrated-hole-card">
          <span>Hole {trace.layout.real?.hole ?? 1}</span>
          <strong>Opening line</strong>
          <p>Find the striped fairway, then play uphill to the guarded green.</p>
          <dl>
            <div><dt>{trace.layout.yards}</dt><dd>Yards</dd></div>
            <div><dt>{trace.layout.par}</dt><dd>Par</dd></div>
            <div><dt>{trace.score || "—"}</dt><dd>Score</dd></div>
          </dl>
        </div>
        <svg className="illustrated-arcs" viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`} aria-hidden>
          {revealed.map((shot, index) => {
            const start = project(trace, shot.from);
            const end = project(trace, shot.to);
            const color = SHOT_COLORS[index % SHOT_COLORS.length]!;
            return (
              <g key={`${shot.stroke}-${index}`} className={index === revealed.length - 1 ? "is-current" : undefined}>
                <path className="illustrated-arc-shadow" d={arc(trace, shot)} />
                <path className="illustrated-arc" d={arc(trace, shot)} stroke={color} pathLength={1} />
                <circle className="illustrated-node-ring" cx={start.x} cy={start.y} r={19} stroke={color} />
                <circle className="illustrated-node" cx={start.x} cy={start.y} r={15} />
                <text x={start.x} y={start.y + 6}>{index + 1}</text>
                {index === revealed.length - 1 ? <circle className="illustrated-ball" cx={end.x} cy={end.y} r={7} /> : null}
              </g>
            );
          })}
        </svg>
        {finalShot !== undefined ? <div className="illustrated-live-caption">{finalShot.text}</div> : null}
      </div>
    </section>
  );
}
