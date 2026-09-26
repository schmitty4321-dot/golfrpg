import { STATUS_LABELS, type World } from "../../season";
import { money } from "../format";

export function Finances({ world }: { world: World }) {
  const f = world.finances;
  const net = f.prizeMoney - f.caddie - f.travel - f.commission;
  const rows: [string, number][] = [
    ["Prize money", f.prizeMoney],
    ["Caddie (weekly fee + share of winnings)", -f.caddie],
    ["Travel and accommodation", -f.travel],
    ["Your agency's commission", -f.commission],
  ];
  return (
    <main>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Your client's season {world.season}</h2></div>
          <table>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}><td>{k}</td><td className={`num ${v < 0 ? "bad-text" : ""}`}>{v < 0 ? `−${money(-v)}` : money(v)}</td></tr>
              ))}
              <tr><td><strong>Take-home</strong></td><td className="num"><strong>{net < 0 ? `−${money(-net)}` : money(net)}</strong></td></tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Your agency</h2></div>
          <div className="stat-row">
            <div className="stat"><span className="stat-label">Bank</span><span className="stat-value">{money(world.agencyBank)}</span></div>
            <div className="stat"><span className="stat-label">Commission rate</span><span className="stat-value">{Math.round(world.commissionRate * 100)}%</span></div>
            <div className="stat"><span className="stat-label">This season</span><span className="stat-value">{money(f.commission)}</span></div>
          </div>
          <p className="muted small">Signing more clients, sponsorship deals and staff costs arrive with the agency layer.</p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Past seasons</h2></div>
        {world.pastSeasons.length === 0 ? (
          <p className="empty">Your first season is still under way.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Season</th><th className="num">Starts</th><th className="num">Cuts</th><th className="num">Top 10s</th><th className="num">Wins</th><th className="num">Points rank</th><th className="num">Earnings</th><th className="num">Commission</th><th>Next season</th></tr></thead>
              <tbody>
                {world.pastSeasons.map((s) => (
                  <tr key={s.season}>
                    <td>{s.season}</td>
                    <td className="num">{s.client.events}</td>
                    <td className="num">{s.client.cutsMade}</td>
                    <td className="num">{s.client.top10s}</td>
                    <td className="num">{s.client.wins}</td>
                    <td className="num">{s.client.pointsRank ?? "–"}</td>
                    <td className="num">{money(s.client.earnings)}</td>
                    <td className="num">{money(s.client.finances.commission)}</td>
                    <td>{STATUS_LABELS[s.client.statusAfter]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
