import type { Course } from "../../engine";

function cellClass(score: number, par: number): string {
  const d = score - par;
  if (d <= -2) return "sc sc-eagle";
  if (d === -1) return "sc sc-birdie";
  if (d === 1) return "sc sc-bogey";
  if (d >= 2) return "sc sc-double";
  return "sc";
}

/** Hole-by-hole card: circles for birdies and better, squares for bogeys and worse. */
export function Scorecard({ course, rounds, onPick }: { course: Course; rounds: number[][]; onPick?: (round: number, hole: number) => void }) {
  const halves = [course.holes.slice(0, 9), course.holes.slice(9)];
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  return (
    <div className="table-wrap">
      {halves.map((holes, half) => (
        <table className="scorecard" key={half} style={{ marginBottom: 8 }}>
          <thead>
            <tr>
              <th>Hole</th>
              {holes.map((h) => <th key={h.number}>{h.number}</th>)}
              <th>{half === 0 ? "Out" : "In"}</th>
              {half === 1 && <th>Tot</th>}
            </tr>
            <tr>
              <td>Par</td>
              {holes.map((h) => <td key={h.number} className="muted">{h.par}</td>)}
              <td className="muted">{sum(holes.map((h) => h.par))}</td>
              {half === 1 && <td className="muted">{sum(course.holes.map((h) => h.par))}</td>}
            </tr>
          </thead>
          <tbody>
            {rounds.map((card, r) => {
              const part = card.slice(half * 9, half * 9 + 9);
              return (
                <tr key={r}>
                  <td>R{r + 1}</td>
                  {part.map((s, i) => (
                    <td key={i}>
                      {onPick ? (
                        <button className="sc-button" onClick={() => onPick(r, half * 9 + i)} title={`Watch hole ${half * 9 + i + 1}, round ${r + 1}`} aria-label={`Hole ${half * 9 + i + 1}, round ${r + 1}: ${s}. Watch the shots.`}>
                          <span className={cellClass(s, holes[i]!.par)}>{s}</span>
                        </button>
                      ) : (
                        <span className={cellClass(s, holes[i]!.par)}>{s}</span>
                      )}
                    </td>
                  ))}
                  <td><strong>{sum(part)}</strong></td>
                  {half === 1 && <td><strong>{sum(card)}</strong></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
      <p className="muted small" style={{ margin: 0 }}>Circle: birdie (filled: eagle). Square: bogey (filled: double or worse).{onPick ? " Click a score to watch the shots." : ""}</p>
    </div>
  );
}
