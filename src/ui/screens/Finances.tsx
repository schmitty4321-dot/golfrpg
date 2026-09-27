import { STATUS_LABELS, weeklyScoutCost, OFFICE_COST, type World } from "../../season";
import { money } from "../format";

const cash = (n: number) => (n < 0 ? `−${money(-n)}` : money(n));

export function Finances({ world }: { world: World }) {
  const L = world.agency.ledger;
  const profit = L.prizeCommission + L.endorsementCommission - L.office - L.scouts;
  return (
    <main>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>{world.agency.name}: season {world.season}</h2></div>
          <table>
            <tbody>
              <tr><td>Commission on prize money</td><td className="num">{money(L.prizeCommission)}</td></tr>
              <tr><td>Commission on endorsements</td><td className="num">{money(L.endorsementCommission)}</td></tr>
              <tr><td>Office and staff</td><td className="num bad-text">{cash(-L.office)}</td></tr>
              <tr><td>Scouts</td><td className="num bad-text">{cash(-L.scouts)}</td></tr>
              <tr><td><strong>Profit so far</strong></td><td className={`num ${profit >= 0 ? "good-text" : "bad-text"}`}><strong>{cash(profit)}</strong></td></tr>
            </tbody>
          </table>
          <p className="muted small">Running costs: {money(OFFICE_COST + weeklyScoutCost(world))} a week during the season.</p>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Bank</h2></div>
          <div className="stat-row">
            <div className="stat"><span className="stat-label">Balance</span><span className={`stat-value ${world.agency.bank < 0 ? "bad-text" : ""}`}>{cash(world.agency.bank)}</span></div>
            <div className="stat"><span className="stat-label">Reputation</span><span className="stat-value">{Math.round(world.agency.reputation)}</span></div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Clients' money this season</h2><span className="muted small">What each client earns and spends; the agency's cut is the commission column</span></div>
        {world.clientIds.length === 0 ? (
          <p className="empty">No clients.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th className="num">Prize money</th><th className="num">Endorsements</th><th className="num">Caddie</th><th className="num">Travel</th><th className="num">Coaching</th><th className="num">Clubs</th><th className="num">Commission</th><th className="num">Take-home</th></tr></thead>
              <tbody>
                {world.clientIds.map((id) => {
                  const f = world.players[id]!.client!.finances;
                  const net = f.prizeMoney + f.endorsements - f.caddie - f.travel - f.coaching - (f.equipment ?? 0) - f.commission;
                  return (
                    <tr key={id}>
                      <td>{world.players[id]!.player.name}</td>
                      <td className="num">{money(f.prizeMoney)}</td>
                      <td className="num">{money(f.endorsements)}</td>
                      <td className="num">{cash(-f.caddie)}</td>
                      <td className="num">{cash(-f.travel)}</td>
                      <td className="num">{cash(-f.coaching)}</td>
                      <td className="num">{cash(-(f.equipment ?? 0))}</td>
                      <td className="num">{cash(-f.commission)}</td>
                      <td className={`num ${net >= 0 ? "" : "bad-text"}`}><strong>{cash(net)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Past seasons</h2></div>
        {world.pastSeasons.length === 0 ? (
          <p className="empty">Your first season is still under way.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Season</th><th>Clients</th><th className="num">Commission</th><th className="num">Costs</th><th className="num">Profit</th><th className="num">Reputation</th><th>Departures</th></tr></thead>
              <tbody>
                {world.pastSeasons.map((s) => {
                  const l = s.agency.ledger;
                  const inc = l.prizeCommission + l.endorsementCommission;
                  const cost = l.office + l.scouts;
                  return (
                    <tr key={s.season}>
                      <td>{s.season}</td>
                      <td className="small">{s.clients.map((c) => `${c.name} (#${c.pointsRank ?? "–"}, ${STATUS_LABELS[c.statusAfter].toLowerCase()})`).join("; ")}</td>
                      <td className="num">{money(inc)}</td>
                      <td className="num">{cash(-cost)}</td>
                      <td className={`num ${inc - cost >= 0 ? "good-text" : "bad-text"}`}>{cash(inc - cost)}</td>
                      <td className="num">{Math.round(s.agency.reputationBefore)} → {Math.round(s.agency.reputationAfter)}</td>
                      <td className="small">{s.agency.departures.join(", ") || "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
