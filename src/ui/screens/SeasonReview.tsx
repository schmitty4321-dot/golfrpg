import { STATUS_LABELS, type SeasonSummary } from "../../season";
import { money, plural, toPar } from "../format";

export function SeasonReview({ summary, onClose }: { summary: SeasonSummary; onClose: () => void }) {
  const c = summary.client;
  const lostCard = c.statusAfter === "none";
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="modal">
        <div>
          <h1 id="review-title" style={{ fontSize: 22 }}>Season {summary.season} review</h1>
          <p className="secondary" style={{ marginBottom: 0 }}>
            {c.name}: {plural(c.events, "start")}, {plural(c.cutsMade, "cut")} made, {plural(c.top10s, "top-10")}, {plural(c.wins, "win")}.
          </p>
        </div>
        <div className="stat-row">
          <div className="stat"><span className="stat-label">Points list</span><span className="stat-value">{c.pointsRank ? `#${c.pointsRank}` : "—"}</span><span className="stat-sub">{c.points} pts</span></div>
          <div className="stat"><span className="stat-label">World rank</span><span className="stat-value">#{c.owgrRank}</span></div>
          <div className="stat"><span className="stat-label">Earnings</span><span className="stat-value">{money(c.earnings)}</span></div>
          <div className="stat"><span className="stat-label">Your commission</span><span className="stat-value">{money(c.finances.commission)}</span></div>
        </div>
        <div className="panel" style={{ background: lostCard ? "var(--neg-soft)" : "var(--accent-soft)", boxShadow: "none" }}>
          <strong>Next season: {STATUS_LABELS[c.statusAfter]}.</strong>{" "}
          {lostCard
            ? "He's lost his card: every start next year has to come through a Monday qualifier."
            : c.statusBefore !== c.statusAfter
              ? `Up from ${STATUS_LABELS[c.statusBefore].toLowerCase()}.`
              : "Status kept."}
        </div>
        <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Points leaders</h3>
            <table>
              <tbody>
                {summary.pointsLeaders.map((l, i) => (
                  <tr key={l.name}><td>{i + 1}</td><td>{l.name}</td><td className="num">{l.points}</td><td className="num muted">{plural(l.wins, "win")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginBottom: 6 }}>Major champions</h3>
            <table>
              <tbody>
                {summary.majors.map((m) => (
                  <tr key={m.event}><td>{m.event}</td><td>{m.winner}</td><td className="num">{toPar(m.toPar)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div><button className="btn btn-primary" onClick={onClose}>Start season {summary.season + 1}</button></div>
      </div>
    </div>
  );
}
