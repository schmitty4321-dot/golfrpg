import type { HoleTrace, Pt, Shot } from "../../engine";
import generatedArt from "../illustratedArt.generated.json";

const SHOT_COLORS = ["#ffd84f", "#53d8ff", "#ff6d63", "#f7f4df", "#d59cff", "#ffad4a"];
interface ArtEntry {
  image: string;
  width: number;
  height: number;
  matrix?: { x: [number, number, number]; y: [number, number, number] };
  legacyNormalized?: boolean;
}
const ART = generatedArt as unknown as Record<string, ArtEntry>;
const LEGACY_WAIALAE_ONE: ArtEntry = {
  image: "art-demo/waialae-hole-01-course.png",
  width: 1600,
  height: 900,
  legacyNormalized: true,
};

function artFor(trace: HoleTrace): ArtEntry | undefined {
  const real = trace.layout.real;
  if (!real) return undefined;
  return ART[`${real.courseId}:${real.hole}`] ?? (real.courseId === "waialae" && real.hole === 1 ? LEGACY_WAIALAE_ONE : undefined);
}

export function hasIllustratedTracerArt(trace: HoleTrace): boolean {
  return artFor(trace) !== undefined;
}

/**
 * Projects tee-at-zero tracer coordinates onto a flat illustration. Three
 * calibrated course landmarks (normally tee, landing area, and green) are
 * enough to solve this affine transform, so the artwork does not need to be
 * produced by the geometry renderer.
 */
function project(trace: HoleTrace, art: ArtEntry, point: Pt): Pt {
  if (art.legacyNormalized) {
    const { minX, maxX, minY, maxY } = trace.layout.bounds;
    const along = (point.y - minY) / Math.max(1, maxY - minY);
    const across = (point.x - minX) / Math.max(1, maxX - minX) - 0.5;
    return { x: 190 + 1240 * along - 180 * across, y: 760 - 600 * along - 90 * across };
  }
  const [xx, xy, xo] = art.matrix!.x;
  const [yx, yy, yo] = art.matrix!.y;
  return {
    x: xx * point.x + xy * point.y + xo,
    y: yx * point.x + yy * point.y + yo,
  };
}

function arc(trace: HoleTrace, art: ArtEntry, shot: Shot): string {
  const a = project(trace, art, shot.from);
  const b = project(trace, art, shot.to);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = shot.kind === "putt" ? 34 : Math.min(180, Math.max(72, distance * 0.28));
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2 - lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function IllustratedTracer({ trace, step, courseName }: { trace: HoleTrace; step: number; courseName: string }) {
  const art = artFor(trace);
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
            const start = project(trace, art, shot.from);
            const end = project(trace, art, shot.to);
            const color = SHOT_COLORS[index % SHOT_COLORS.length]!;
            return (
              <g key={`${shot.stroke}-${index}`} className={index === revealed.length - 1 ? "is-current" : undefined}>
                <path className="illustrated-arc-shadow" d={arc(trace, art, shot)} />
                <path className="illustrated-arc" d={arc(trace, art, shot)} stroke={color} pathLength={1} />
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
