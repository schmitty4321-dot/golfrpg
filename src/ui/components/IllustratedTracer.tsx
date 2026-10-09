import { holeNote, type HoleTrace, type Pt, type Shot } from "../../engine";
import { artForTrace, illustratedShotPaths } from "../illustratedArt";

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
function arc(a: Pt, b: Pt, shot: Shot): string {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = shot.kind === "putt" ? 34 : Math.min(180, Math.max(72, distance * 0.28));
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2 - lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function IllustratedTracer({ trace, step, courseName }: { trace: HoleTrace; step: number; courseName: string }) {
  const art = artForTrace(trace);
  if (!art) return null;
  const revealed = illustratedShotPaths(art, trace.shots.slice(0, step), trace.layout);
  const finalShot = revealed[revealed.length - 1]?.shot;
  const note = trace.layout.real ? holeNote(trace.layout.real.courseId, trace.layout.real.hole) : undefined;

  return (
    <section className={`illustrated-replay${art.displayOnly ? " display-only" : ""}`} aria-label={`Illustrated replay of ${courseName}, hole ${trace.layout.real?.hole ?? 1}`}>
      {/* The frame takes the painting's shape (Waialae is 16:9, La Quinta and Torrey 2:1). */}
      <div className="illustrated-stage" style={{ aspectRatio: `${art.width} / ${art.height}` }}>
        <img src={`${import.meta.env.BASE_URL}${art.image}`} alt={`Elevated illustrated view of ${courseName} Hole ${trace.layout.real?.hole ?? 1}`} />
        {!art.displayOnly && !art.meta?.framed && <div className="illustrated-hole-card">
          <span>Hole {trace.layout.real?.hole ?? 1}</span>
          <strong>{note?.name ?? "Playing line"}</strong>
          {note?.meaning && <em className="illustrated-hole-meaning">{note.meaning}</em>}
          {!note && <p>Follow the mapped corridor from the tee through the landing area to the guarded green.</p>}
          <dl>
            <div><dt>{trace.layout.yards}</dt><dd>Yards</dd></div>
            <div><dt>{trace.layout.par}</dt><dd>Par</dd></div>
            <div><dt>{trace.score || "—"}</dt><dd>Score</dd></div>
          </dl>
        </div>}
        {/* Cropped exactly like the painting (object-fit: cover), so the lines stay on it when the frame is squeezed. */}
        {!art.displayOnly && <svg className="illustrated-arcs" viewBox={`0 0 ${art.width} ${art.height}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
          {revealed.map(({ shot, start, end }, index) => {
            const color = SHOT_COLORS[(shot.stroke - 1) % SHOT_COLORS.length]!;
            if (shot.kind === "penalty") {
              return (
                <g key={`${shot.stroke}-${index}`} className={index === revealed.length - 1 ? "is-current" : undefined}>
                  <path className="illustrated-penalty-line" d={`M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`} />
                  <circle className="illustrated-penalty-node" cx={(start.x + end.x) / 2} cy={(start.y + end.y) / 2} r={17} />
                  <text className="illustrated-penalty-text" x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 + 6}>+1</text>
                  {index === revealed.length - 1 ? <circle className="illustrated-ball" cx={end.x} cy={end.y} r={7} /> : null}
                </g>
              );
            }
            return (
              <g key={`${shot.stroke}-${index}`} className={index === revealed.length - 1 ? "is-current" : undefined}>
                <path className="illustrated-arc-shadow" d={arc(start, end, shot)} />
                <path className="illustrated-arc" d={arc(start, end, shot)} stroke={color} pathLength={1} />
                <circle className="illustrated-node-ring" cx={start.x} cy={start.y} r={19} stroke={color} />
                <circle className="illustrated-node" cx={start.x} cy={start.y} r={15} />
                <text x={start.x} y={start.y + 6}>{shot.stroke}</text>
                {shot.lie === "water" || shot.lie === "ob" ? <text className="illustrated-hazard-text" x={end.x} y={end.y - 13}>{shot.lie === "water" ? "WATER" : "O.B."}</text> : null}
                {index === revealed.length - 1 ? <circle className="illustrated-ball" cx={end.x} cy={end.y} r={7} /> : null}
              </g>
            );
          })}
        </svg>}
        {finalShot !== undefined ? <div className="illustrated-live-caption">{finalShot.text}</div> : null}
      </div>
      {/* The hole's story sits under the painting, where it never covers the shots. */}
      {note && (
        <p className="illustrated-hole-note"><strong>{note.name}</strong>{note.meaning ? ` (${note.meaning})` : ""}: {note.description}</p>
      )}
    </section>
  );
}
