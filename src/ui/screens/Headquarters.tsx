import { useState } from "react";
import { CENTER_TIERS, HQ_TIERS, AGENCY_EVENTS, STAFF_LABELS, STAFF_ROLES, brandOffers, buildCenter, eventBlock, eventTakings, followers, holdEvent, signBrand, centerBlock, dealClients, hireStaffer, hiredStaffer, hqBlock, releaseStaffer, rosterLimit, staffMarket, staffWages, upgradeHq, type AgencyEventKind, type World } from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";

/** The agency as a business: its Performance Center and the development deals it is funding. */
export function Headquarters({ world, game }: { world: World; game: Game }) {
  return (
    <main>
      <HqPanel world={world} game={game} />
      <StaffPanel world={world} game={game} />
      <div className="grid-2">
        <BrandsPanel world={world} game={game} />
        <EventsPanel world={world} game={game} />
      </div>
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

function HqPanel({ world, game }: { world: World; game: Game }) {
  const tier = world.agency.hq ?? 0;
  const next = HQ_TIERS[tier + 1];
  const block = hqBlock(world);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Headquarters</h2>
        <span className="muted small">Roster {world.clientIds.length} of {rosterLimit(world.agency.reputation, world.agency.hq)} · reputation {Math.round(world.agency.reputation)}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Office</th><th className="num">Move in</th><th className="num">Running cost / wk</th><th className="num">Roster</th><th className="num">Reputation gains</th></tr></thead>
          <tbody>
            {HQ_TIERS.map((t, i) => (
              <tr key={t.name} className={i === tier ? "row-current" : undefined}>
                <td><strong>{t.name}</strong>{i === tier && <span className="muted small"> · yours</span>}<div className="secondary small">{t.blurb}</div></td>
                <td className="num">{t.cost ? money(t.cost) : "–"}{t.reputation ? <div className="muted small">rep {t.reputation}</div> : null}</td>
                <td className="num">{money(t.office)}</td>
                <td className="num">{t.roster ? `+${t.roster}` : "–"}</td>
                <td className="num">{t.reputationGain > 1 ? `+${Math.round((t.reputationGain - 1) * 100)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {next && (
        <div className="btn-row">
          <button className="btn btn-primary" disabled={!!block} onClick={() => game.act((w) => upgradeHq(w))}>Move to the {next.name.toLowerCase()} · {money(next.cost)}</button>
          {block && <span className="muted small">{block}</span>}
        </div>
      )}
    </section>
  );
}

function StaffPanel({ world, game }: { world: World; game: Game }) {
  const market = staffMarket(world);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Agency staff</h2><span className="muted small">{money(staffWages(world))} a week in wages · one per role</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Role</th><th>Hired</th><th>Candidates</th></tr></thead>
          <tbody>
            {STAFF_ROLES.map((role) => {
              const hired = hiredStaffer(world, role);
              return (
                <tr key={role}>
                  <td><strong>{STAFF_LABELS[role].label}</strong><div className="secondary small">{STAFF_LABELS[role].blurb}</div></td>
                  <td>
                    {hired ? (
                      <>
                        {hired.name} · {hired.quality}/20 · {money(hired.weeklyFee)}/wk{" "}
                        <button className="btn btn-small" onClick={() => game.act((w) => releaseStaffer(w, role))}>Let go</button>
                      </>
                    ) : (
                      <span className="muted">Nobody</span>
                    )}
                  </td>
                  <td>
                    <div className="btn-row">
                      {market.filter((s) => s.role === role && s.id !== hired?.id).map((s) => (
                        <button key={s.id} className="btn btn-small" onClick={() => game.act((w) => hireStaffer(w, s.id))}>
                          {s.name} · {s.quality}/20 · {money(s.weeklyFee)}/wk
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BrandsPanel({ world, game }: { world: World; game: Game }) {
  const deals = world.agency.brands ?? [];
  const offers = brandOffers(world);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Brand partnerships</h2><span className="muted small">Agency-wide deals: a yearly fee, and better offers for your clients</span></div>
      {deals.length > 0 && (
        <table>
          <tbody>
            {deals.map((b) => (
              <tr key={b.id}><td><strong>{b.brand}</strong> <span className="muted small">{b.category}</span></td><td className="num">{money(b.annual)}/season</td><td className="num">+{Math.round(b.lift * 100)}% offers</td><td className="num muted small">to S{b.untilSeason}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="pp-label" style={{ marginTop: 10 }}>On offer this season</div>
      {offers.length === 0 ? (
        <p className="empty">{world.agency.reputation < 15 ? "Brands start calling at reputation 15." : "No more offers this season."}</p>
      ) : (
        <table>
          <tbody>
            {offers.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.brand}</strong> <span className="muted small">{b.category}</span></td>
                <td className="num">{money(b.annual)}/season</td>
                <td className="num">+{Math.round(b.lift * 100)}% offers</td>
                <td className="num muted small">to S{b.untilSeason}</td>
                <td><button className="btn btn-small" onClick={() => game.act((w) => signBrand(w, b.id))}>Sign</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function EventsPanel({ world, game }: { world: World; game: Game }) {
  const [message, setMessage] = useState<string | null>(null);
  const kinds = Object.keys(AGENCY_EVENTS) as AgencyEventKind[];
  return (
    <section className="panel">
      <div className="panel-head"><h2>Agency events and media</h2><span className="muted small">Each once a season</span></div>
      <table>
        <tbody>
          {kinds.map((k) => {
            const e = AGENCY_EVENTS[k];
            const block = eventBlock(world, k);
            return (
              <tr key={k}>
                <td><strong>{e.label}</strong><div className="secondary small">{e.blurb}</div></td>
                <td className="num small">costs {money(e.cost)}<br />takes about {money(eventTakings(world, k))}</td>
                <td>
                  <button className="btn btn-small" disabled={!!block} onClick={() => game.act((w) => { const net = holdEvent(w, k); setMessage(`${e.label}: ${net >= 0 ? "made" : "lost"} ${money(Math.abs(net))}.`); })}>Hold it</button>
                  {block && <div className="muted small">{block}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {message && <p className="small" role="status">{message}</p>}
      <div className="pp-label" style={{ marginTop: 10 }}>Your clients' following</div>
      <p className="small" style={{ marginTop: 4 }}>
        {world.clientIds.map((id) => `${world.players[id]!.player.name} ${Math.round(followers(world, world.players[id]!) / 1000)}k`).join(" · ") || "No clients."}
      </p>
      <p className="muted small" style={{ marginBottom: 0 }}>Wins, top 10s, media days and events grow a following; a bigger one means bigger sponsorship offers.</p>
    </section>
  );
}
