import { coursePar, courseYards, type Course } from "../../engine";

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

/** Hole by hole: par, yardage and, for real courses, how the tour field scored. */
export function CourseCard({ course }: { course: Course }) {
  const real = course.holes.some((h) => h.tourAverage !== undefined);
  const nines = [course.holes.slice(0, 9), course.holes.slice(9)];
  const avg = (x: number | undefined, par: number) => (x === undefined ? "" : (x - par >= 0 ? "+" : "") + (x - par).toFixed(2));
  const hardest = real ? [...course.holes].sort((a, b) => (b.tourAverage ?? 0) - b.par - ((a.tourAverage ?? 0) - a.par))[0] : undefined;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>The course</h2>
        <span className="secondary small">
          {course.info?.estimated
            ? "No hole-by-hole data yet: a stand-in layout"
            : real
              ? `${course.info?.source ?? "PGA TOUR"}; tour field's average to par on each hole`
              : "Fictional venue"}
        </span>
      </div>
      <div className="table-wrap">
        <table className="course-card">
          {nines.map((holes, n) => (
            <tbody key={n}>
              <tr><th>Hole</th>{holes.map((h) => <th key={h.number} className="num">{h.number}</th>)}<th className="num">{n === 0 ? "Out" : "In"}</th></tr>
              <tr><td>Par</td>{holes.map((h) => <td key={h.number} className="num">{h.par}</td>)}<td className="num">{holes.reduce((s, h) => s + h.par, 0)}</td></tr>
              <tr><td>Yards</td>{holes.map((h) => <td key={h.number} className="num">{h.yards}</td>)}<td className="num">{holes.reduce((s, h) => s + h.yards, 0).toLocaleString("en-US")}</td></tr>
              {real && (
                <tr className="secondary">
                  <td>Tour avg</td>
                  {holes.map((h) => <td key={h.number} className={`num${h === hardest ? " hardest" : ""}`}>{avg(h.tourAverage, h.par)}</td>)}
                  <td className="num">{avg(holes.reduce((s, h) => s + (h.tourAverage ?? h.par), 0), holes.reduce((s, h) => s + h.par, 0))}</td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>
      {hardest && <p className="secondary small" style={{ marginBottom: 0 }}>Hardest hole: the {hardest.number}{ordinal(hardest.number)}, a {hardest.yards}-yard par {hardest.par} (tour average {hardest.tourAverage!.toFixed(3)}).</p>}
    </section>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
}
