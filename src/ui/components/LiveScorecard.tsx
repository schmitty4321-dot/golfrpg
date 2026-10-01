import type { Course } from "../../engine";
import { toPar } from "../format";

function cellClass(score: number, par: number): string {
  const d = score - par;
  if (d <= -2) return "sc sc-eagle";
  if (d === -1) return "sc sc-birdie";
  if (d === 1) return "sc sc-bogey";
  if (d >= 2) return "sc sc-double";
  return "sc";
}

/**
 * The round in progress as a real card: hole, yards and par, his score so far
 * (circles and squares as on every card) and where he stands against par,
 * with the hole he's on marked. Tap a score to watch that hole again.
 */
export function LiveScorecard({ course, scores, current, onPick, activeNineOnly = false }: { course: Course; scores: number[]; current: number | null; onPick?: (hole: number) => void; activeNineOnly?: boolean }) {
  const halves = [course.holes.slice(0, 9), course.holes.slice(9)];
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  let running = 0;
  const toParAfter = course.holes.map((h, i) => (i < scores.length ? (running += scores[i]! - h.par) : null));
  // On a phone only the nine being played is shown (the back nine's card carries the total).
  const nine = (current ?? scores.length - 1) >= 9 ? 1 : 0;
  return (
    <div className={`live-card${activeNineOnly ? " active-nine" : ""}`} aria-label="Scorecard">
      {halves.map((holes, half) => {
        if (activeNineOnly && half !== nine) return null;
        const played = scores.slice(half * 9, half * 9 + 9);
        return (
          <table className={`scorecard live-scorecard${half === nine ? "" : " sc-other-nine"}`} key={half}>
            <thead>
              <tr>
                <th scope="row">Hole</th>
                {holes.map((h) => <th key={h.number} className={h.number - 1 === current ? "sc-now" : undefined}>{h.number}</th>)}
                <th>{half === 0 ? "Out" : "In"}</th>
                {half === 1 && <th>Tot</th>}
              </tr>
            </thead>
            <tbody>
              <tr className="muted">
                <td>Yds</td>
                {holes.map((h) => <td key={h.number} className={h.number - 1 === current ? "sc-now" : undefined}>{h.yards}</td>)}
                <td>{sum(holes.map((h) => h.yards)).toLocaleString("en-US")}</td>
                {half === 1 && <td>{sum(course.holes.map((h) => h.yards)).toLocaleString("en-US")}</td>}
              </tr>
              <tr className="muted">
                <td>Par</td>
                {holes.map((h) => <td key={h.number} className={h.number - 1 === current ? "sc-now" : undefined}>{h.par}</td>)}
                <td>{sum(holes.map((h) => h.par))}</td>
                {half === 1 && <td>{sum(course.holes.map((h) => h.par))}</td>}
              </tr>
              <tr className="sc-score">
                <td>Score</td>
                {holes.map((h, i) => {
                  const idx = half * 9 + i;
                  const s = scores[idx];
                  return (
                    <td key={h.number} className={idx === current ? "sc-now" : undefined}>
                      {s === undefined ? (
                        <span className="sc sc-empty" />
                      ) : onPick ? (
                        <button className="sc-button" onClick={() => onPick(idx)} title={`Watch hole ${idx + 1} again`} aria-label={`Hole ${idx + 1}: ${s}. Watch it again.`}>
                          <span className={cellClass(s, h.par)}>{s}</span>
                        </button>
                      ) : (
                        <span className={cellClass(s, h.par)}>{s}</span>
                      )}
                    </td>
                  );
                })}
                <td><strong>{played.length ? sum(played) : ""}</strong></td>
                {half === 1 && <td><strong>{scores.length ? sum(scores) : ""}</strong></td>}
              </tr>
              <tr className="muted small">
                <td>To par</td>
                {holes.map((h, i) => {
                  const idx = half * 9 + i;
                  const v = toParAfter[idx];
                  return <td key={h.number} className={`${idx === current ? "sc-now " : ""}${v !== null && v !== undefined && v < 0 ? "good-text" : ""}`}>{v === null || v === undefined ? "" : toPar(v)}</td>;
                })}
                <td />
                {half === 1 && <td />}
              </tr>
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
