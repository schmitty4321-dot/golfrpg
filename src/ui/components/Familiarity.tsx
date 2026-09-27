import { familiarityLabel } from "../../engine";
import { courseById, familiarCourses, type World, type WorldPlayer } from "../../season";

/** The courses he knows best: a bar each, with the level in words. */
export function FamiliarityPanel({ world, wp, limit = 10 }: { world: World; wp: WorldPlayer; limit?: number }) {
  const rows = familiarCourses(wp).filter((r) => r.familiarity > 0).slice(0, limit);
  const tour = new Set(world.schedule.map((e) => e.courseId));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Course familiarity</h2>
        <span className="muted small">Local knowledge: better reads, knows where to miss, has seen the pins</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty" style={{ margin: 0 }}>He hasn't played any of the tour's courses yet.</p>
      ) : (
        <div className="fam-list">
          {rows.map((r) => {
            const course = tour.has(r.courseId) || world.courses.some((c) => c.id === r.courseId) ? courseById(world, r.courseId) : null;
            return (
              <div className="fam-row" key={r.courseId}>
                <span className="fam-name" title={course?.name}>{course?.name ?? r.courseId}</span>
                <span className="fam-bar" aria-hidden><span style={{ width: `${r.familiarity}%` }} /></span>
                <span className="fam-val">{Math.round(r.familiarity)}</span>
                <span className="fam-level small secondary">{familiarityLabel(r.familiarity)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
