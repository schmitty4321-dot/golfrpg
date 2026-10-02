import { useState } from "react";
import { CENTER_TIERS, HQ_TIERS, AGENCY_EVENTS, STAFF_LABELS, STAFF_ROLES, brandOffers, buildCenter, eventBlock, eventTakings, followers, holdEvent, signBrand, centerBlock, dealClients, hireStaffer, hiredStaffer, hqBlock, releaseStaffer, rosterLimit, staffMarket, staffWages, upgradeHq, type AgencyEventKind, type StaffRole, type World } from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";
import { StaffPortrait, StaffRoleIcon } from "../components/StaffPortrait";
import { BrandMark } from "../components/BrandMark";

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
  const [role, setRole] = useState<StaffRole>("agent");
  const [page, setPage] = useState(0);
  const hired = hiredStaffer(world, role);
  const candidates = market.filter((s) => s.role === role && s.id !== hired?.id).sort((a, b) => b.quality - a.quality || a.weeklyFee - b.weeklyFee);
  const pageSize = 6;
  const pages = Math.ceil(candidates.length / pageSize);
  const visible = candidates.slice(page * pageSize, page * pageSize + pageSize);
  const specialty = (quality: number) => quality >= 18 ? "Elite operator" : quality >= 15 ? "Proven closer" : quality >= 11 ? "Reliable" : quality >= 8 ? "Developing" : "Entry level";
  return (
    <section className="panel staff-market-panel">
      <div className="panel-head"><h2>Agency staff</h2><span className="muted small">100 illustrated candidates · {money(staffWages(world))} a week in wages</span></div>
      <div className="staff-role-tabs" role="tablist" aria-label="Staff roles">
        {STAFF_ROLES.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={role === item} onClick={() => { setRole(item); setPage(0); }}>
            <StaffRoleIcon role={item} /><span>{STAFF_LABELS[item].label}</span>
            {hiredStaffer(world, item) && <small>Filled</small>}
          </button>
        ))}
      </div>
      <div className="staff-role-summary">
        <div><StaffRoleIcon role={role} /><div><strong>{STAFF_LABELS[role].label}</strong><span>{STAFF_LABELS[role].blurb}</span></div></div>
        {hired ? <div className="staff-current"><span>Currently hired: <strong>{hired.name}</strong> · {hired.quality}/20 · {money(hired.weeklyFee)}/wk</span><button className="btn btn-small" onClick={() => game.act((w) => releaseStaffer(w, role))}>Let go</button></div> : <span className="muted">Nobody hired</span>}
      </div>
      <div className="staff-candidate-grid">
        {visible.map((candidate) => (
          <article className="staff-candidate" key={candidate.id}>
            <StaffPortrait id={candidate.id} name={candidate.name} role={candidate.role} />
            <div className="staff-candidate-body">
              <strong>{candidate.name}</strong>
              <span className="staff-rating">{candidate.quality}<small>/20</small></span>
              <span className="staff-quality">{specialty(candidate.quality)}</span>
              <span className="secondary small">{money(candidate.weeklyFee)}/week</span>
            </div>
            <button className="btn btn-primary" onClick={() => game.act((w) => hireStaffer(w, candidate.id))}>Hire</button>
          </article>
        ))}
      </div>
      <div className="staff-pagination">
        <span className="muted small">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, candidates.length)} of {candidates.length} {STAFF_LABELS[role].label.toLowerCase()} candidates</span>
        <div className="btn-row"><button className="btn btn-small" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Previous</button><span className="small">Page {page + 1} of {pages}</span><button className="btn btn-small" disabled={page >= pages - 1} onClick={() => setPage((n) => n + 1)}>Next</button></div>
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
      {deals.length > 0 && <div className="brand-deal-grid">{deals.map((b) => <BrandCard key={b.id} deal={b} active />)}</div>}
      <div className="pp-label" style={{ marginTop: 10 }}>On offer this season</div>
      {offers.length === 0 ? (
        <p className="empty">{world.agency.reputation < 15 ? "Brands start calling at reputation 15." : "No more offers this season."}</p>
      ) : (
        <div className="brand-deal-grid">{offers.map((b) => <BrandCard key={b.id} deal={b} onSign={() => game.act((w) => signBrand(w, b.id))} />)}</div>
      )}
    </section>
  );
}

function BrandCard({ deal, active = false, onSign }: { deal: ReturnType<typeof brandOffers>[number]; active?: boolean; onSign?: () => void }) {
  return (
    <article className={`brand-deal-card${active ? " active" : ""}`}>
      <BrandMark name={deal.brand} category={deal.category} />
      <div className="brand-deal-name"><strong>{deal.brand}</strong><span>{deal.category}</span></div>
      <div className="brand-deal-terms"><span><b>{money(deal.annual)}</b><small>per season</small></span><span><b>+{Math.round(deal.lift * 100)}%</b><small>client offers</small></span><span><b>S{deal.untilSeason}</b><small>{active ? "contract ends" : "term"}</small></span></div>
      {onSign && <button className="btn btn-primary" onClick={onSign}>Sign partnership</button>}
      {active && <span className="brand-active-label">Active partner</span>}
    </article>
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
