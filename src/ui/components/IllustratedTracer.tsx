import type { HoleTrace, Pt, Shot } from "../../engine";
import { artForTrace, projectArtPoint, type ArtEntry } from "../illustratedArt";

const SHOT_COLORS = ["#ffd84f", "#53d8ff", "#ff6d63", "#f7f4df", "#d59cff", "#ffad4a"];
export function hasIllustratedTracerArt(trace: HoleTrace): boolean {
  return artForTrace(trace) !== undefined;
}

/**
 * Projects tee-at-zero tracer coordinates onto a flat illustration. Three
 * calibrated course landmarks (normally tee, landing area, and green) are
 * enough to solve this affine transform, so the artwork does not need to be
 * produced by the geometry renderer.
 */
function project(art: ArtEntry, point: Pt): Pt {
  return projectArtPoint(art.matrix, point);
}

function arc(art: ArtEntry, shot: Shot): string {
  const a = project(art, shot.from);
  const b = project(art, shot.to);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = shot.kind === "putt" ? 34 : Math.min(180, Math.max(72, distance * 0.28));
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2 - lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function IllustratedTracer({ trace, step, courseName }: { trace: HoleTrace; step: number; courseName: string }) {
  const art = artForTrace(trace);
  if (!art) return null;
  const shots = trace.shots.filter((shot) => shot.kind !== "penalty");
  const revealed = shots.slice(0, step);
  const finalShot = revealed[revealed.length - 1];

  return (
    <section className="illustrated-replay" aria-label={`Illustrated replay of ${courseName}, hole ${trace.layout.real?.hole ?? 1}`}>
      <div className="illustrated-stage">
        <img src={`${import.meta.env.BASE_URL}${art.image}`} alt={`Elevated illustrated view of ${courseName} Hole ${trace.layout.real?.hole ?? 1}`} />
        <div className="illustrated-hole-card">
          <span>Hole {trace.layout.real?.hole ?? 1}</span>
          <strong>Playing line</strong>
          <p>Follow the mapped corridor from the tee through the landing area to the guarded green.</p>
          <dl>
            <div><dt>{trace.layout.yards}</dt><dd>Yards</dd></div>
            <div><dt>{trace.layout.par}</dt><dd>Par</dd></div>
            <div><dt>{trace.score || "—"}</dt><dd>Score</dd></div>
          </dl>
        </div>
        <svg className="illustrated-arcs" viewBox={`0 0 ${art.width} ${art.height}`} aria-hidden>
          {revealed.map((shot, index) => {
            const start = project(art, shot.from);
            const end = project(art, shot.to);
            const color = SHOT_COLORS[index % SHOT_COLORS.length]!;
            return (
              <g key={`${shot.stroke}-${index}`} className={index === revealed.length - 1 ? "is-current" : undefined}>
                <path className="illustrated-arc-shadow" d={arc(art, shot)} />
                <path className="illustrated-arc" d={arc(art, shot)} stroke={color} pathLength={1} />
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
