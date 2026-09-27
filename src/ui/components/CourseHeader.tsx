import { coursePar, courseYards, holeBaseline, holeLayout, type Course, type Hole } from "../../engine";
import { useHoleMap } from "../holeMaps";
import { HoleDrawing } from "./ShotTracer";

const COUNTRY: Record<string, string> = { USA: "USA", PUR: "Puerto Rico", CAN: "Canada", SCO: "Scotland", ENG: "England", DOM: "Dominican Republic", JPN: "Japan", BER: "Bermuda", MEX: "Mexico" };

/** The venue's photo, with the credit its licence asks for. */
export function CoursePhoto({ course }: { course: Course }) {
  const photo = course.info?.photo;
  if (!photo) return null;
  return (
    <figure className="course-photo">
      <img src={`${import.meta.env.BASE_URL}${photo.file}`} alt={course.name} loading="lazy" />
      <figcaption>
        Photo: <a href={photo.page} target="_blank" rel="noreferrer">{photo.artist || "Wikimedia Commons"}</a>,{" "}
        {photo.licenseUrl ? <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> : photo.license}
      </figcaption>
    </figure>
  );
}

/** One line of facts about the course: where it is, who built it, how it plays. */
export function CourseFacts({ course }: { course: Course }) {
  const i = course.info;
  return (
    <>
      <span>
        {course.name}
        {i ? `, ${i.city}${i.country !== "USA" ? `, ${COUNTRY[i.country] ?? i.country}` : ""}` : ` (${course.style})`}
      </span>
      <span>par {coursePar(course)}, {courseYards(course).toLocaleString("en-US")} yds</span>
      {i?.designer && <span>{i.designer}{i.established ? `, ${i.established}` : ""}</span>}
    </>
  );
}

/**
 * Stroke index (the scorecard's handicap row): the hardest hole is 1. As on a
 * real card, the front nine takes the odd numbers and the back nine the even.
 */
export function strokeIndex(course: Course): Map<number, number> {
  const calm = { windMph: { AM: 0, PM: 0 }, rain: false };
  const hardness = (h: Hole) => (h.tourAverage ?? holeBaseline(h, course, calm)) - h.par;
  const out = new Map<number, number>();
  [course.holes.slice(0, 9), course.holes.slice(9)].forEach((nine, n) => {
    [...nine].sort((a, b) => hardness(b) - hardness(a)).forEach((h, i) => out.set(h.number, i * 2 + 1 + n));
  });
  return out;
}

function HoleThumb({ course, hole }: { course: Course; hole: Hole }) {
  const layout = holeLayout(course, hole);
  const map = useHoleMap(layout.real);
  return (
    <div className="sc-thumb" title={`Hole ${hole.number}: par ${hole.par}, ${hole.yards} yards`}>
      <HoleDrawing trace={{ layout, shots: [], score: 0, result: "" }} step={0} photo={false} map={map} />
    </div>
  );
}

function Nine({ course, holes, label, index, total }: { course: Course; holes: Hole[]; label: "Out" | "In"; index: Map<number, number>; total: boolean }) {
  const real = course.holes.some((h) => h.tourAverage !== undefined);
  const sum = (f: (h: Hole) => number, hs = holes) => hs.reduce((s, h) => s + f(h), 0);
  const avg = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);
  const all = course.holes;
  return (
    <div className="sc-nine">
      <div className="sc-thumbs" style={{ gridTemplateColumns: `var(--sc-label) repeat(${holes.length}, minmax(0, 1fr)) var(--sc-sum)${total ? " var(--sc-tot)" : ""}` }}>
        <span />
        {holes.map((h) => <HoleThumb key={h.number} course={course} hole={h} />)}
        <span />
        {total && <span />}
      </div>
      <table className="sc-table">
        <tbody>
          <tr className="sc-hole">
            <th>Hole</th>
            {holes.map((h) => <th key={h.number}>{h.number}</th>)}
            <th>{label}</th>
            {total && <th className="sc-tot">Tot</th>}
          </tr>
          <tr className="sc-yards">
            <th>Yards</th>
            {holes.map((h) => <td key={h.number}>{h.yards}</td>)}
            <td>{sum((h) => h.yards).toLocaleString("en-US")}</td>
            {total && <td className="sc-tot">{sum((h) => h.yards, all).toLocaleString("en-US")}</td>}
          </tr>
          <tr className="sc-par">
            <th>Par</th>
            {holes.map((h) => <td key={h.number}>{h.par}</td>)}
            <td>{sum((h) => h.par)}</td>
            {total && <td className="sc-tot">{sum((h) => h.par, all)}</td>}
          </tr>
          <tr className="sc-hcp">
            <th><span className="sc-long">Handicap</span><span className="sc-short">Hcp</span></th>
            {holes.map((h) => <td key={h.number} className={index.get(h.number) === 1 || index.get(h.number) === 2 ? "sc-hardest" : undefined}>{index.get(h.number)}</td>)}
            <td />
            {total && <td className="sc-tot" />}
          </tr>
          {real && (
            <tr className="sc-avg">
              <th><span className="sc-long">Field avg</span><span className="sc-short">Avg</span></th>
              {holes.map((h) => <td key={h.number}>{h.tourAverage === undefined ? "" : avg(h.tourAverage - h.par)}</td>)}
              <td>{avg(sum((h) => (h.tourAverage ?? h.par) - h.par))}</td>
              {total && <td className="sc-tot">{avg(sum((h) => (h.tourAverage ?? h.par) - h.par, all))}</td>}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** The course as a printed scorecard: every hole drawn, the yardage played, par and handicap. */
export function CourseCard({ course }: { course: Course }) {
  const real = course.holes.some((h) => h.tourAverage !== undefined);
  const index = strokeIndex(course);
  const hardest = course.holes.find((h) => index.get(h.number) === 1)!;
  return (
    <section className="panel scorecard-panel">
      <div className="panel-head">
        <h2>Scorecard</h2>
        <span className="secondary small">
          {course.info?.estimated
            ? "No hole-by-hole data yet: a stand-in layout"
            : real
              ? `${course.info?.source ?? "PGA TOUR"}; field average to par on each hole`
              : "Fictional venue"}
        </span>
      </div>
      <div className="course-scorecard">
        <div className="sc-banner">
          <span>{course.name}</span>
          <span>Tournament tees · par {coursePar(course)} · {courseYards(course).toLocaleString("en-US")} yds</span>
        </div>
        <div className="sc-nines">
          <Nine course={course} holes={course.holes.slice(0, 9)} label="Out" index={index} total={false} />
          <Nine course={course} holes={course.holes.slice(9)} label="In" index={index} total />
        </div>
      </div>
      <p className="secondary small" style={{ marginBottom: 0 }}>
        Handicap 1 is the hardest hole: the {hardest.number}{ordinal(hardest.number)}, a {hardest.yards}-yard par {hardest.par}
        {hardest.tourAverage !== undefined ? ` (field average ${hardest.tourAverage.toFixed(3)})` : ""}.
      </p>
    </section>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
}
