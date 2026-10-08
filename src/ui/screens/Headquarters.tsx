import { useState } from "react";
import {
  BRAND_ART,
  LOYAL_SEASONS,
  STAFF_SKILLS,
  loyaltySkill,
  skillCount,
  skillsOf,
  type AgencyStaffer,
  brandGoalProgress,
  guaranteed,
  maxPayout, CENTER_TIERS, HQ_TIERS, AGENCY_EVENTS, STAFF_LABELS, STAFF_ROLES, brandOffers, brandBlock, brandSlots, declineBrand, buildCenter, eventBlock, eventTakings, followers, holdEvent, signBrand, centerBlock, dealClients, hireStaffer, hiredStaffer, hqBlock, fireStaffer, buyoutCost, contractFee, staffContract, termDiscount, STAFF_TERMS, rosterLimit, staffMarket, staffWages, upgradeHq, type AgencyEventKind, type StaffRole, type World } from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";
import { StaffPortrait, StaffRoleIcon } from "../components/StaffPortrait";
import { BrandMark } from "../components/BrandMark";
import { AgencyBuilding } from "../components/AgencyBuilding";
import { INVESTMENTS, SALE_SHARE, buyInvestment, investBlock, sellInvestment, type InvestmentKind } from "../../season";

/** The agency as a business: its Performance Center and the development deals it is funding. */
export function Headquarters({ world, game }: { world: World; game: Game }) {
  return (
    <main>
      <HqPanel world={world} game={game} />
      <StaffPanel world={world} game={game} />
      <div className="grid-2">
        <InvestmentsPanel world={world} game={game} />
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
  const buildNext = () => game.act((w) => buildCenter(w));
  return (
    <section className="panel">
      <div className="panel-head"><h2>Performance Center</h2><span className="muted small">For every client you represent</span></div>
      <div className="facility-strip">{CENTER_TIERS.map((t, i) => {
        const isCurrent = i === tier;
        const isNext = i === tier + 1;
        return (
          <button type="button" key={t.name} className={`facility-card${isCurrent ? " current" : isNext ? " next" : " locked"}`} disabled={!isNext || !!block} onClick={buildNext}>
            <AgencyBuilding tier={i} kind="center" />
            <strong>{t.name}</strong>
            <span>{t.blurb}</span>
            <em>{isCurrent ? "Current center" : isNext ? block ?? `Build for ${money(t.build)}` : i < tier ? "Previously owned" : "Build the previous tier first"}</em>
          </button>
        );
      })}</div>
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
          <button className="btn btn-primary" disabled={!!block} onClick={buildNext}>Build the {next.name.toLowerCase()} · {money(next.build)}</button>
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
      <div className="hq-card-grid">
        {HQ_TIERS.map((t, i) => (
          <article key={t.name} className={`hq-tier-card${i === tier ? " current" : ""}${i < tier ? " passed" : ""}`}>
            <AgencyBuilding tier={i} />
            <div className="hq-tier-copy"><span className="hq-level">Level {i + 1}{i === tier ? " · Current office" : ""}</span><h3>{t.name}</h3><p>{t.blurb}</p></div>
            <dl><div><dt>Move in</dt><dd>{t.cost ? money(t.cost) : "Included"}</dd></div><div><dt>Weekly</dt><dd>{money(t.office)}</dd></div><div><dt>Roster</dt><dd>{t.roster ? `+${t.roster}` : "Base"}</dd></div><div><dt>Rep gains</dt><dd>{t.reputationGain > 1 ? `+${Math.round((t.reputationGain - 1) * 100)}%` : "Base"}</dd></div></dl>
            {i === tier + 1 && <span className="hq-unlock">Unlocks at reputation {t.reputation}</span>}
          </article>
        ))}
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

const staffSpecialty = (quality: number) => quality >= 18 ? "Elite operator" : quality >= 15 ? "Proven closer" : quality >= 11 ? "Reliable" : quality >= 8 ? "Developing" : "Entry level";

/** A staffer's skills as medallions; for your own hire, the one three seasons of loyalty will bring. */
function SkillMedals({ world, staffer, loyalty = false }: { world: World; staffer: AgencyStaffer; loyalty?: boolean }) {
  const skills = skillsOf(world, staffer);
  const next = loyalty && skills.length === skillCount(staffer.quality) ? loyaltySkill(world, staffer) : undefined;
  return (
    <ul className="skill-medals">
      {skills.map((k) => (
        <li key={k} title={`${STAFF_SKILLS[k]!.label}: ${STAFF_SKILLS[k]!.blurb}`}>
          <img src={`/art/staff-skills/${k}.webp`} alt="" />
          <span>{STAFF_SKILLS[k]!.label}</span>
        </li>
      ))}
      {next && (
        <li className="skill-locked" title={`After ${LOYAL_SEASONS} seasons with you: ${STAFF_SKILLS[next]!.label}. ${STAFF_SKILLS[next]!.blurb}`}>
          <img src={`/art/staff-skills/${next}.webp`} alt="" />
          <span>{STAFF_SKILLS[next]!.label} · after {LOYAL_SEASONS} seasons</span>
        </li>
      )}
    </ul>
  );
}

function StaffPanel({ world, game }: { world: World; game: Game }) {
  const market = staffMarket(world);
  const [role, setRole] = useState<StaffRole>("agent");
  const [page, setPage] = useState(0);
  const [years, setYears] = useState<number>(2);
  const hired = hiredStaffer(world, role);
  const candidates = market.filter((s) => s.role === role && s.id !== hired?.id).sort((a, b) => b.quality - a.quality || a.weeklyFee - b.weeklyFee);
  const pageSize = 6;
  const pages = Math.ceil(candidates.length / pageSize);
  const visible = candidates.slice(page * pageSize, page * pageSize + pageSize);
  return (
    <section className="panel staff-market-panel">
      <div className="panel-head"><h2>Agency staff</h2><span className="muted small">{money(staffWages(world))} a week in wages</span></div>
      <div className="staff-role-tabs" role="tablist" aria-label="Staff roles">
        {STAFF_ROLES.map((item) => {
          const h = hiredStaffer(world, item);
          return (
            <button key={item} type="button" role="tab" aria-selected={role === item} onClick={() => { setRole(item); setPage(0); }}>
              {h ? <StaffPortrait id={h.id} name={h.name} role={item} size={34} /> : <StaffRoleIcon role={item} />}
              <span>{STAFF_LABELS[item].label}{h && <small className="staff-tab-name">{h.name} · {h.quality}/20</small>}</span>
              {!h && <small>Open</small>}
            </button>
          );
        })}
      </div>
      <div className="staff-role-summary">
        <div><StaffRoleIcon role={role} /><div><strong>{STAFF_LABELS[role].label}</strong><span>{STAFF_LABELS[role].blurb}</span></div></div>
        {!hired && <span className="muted">Nobody hired</span>}
      </div>
      {hired ? (
        <HiredStaffer world={world} game={game} role={role} />
      ) : (
        <>
          <div className="staff-terms">
            <span className="secondary small">Contract length</span>
            <div className="tabs" role="radiogroup" aria-label="Contract length">
              {STAFF_TERMS.map((y) => (
                <button key={y} role="radio" aria-checked={years === y} aria-selected={years === y} onClick={() => setYears(y)}>
                  {y} year{y === 1 ? "" : "s"}{termDiscount(y) ? ` · −${Math.round(termDiscount(y) * 100)}%` : ""}
                </button>
              ))}
            </div>
            <span className="muted small">Longer deals cost less a week; firing someone pays off half of what's left.</span>
          </div>
          <div className="staff-candidate-grid">
            {visible.map((candidate) => (
              <article className="staff-candidate" key={candidate.id}>
                <StaffPortrait id={candidate.id} name={candidate.name} role={candidate.role} />
                <div className="staff-candidate-body">
                  <strong>{candidate.name}</strong>
                  <span className="staff-rating">{candidate.quality}<small>/20</small></span>
                  <span className="staff-quality">{staffSpecialty(candidate.quality)}</span>
                  <SkillMedals world={world} staffer={candidate} />
                  <span className="secondary small">{money(contractFee(candidate, years))}/week for {years} year{years === 1 ? "" : "s"}</span>
                </div>
                <button className="btn btn-primary" onClick={() => game.act((w) => hireStaffer(w, candidate.id, years))}>Hire</button>
              </article>
            ))}
          </div>
          <div className="staff-pagination">
            <span className="muted small">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, candidates.length)} of {candidates.length} {STAFF_LABELS[role].label.toLowerCase()} candidates</span>
            <div className="btn-row"><button className="btn btn-small" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Previous</button><span className="small">Page {page + 1} of {pages}</span><button className="btn btn-small" disabled={page >= pages - 1} onClick={() => setPage((n) => n + 1)}>Next</button></div>
          </div>
        </>
      )}
    </section>
  );
}

/** The person in a role: portrait, rating, loyalty and contract, and what it costs to fire them. */
function HiredStaffer({ world, game, role }: { world: World; game: Game; role: StaffRole }) {
  const s = hiredStaffer(world, role)!;
  const c = staffContract(world, role)!;
  const buyout = buyoutCost(world, role);
  const left = c.untilSeason - world.season;
  const loyalty = Math.min(5, c.seasonsServed);
  const fire = () => {
    if (!confirm(`Fire ${s.name}? You'll pay ${money(buyout)} to end the deal, then you can hire someone new.`)) return;
    game.act((w) => fireStaffer(w, role));
  };
  return (
    <article className="staff-hired">
      <StaffPortrait id={s.id} name={s.name} role={role} size={132} />
      <div className="staff-hired-body">
        <div className="staff-hired-head">
          <strong>{s.name}</strong>
          <span className="staff-rating">{s.quality}<small>/20</small></span>
        </div>
        <span className="staff-quality">{staffSpecialty(s.quality)}</span>
        <SkillMedals world={world} staffer={s} loyalty />
        <div className="staff-hired-facts">
          <div><span className="muted small">Loyalty</span><b title="A year for every full season with you: +1 rating each year, and a discount when they re-sign">{"★".repeat(loyalty)}{"☆".repeat(5 - loyalty)}</b><span className="secondary small">{c.seasonsServed} season{c.seasonsServed === 1 ? "" : "s"} with you</span></div>
          <div><span className="muted small">Contract</span><b>Through season {c.untilSeason}</b><span className="secondary small">{left <= 0 ? "Final season" : `${left} more season${left === 1 ? "" : "s"} after this`}</span></div>
          <div><span className="muted small">Wage</span><b>{money(c.weeklyFee)}/week</b><span className="secondary small">Signed season {c.signedSeason}</span></div>
        </div>
        <div className="btn-row">
          <button className="btn btn-danger" onClick={fire}>Fire · pays {money(buyout)}</button>
          <span className="muted small">Every season they stay: +1 rating and a year of loyalty.</span>
        </div>
      </div>
    </article>
  );
}

function InvestmentsPanel({ world, game }: { world: World; game: Game }) {
  const owned = world.agency.investments ?? [];
  const m = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1000)}k`);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Investments</h2><span className="muted small">Put a good year's money to work: each pays (or costs) something every winter</span></div>
      <div className="investment-grid">
        {(Object.keys(INVESTMENTS) as InvestmentKind[]).map((k) => {
          const d = INVESTMENTS[k];
          const mine = owned.find((i) => i.kind === k);
          const block = mine ? null : investBlock(world, k);
          return (
            <article key={k} className={`investment-card${mine ? " owned" : ""}`}>
              <strong>{d.label}</strong>
              <span className="secondary small">{d.blurb}</span>
              {mine?.eventId && <span className="small">Your event: <b>{world.schedule.find((e) => e.id === mine.eventId)?.name ?? "—"}</b></span>}
              <span className="small">
                {m(d.cost)} to start
                {d.upkeep ? ` · ${m(d.upkeep)} a year to run` : ""}
                {d.returnRange[1] > 0 ? ` · returns ${Math.round(d.returnRange[0] * 100)}–${Math.round(d.returnRange[1] * 100)}% a year` : ""}
                {d.reputationPerSeason ? ` · +reputation` : ""}
              </span>
              {mine ? (
                <div className="btn-row" style={{ alignItems: "center" }}>
                  <span className="small">Since season {mine.since}{mine.last !== undefined ? <> · last winter <b className={mine.last < 0 ? "bad-text" : "good-text"}>{mine.last < 0 ? "−" : "+"}{m(Math.abs(mine.last))}</b></> : null}</span>
                  <button className="btn btn-small" onClick={() => confirm(`Sell for ${m(mine.stake * SALE_SHARE)}?`) && game.act((w) => sellInvestment(w, k))}>Sell</button>
                </div>
              ) : (
                <div className="btn-row" style={{ alignItems: "center" }}>
                  <button className="btn btn-small btn-primary" disabled={!!block} onClick={() => game.act((w) => buyInvestment(w, k))}>Invest</button>
                  {block && <span className="muted small">{block}</span>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function BrandsPanel({ world, game }: { world: World; game: Game }) {
  const deals = world.agency.brands ?? [];
  const offers = brandOffers(world);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Brand partnerships</h2><span className="muted small">Agency-wide deals: a yearly fee, and better offers for your clients</span></div>
      <p className="small secondary" style={{ marginTop: 0 }}>Partnership slots: <strong>{deals.length} of {brandSlots(world)}</strong> used (more as your reputation grows). Brands also come calling after your clients' wins and top 10s; offers lapse after a few weeks.</p>
      {deals.length > 0 && <div className="brand-deal-grid">{deals.map((b) => <BrandCard key={b.id} world={world} deal={b} active />)}</div>}
      <div className="pp-label" style={{ marginTop: 10 }}>On offer</div>
      {offers.length === 0 ? (
        <p className="empty">{world.agency.reputation < 15 ? "Brands start calling at reputation 15." : "No more offers this season."}</p>
      ) : (
        <div className="brand-deal-grid">{offers.map((b) => <BrandCard key={b.id} world={world} deal={b} block={brandBlock(world)} onSign={() => game.act((w) => signBrand(w, b.id))} onDecline={() => game.act((w) => declineBrand(w, b.id))} />)}</div>
      )}
    </section>
  );
}

/** Goals that stand in for another (when the roster or season rules it out) share its medallion. */
const GOAL_ICON: Record<string, string> = { "ap-points": "fi-top30", "wa-cuts": "wa-timeless" };

function BrandCard({ world, deal, active = false, onSign, onDecline, block }: { world: World; deal: ReturnType<typeof brandOffers>[number]; active?: boolean; onSign?: () => void; onDecline?: () => void; block?: string | null }) {
  const progress = active ? brandGoalProgress(world, deal) : null;
  const fmt = (n: number, unit?: string) => (unit === "money" ? money(n) : unit === "pct" ? `${n}%` : unit === "yards" ? `${n} yds` : `${n}`);
  // How far along a goal is: for a rank, how close the best so far is to the target rank.
  const share = (g: { now: number; target: number; unit: string; met: boolean }) =>
    g.met ? 100 : g.unit === "rank" ? (g.now ? Math.round(Math.min(1, g.target / g.now) * 100) : 0) : Math.max(0, Math.min(100, Math.round((g.now / g.target) * 100)));
  return (
    <article className={`brand-deal-card${active ? " active" : ""}`}>
      <img className="brand-campaign-art" src={BRAND_ART[deal.brand] ? `${import.meta.env.BASE_URL}${BRAND_ART[deal.brand]!.banner}` : `/art/sponsors/${deal.category}.webp`} alt="" />
      <BrandMark name={deal.brand} category={deal.category} />
      <div className="brand-deal-name"><strong>{deal.brand}</strong><span>{deal.category}</span></div>
      <div className="brand-deal-terms">{deal.goals ? <span><b>{money(guaranteed(deal))}</b><small>guaranteed · up to {money(maxPayout(deal))}</small></span> : <span><b>{money(deal.annual)}</b><small>per season</small></span>}<span><b>+{Math.round(deal.lift * 100)}%</b><small>client offers</small></span><span><b>S{deal.untilSeason}</b><small>{active ? "contract ends" : "term"}</small></span></div>
      {deal.goals && (
        <ul className="brand-goals">
          {(progress ?? deal.goals.map((g) => ({ ...g, now: 0, met: false, unit: "count" }))).map((g) => (
            <li key={g.id} className={g.met ? "met" : undefined}>
              <img className="brand-goal-icon" src={`/art/goals/${GOAL_ICON[g.id] ?? g.id}.webp`} alt="" />
              <span className="brand-goal-label">{g.met ? "✓ " : ""}{g.label}</span>
              <span className="brand-goal-pay">{money(g.share * deal.annual)}</span>
              {progress && <span className="meter"><span style={{ width: `${share(g)}%` }} /></span>}
              {progress && !g.met && (g.unit === "rank"
                ? <span className="muted small">{g.now ? `Best so far: #${g.now}` : "Not ranked yet"}</span>
                : g.target > 1 && <span className="muted small">{fmt(g.now, g.unit)} of {fmt(g.target, g.unit)}</span>)}
            </li>
          ))}
        </ul>
      )}
      {deal.renewal && !active && <span className="small good-text">They're back: last time you met their goals.</span>}
      {!active && deal.reason && <span className="small muted">Why now: {deal.reason}{deal.expiresAbsWeek !== undefined ? ` · lapses in ${Math.max(0, deal.expiresAbsWeek - (world.season * 52 + world.week))} week${deal.expiresAbsWeek - (world.season * 52 + world.week) === 1 ? "" : "s"}` : ""}</span>}
      {onSign && (
        <div className="btn-row">
          <button className="btn btn-primary" disabled={!!block} title={block ?? undefined} onClick={onSign}>Sign partnership</button>
          {onDecline && <button className="btn" onClick={onDecline}>Decline</button>}
        </div>
      )}
      {onSign && block && <span className="small muted">{block}</span>}
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
      <div className="event-card-list">
        {kinds.map((k) => {
          const e = AGENCY_EVENTS[k];
          const block = eventBlock(world, k);
          return (
            <button type="button" className="agency-event-card" key={k} disabled={!!block} onClick={() => game.act((w) => { const net = holdEvent(w, k); setMessage(`${e.label}: ${net >= 0 ? "made" : "lost"} ${money(Math.abs(net))}.`); })}>
              <img src={`/art/scenes/${k === "proAm" ? "pro-am" : k}.webp`} alt="" />
              <div className="event-card-copy">
                <strong>{e.label}</strong>
                <span className="secondary small">{e.blurb}</span>
                <span className="event-card-money"><b>Costs {money(e.cost)}</b><span>Expected return {money(eventTakings(world, k))}</span></span>
              </div>
              <div className="event-card-action">
                <span className="btn btn-small" aria-hidden>Hold it</span>
                {block && <span className="muted small">{block}</span>}
              </div>
            </button>
          );
        })}
      </div>
      {message && <p className="small" role="status">{message}</p>}
      <div className="pp-label" style={{ marginTop: 10 }}>Your clients' following</div>
      <p className="small" style={{ marginTop: 4 }}>
        {world.clientIds.map((id) => `${world.players[id]!.player.name} ${Math.round(followers(world, world.players[id]!) / 1000)}k`).join(" · ") || "No clients."}
      </p>
      <p className="muted small" style={{ marginBottom: 0 }}>Wins, top 10s, media days and events grow a following; a bigger one means bigger sponsorship offers.</p>
    </section>
  );
}
