import { CENTER_TIERS, buildCenter, centerBlock, dealClients, type World } from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";

/** The agency as a business: its Performance Center and the development deals it is funding. */
export function Headquarters({ world, game }: { world: World; game: Game }) {
  return (
    <main>
      <div className="grid-2">
        <CenterPanel world={world} game={game} />
        <DealsPanel world={world} />
      </div>
    </main>
  );
}

function CenterPanel({ world, game }: { world: World; game: Game }) {
  const tier = world.agency.center ?? 0;
  const next = CENTER_TIERS[tier + 1];
  const block = centerBlock(world);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Performance Center</h2><span className="muted small">For every client you represent</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tier</th><th className="num">Build</th><th className="num">Upkeep / wk</th><th className="num">Growth</th><th className="num">Camps</th></tr></thead>
          <tbody>
            {CENTER_TIERS.map((t, i) => (
              <tr key={t.name} className={i === tier ? "row-current" : undefined}>
                <td>
                  <strong>{t.name}</strong>{i === tier && <span className="muted small"> · yours</span>}
                  <div className="secondary small">{t.blurb}</div>
                </td>
                <td className="num">{t.build ? money(t.build) : "–"}{t.reputation ? <div className="muted small">rep {t.reputation}</div> : null}</td>
                <td className="num">{t.upkeep ? money(t.upkeep) : "–"}</td>
                <td className="num">{t.growth ? `+${Math.round(t.growth * 100)}%` : "–"}</td>
                <td className="num">{t.campDiscount ? `−${Math.round(t.campDiscount * 100)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Growth is added to each client's development pace (a typical well-run client is at about +150%). Camps are the skills camp and fitness block.</p>
      {next && (
        <div className="btn-row">
          <button className="btn btn-primary" disabled={!!block} onClick={() => game.act((w) => buildCenter(w))}>Build the {next.name.toLowerCase()} · {money(next.build)}</button>
          {block && <span className="muted small">{block}</span>}
        </div>
      )}
    </section>
  );
}

function DealsPanel({ world }: { world: World }) {
  const deals = dealClients(world);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Development deals</h2><span className="muted small">Offer one from a client's Development tab</span></div>
      {deals.length === 0 ? (
        <p className="empty">You're not funding anyone's development yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Deal</th><th className="num">Funded</th><th className="num">Commission since</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {deals.map((wp) => {
                const d = wp.client!.devDeal!;
                const back = d.commissionSince - d.funded;
                return (
                  <tr key={wp.player.id}>
                    <td>{wp.player.name}</td>
                    <td>{d.share === 1 ? "All" : "Half"} · {d.terms === "commission" ? "commission" : "contract years"} · since S{d.since}</td>
                    <td className="num">{money(d.funded)}</td>
                    <td className="num">{money(d.commissionSince)}</td>
                    <td className={`num ${back >= 0 ? "good-text" : "bad-text"}`}>{back >= 0 ? "+" : "−"}{money(Math.abs(back))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>The balance is commission earned from him since the deal against what you've paid in. A young player's deal usually starts behind and pays off as he improves.</p>
    </section>
  );
}
