import { useMemo, useState, type MouseEvent } from "react";
import { holeLayout, REAL_COURSES, type Pt } from "../../engine";
import { illustratedArtFor, projectArtPoint, solveArtMatrix, type ArtMatrix, type CalibrationAnchor } from "../illustratedArt";

const LABELS = ["Tee", "Landing area", "Green"];
const pad = (value: number) => String(value).padStart(2, "0");

function defaultImage(courseId: string, hole: number): string {
  return `art-demo/${courseId}/hole-${pad(hole)}-${hole === 2 ? "course.png" : "illustrated.jpg"}`;
}

/** Development-only click tool for mapping tracer yard coordinates onto finished illustrations. */
export function IllustrationCalibrator() {
  const query = new URLSearchParams(window.location.search);
  const courseId = query.get("course") ?? "waialae";
  const hole = Math.min(18, Math.max(1, Number(query.get("hole")) || 1));
  const course = REAL_COURSES.find((candidate) => candidate.id === courseId);
  const holeData = course?.holes[hole - 1];
  const geometry = course && holeData ? holeLayout(course, holeData) : undefined;
  const image = query.get("image") ?? defaultImage(courseId, hole);
  const dimensions = { width: 1672, height: 941 };

  const world = useMemo<Pt[]>(() => {
    if (!geometry) return [];
    const middle = geometry.path[Math.floor(geometry.path.length / 2)]!;
    return [
      geometry.path[0]!,
      middle,
      geometry.green,
    ];
  }, [geometry]);
  const [pixels, setPixels] = useState<Pt[]>(() => {
    const existing = illustratedArtFor(courseId, hole);
    return existing && world.length === 3 ? world.map((point) => projectArtPoint(existing.matrix, point)) : [];
  });
  const [copied, setCopied] = useState(false);
  const anchors = pixels.map((pixel, index) => ({ pixel, world: world[index]! }));
  let matrix: ArtMatrix | undefined;
  let error: string | undefined;
  if (anchors.length === 3) {
    try {
      matrix = solveArtMatrix(anchors as CalibrationAnchor[]);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  if (!course || !geometry) {
    return <main><section className="panel"><h1>Illustration calibrator</h1><p>No mapped geometry exists for {courseId} Hole {hole}.</p></section></main>;
  }

  const clickImage = (event: MouseEvent<HTMLDivElement>) => {
    if (pixels.length >= 3) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPixels((current) => [...current, {
      x: Math.round(((event.clientX - bounds.left) / bounds.width) * dimensions.width),
      y: Math.round(((event.clientY - bounds.top) / bounds.height) * dimensions.height),
    }]);
    setCopied(false);
  };
  const path = matrix ? geometry.path.map((point) => projectArtPoint(matrix!, point)) : [];
  const entry = matrix ? {
    image,
    ...dimensions,
    matrix,
    meta: { number: hole, par: holeData!.par, yards: holeData!.yards, tourAverage: holeData!.tourAverage, course: course.name },
  } : undefined;
  const snippet = entry ? JSON.stringify({ [`${courseId}:${hole}`]: entry }, null, 2) : "";

  return (
    <main className="calibrator">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1>Illustration calibrator</h1>
            <p className="secondary">{course.name} · Hole {hole} · {pixels.length < 3 ? `click the ${LABELS[pixels.length]}` : "alignment ready; use Undo to adjust"}</p>
          </div>
          <div className="btn-row">
            <button className="btn btn-small" disabled={pixels.length === 0} onClick={() => setPixels((current) => current.slice(0, -1))}>Undo</button>
            <button className="btn btn-small" disabled={pixels.length === 0} onClick={() => setPixels([])}>Reset</button>
            <a className="btn btn-small" href={`?demo=waialae-tracer&hole=${hole}`}>Open replay</a>
          </div>
        </div>
        <div className="calibration-layout">
          <div className="calibration-stage" onClick={clickImage} role="button" tabIndex={0} aria-label={`Click ${LABELS[pixels.length] ?? "anchors complete"}`}>
            <img src={`${import.meta.env.BASE_URL}${image}`} alt={`${course.name} Hole ${hole} illustration to calibrate`} />
            <svg viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} aria-hidden>
              {path.length > 1 && <polyline points={path.map((point) => `${point.x},${point.y}`).join(" ")} />}
              {pixels.map((point, index) => (
                <g key={index} className="calibration-anchor">
                  <circle cx={point.x} cy={point.y} r="20" />
                  <text x={point.x} y={point.y + 7}>{index + 1}</text>
                </g>
              ))}
            </svg>
          </div>
          <aside className="calibration-controls">
            <h2>Three-point alignment</h2>
            <ol>
              {world.map((point, index) => (
                <li key={LABELS[index]} className={pixels[index] ? "done" : index === pixels.length ? "current" : ""}>
                  <strong>{LABELS[index]}</strong>
                  <span>World {point.x.toFixed(1)}, {point.y.toFixed(1)}{pixels[index] ? ` → pixel ${pixels[index]!.x.toFixed(0)}, ${pixels[index]!.y.toFixed(0)}` : ""}</span>
                </li>
              ))}
            </ol>
            {error && <p className="bad-text">{error}</p>}
            {entry && (
              <>
                <button className="btn btn-primary" onClick={() => void navigator.clipboard.writeText(snippet).then(() => setCopied(true))}>{copied ? "Copied" : "Copy manifest entry"}</button>
                <textarea className="calibration-output" readOnly value={snippet} aria-label="Generated manifest entry" />
              </>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
