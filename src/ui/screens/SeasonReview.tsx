import { STATUS_LABELS, type SeasonSummary } from "../../season";
import { money, plural, toPar } from "../format";

export function SeasonReview({ summary, onClose }: { summary: SeasonSummary; onClose: () => void }) {
  const l = summary.agency.ledger;
  const profit = l.prizeCommission + l.endorsementCommission - l.office - l.scouts;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="modal" style={{ maxWidth: 860 }}>
        <div>
          <h1 id="review-title" style={{ fontSize: 22 }}>Season {summary.season} review</h1>
          <p className="secondary" style={{ marginBottom: 0 }}>
            Agency profit {profit < 0 ? `−${money(-profit)}` : money(profit)} · reputation {Math.round(summary.agency.reputationBefore)} → {Math.round(summary.agency.reputationAfter)}
          </p>
        </div>
        {summary.clients.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th className="num">Starts</th><th className="num">Cuts</th><th className="num">Top 10s</th><th className="num">Wins</th><th className="num">Points</th><th className="num">World</th><th className="num">Earnings</th><th>Next season</th></tr></thead>
              <tbody>
                {summary.clients.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="num">{c.events}</td>
                    <td className="num">{c.cutsMade}</td>
                    <td className="num">{c.top10s}</td>
                    <td className="num">{c.wins}</td>
                    <td className="num">{c.pointsRank ? `#${c.pointsRank}` : "—"}</td>
                    <td className="num">#{c.owgrRank}</td>
                    <td className="num">{money(c.earnings)}</td>
                    <td className={c.statusAfter === "none" ? "bad-text" : ""}>{STATUS_LABELS[c.statusAfter]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {summary.agency.departures.length > 0 && (
          <div className="panel" style={{ background: "var(--neg-soft)", boxShadow: "none" }}>
            <strong>Leaving the agency:</strong> {summary.agency.departures.join(", ")}. Their contracts ran out without an extension.
          </div>
        )}
        <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Points leaders</h3>
            <table>
              <tbody>
                {summary.pointsLeaders.map((x, i) => (
                  <tr key={x.name}><td>{i + 1}</td><td>{x.name}</td><td className="num">{x.points}</td><td className="num muted">{plural(x.wins, "win")}</td></tr>
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
