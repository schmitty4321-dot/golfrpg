import { Fragment, useState } from "react";
import { NegotiationTable } from "../components/Negotiation";
import { APPAREL_LABELS, itemsOf, BRAND_ART, CAREER_SEASONS, STATUS_LABELS, WISHES, ageingNote, keepHim, letGoBlock, letHimGo, rivalBidFor, extensionWindow, knownWishes, leverage, pointsList, rankMap, rosterLimit, talkItOver, tenure, wishesOf, type World } from "../../season";
import { CutoutPortrait, Portrait } from "../components/Portrait";
import { Nation } from "../components/Flag";
import { PlayerName } from "../components/PlayerLink";
import { TraitChips } from "../components/Traits";
import { traitsOf } from "../../engine";
import { money } from "../format";
import type { Game } from "../useGame";
import { ArchetypeBadge } from "../components/Archetype";
import { BrandMark } from "../components/BrandMark";

const CATEGORY_LABELS = { equipment: "Equipment", apparel: "Apparel", watch: "Watch", financial: "Financial", automotive: "Automotive", beverage: "Beverage" } as const;

function mood(h: number): string {
  if (h >= 75) return "Delighted";
  if (h >= 60) return "Happy";
  if (h >= 45) return "Content";
  if (h >= 30) return "Unsettled";
  return "Unhappy";
}

const moodFace = (h: number) => h >= 75 ? "☺" : h >= 60 ? "●" : h >= 45 ? "–" : h >= 30 ? "!" : "×";

export function Agency({ world, game }: { world: World; game: Game }) {
  const [extending, setExtending] = useState<string | null>(null);
  const ranks = rankMap(world);
  const pts = pointsList(world);
  const limit = rosterLimit(world.agency.reputation, world.agency.hq);
  const clients = world.clientIds.map((id) => world.players[id]!).filter(Boolean);
  const featured = [...clients].sort((a, b) => (ranks.get(a.player.id) ?? 999) - (ranks.get(b.player.id) ?? 999)).slice(0, 3);
  const sponsorTotal = clients.reduce((sum, wp) => sum + wp.client!.sponsors.reduce((s, x) => s + x.annualValue, 0), 0);
  const earningsTotal = clients.reduce((sum, wp) => sum + wp.client!.finances.prizeMoney + wp.client!.finances.endorsements, 0);
  const cutTotal = clients.reduce((sum, wp) => sum + wp.client!.finances.commission, 0);
  const nextRep = limit < 8 ? (limit - (world.agency.hq ?? 0) - 1) * 15 : 100;

  return (
    <main className="roster-command-center">
      <section className="roster-masthead">
        <img className="roster-masthead-bg" src="/art/facilities/hq-3.webp" alt="Fairway Manager agency headquarters" />
        <div className="roster-masthead-shade" />
        <div className="roster-masthead-copy">
          <span>ROSTER COMMAND CENTER</span>
          <h1>Your players.<br />Your reputation.</h1>
          <p>Manage careers, protect relationships and build long-term value.</p>
          <strong>{world.clientIds.length} of {limit} roster spots filled</strong>
          <div className="roster-reputation"><b>★</b><div><span>Reputation {Math.round(world.agency.reputation)}{limit < 8 ? ` — reach ${nextRep} for another roster spot` : " — full roster size"}</span><i><em style={{ width: `${limit < 8 ? Math.min(100, (world.agency.reputation / nextRep) * 100) : 100}%` }} /></i></div></div>
        </div>
        <div className="roster-featured">
          {featured.map((wp) => {
            const expiring = wp.client!.contract.untilSeason <= world.season;
            return <article key={wp.player.id} className={expiring ? "expiring" : undefined}><CutoutPortrait player={wp.player} height={225} title={wp.player.name} />{expiring && <b>FINAL SEASON</b>}<div><strong>{wp.player.name}</strong><span>{STATUS_LABELS[wp.career.status]}</span></div></article>;
          })}
        </div>
        <div className="roster-capacity"><strong>{world.clientIds.length} / {limit}</strong><span>roster</span></div>
      </section>

      <section className="panel roster-panel">
        <div className="roster-panel-heading"><h2>Clients</h2><div className="roster-summary"><div><span>♟</span><small>Roster</small><strong>{world.clientIds.length} of {limit}</strong></div><div><span>●</span><small>Combined earnings</small><strong>{money(earningsTotal)}</strong></div><div><span>◆</span><small>Sponsors</small><strong>{money(sponsorTotal)} / yr</strong></div><div><span>▥</span><small>Your cut</small><strong>{money(cutTotal)}</strong></div></div></div>
        {world.clientIds.length === 0 ? (
          <p className="empty">No clients. Use the Scouting tab to find players and make offers.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Client</th><th>Status</th><th className="num">Points</th><th className="num">World</th><th>Mood</th><th>Traits</th><th>Contract</th><th className="num">Sponsors / yr</th><th className="num" title="Your commission this season">Your cut</th><th /></tr>
              </thead>
              <tbody>
                {world.clientIds.map((id) => {
                  const wp = world.players[id]!;
                  const m = wp.client!;
                  const expiring = m.contract.untilSeason <= world.season;
                  return (
                    <Fragment key={id}>
                      <tr className={`roster-row ${expiring ? "roster-row-expiring" : ""}`}>
                        <td><div className="roster-client"><Portrait player={wp.player} size={56} title={wp.player.name} /><div><strong><PlayerName id={id}>{wp.player.name}</PlayerName></strong><span><Nation nationality={wp.player.nationality} /> <span className="muted small">{wp.player.age}</span></span>{wp.player.archetype && <ArchetypeBadge id={wp.player.archetype} size={16} />}</div></div></td>
                        <td className="secondary small" style={{ whiteSpace: "normal", minWidth: 110 }}>{STATUS_LABELS[wp.career.status]}</td>
                        <td className="num"><span className="roster-rank">{pts.indexOf(id) >= 0 ? `#${pts.indexOf(id) + 1}` : "—"}</span></td>
                        <td className="num"><span className="roster-rank">#{ranks.get(id) ?? "—"}</span></td>
                        <td><div className={`roster-mood mood-${mood(m.happiness).toLowerCase()}`}><b>{moodFace(m.happiness)}</b><div><span>{mood(m.happiness)} <small>{Math.round(m.happiness)}</small></span><i><em style={{ width: `${m.happiness}%` }} /></i></div></div></td>
                        <td><TraitChips ids={[...traitsOf(wp.player)]} /></td>
                        <td className={expiring && !m.farewell ? "bad-text" : ""}><div className="roster-contract"><i><em style={{ width: `${Math.min(100, Math.max(8, ((world.season - m.contract.signedSeason + 1) / Math.max(1, m.contract.untilSeason - m.contract.signedSeason + 1)) * 100))}%` }} /></i><span>{Math.round(m.contract.commission * 100)}% · {m.farewell ? "farewell season" : expiring ? "ends this season" : `to S${m.contract.untilSeason}`}</span></div></td>
                        <td className="num"><div className="roster-sponsors"><strong>{money(m.sponsors.reduce((s, x) => s + x.annualValue, 0))}</strong><span>{m.sponsors.slice(0, 3).map((s) => <BrandMark key={s.id} name={s.sponsor} category={s.category} />)}</span></div></td>
                        <td className="num"><strong className="roster-cut">{money(m.finances.commission)}</strong></td>
                        <td>
                          <div className="btn-row">
                            <button className="btn btn-primary btn-small" onClick={() => setExtending(extending === id ? null : id)}>Extend</button>
                            <button className="roster-release" onClick={() => confirm(`Release ${wp.player.name}? He'll leave the agency now.`) && game.act((w) => game.lib.releaseClient(w, id))}>Release</button>
                          </div>
                        </td>
                      </tr>
                      {extending === id && (
                        <tr><td colSpan={10} style={{ background: "var(--surface-2)", whiteSpace: "normal" }}><ExtendForm world={world} game={game} id={id} /></td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">When a contract ends he leaves unless you've extended it. Happier clients are likelier to stay; results, sponsor money and fair commission keep them happy.</p>
      </section>

    </main>
  );
}

function ExtendForm({ world, game, id }: { world: World; game: Game; id: string }) {
  const wp = world.players[id]!;
  const m = wp.client!;
  const [msg, setMsg] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const win = extensionWindow(world, id);
  const all = wishesOf(world, wp);
  const known = knownWishes(world, wp);
  const lev = leverage(world, id);
  const years = tenure(world, wp);
  const talks = world.talks?.[id];
  return (
    <div className="ext-desk">
      <div className="ext-desk-grid">
        <div>
          <span className="recruit-label">The deal</span>
          <p className="small" style={{ margin: "4px 0" }}>
            {Math.round(m.contract.commission * 100)}% to the end of season {m.contract.untilSeason}
            {m.contract.rookie ? " · rookie deal (the rate doesn't bother him while it runs)" : ""}
          </p>
          <p className="small secondary" style={{ margin: 0 }}>
            {win.open ? (win.early ? "A season early: a loyalty discount if you settle now." : "His final season: the window is open, and the rivals are circling.") : win.reason}
          </p>
          <p className="small secondary" style={{ margin: "4px 0 0" }}>
            With you {years} season{years === 1 ? "" : "s"}
            {years >= CAREER_SEASONS ? " · career deal: up to four seasons, and he likes a ladder" : ` · career deals open after ${CAREER_SEASONS}`}
          </p>
          {ageingNote(wp) && <p className="small bad-text" style={{ margin: "4px 0 0" }}>{ageingNote(wp)} Potential {Math.round(wp.development.potential * 10) / 10}.</p>}
        </div>
        <div>
          <span className="recruit-label">What he wants</span>
          <ul className="ext-wishes">
            {all.map((w, i) => (
              <li key={w}>{known.includes(w) ? <><strong>{WISHES[w].label}</strong> <span className="muted small">{WISHES[w].ask}</span></> : <span className="muted">Wish {i + 1}: talk it over to find out</span>}</li>
            ))}
          </ul>
          <button className="btn btn-small" onClick={() => { let t = ""; game.act((w) => (t = talkItOver(w, id))); setMsg(t); }}>Talk it over</button>
        </div>
        <div>
          <span className="recruit-label">His leverage</span>
          <span className="meter" style={{ display: "block", margin: "6px 0" }}><span style={{ width: `${lev}%` }} /></span>
          <p className="small secondary" style={{ margin: 0 }}>
            {lev >= 60 ? "Strong: he's playing well and the rivals know it." : lev >= 40 ? "Fair: some interest elsewhere." : "Weak: a good time to talk."}
            {m.tapped ? " Rival agencies have been in touch." : ""}
          </p>
          {(() => {
            const bid = rivalBidFor(world, id);
            return bid ? <p className="small bad-text" style={{ margin: "4px 0 0" }}>{bid.agency} have offered him {Math.round(bid.commission * 100)}%. Beat it, or he may go.</p> : null;
          })()}
          <p className="small muted" style={{ margin: "4px 0 0" }}>He's {mood(m.happiness).toLowerCase()}. Happier clients sign on more readily.</p>
        </div>
      </div>
      {m.farewell && <p className="small farewell-note">Farewell season: he leaves on good terms when his deal ends, and his place is already free.</p>}
      <div className="btn-row" style={{ marginTop: 8 }}>
        {!m.farewell && !letGoBlock(world, id) && (
          <button
            className="btn btn-small"
            title="He plays out his deal and leaves on good terms: a little reputation instead of the hit for a client walking out, and his place frees up now"
            onClick={() => {
              if (!confirm(`Let ${wp.player.name} go at the end of the season? His place frees up now.`)) return;
              let t = "";
              game.act((w) => (t = letHimGo(w, id)));
              setMsg(t);
            }}
          >
            Let him go
          </button>
        )}
        {m.farewell && (
          <button className="btn btn-small" onClick={() => { let t = ""; game.act((w) => (t = keepHim(w, id))); setMsg(t); }}>Change your mind</button>
        )}
        {!m.farewell && <button
          className="btn btn-primary btn-small"
          onClick={() => {
            let text = "";
            game.act((w) => (text = game.lib.startNegotiation(w, id, "extend") ?? ""));
            setMsg(text || null);
            if (!text) setTalking(true);
          }}
        >
          {talks?.status === "open" ? "Back to the talks" : "Open talks"}
        </button>}
        {msg && <strong className="small">{msg}</strong>}
      </div>
      {talking && <NegotiationTable world={world} game={game} playerId={id} onClose={() => setTalking(false)} />}
    </div>
  );
}

/** Sponsorship offers for your clients, as banner cards with Accept and Decline. */
export function SponsorshipOffers({ world, game }: { world: World; game: Game }) {
  return (
      <section className="panel">
      <div className="panel-head"><h2>Sponsorship offers</h2><span className="muted small">Offers lapse after three weeks · your agency takes 20% of endorsements</span></div>
      {world.clientIds.every((id) => world.players[id]!.client!.offers.length === 0) ? (
        <p className="empty">No offers right now. They arrive at the start of a season and after strong weeks.</p>
      ) : (
        <div className="sponsor-card-grid">
          {world.clientIds.flatMap((id) =>
            world.players[id]!.client!.offers.map((o) => {
              const wp = world.players[id]!;
              const art = BRAND_ART[o.sponsor];
              const weeksLeft = o.expiresAbsWeek - (world.season * 52 + world.week);
              return (
                <article className="sponsor-card sponsor-offer" key={o.id}>
                  <img className="sponsor-banner" src={art ? `${import.meta.env.BASE_URL}${art.banner}` : `/art/sponsors/${o.category}.webp`} alt={art ? `${o.sponsor}: ${art.tagline}` : ""} />
                  <div className="sponsor-card-body">
                    <Portrait player={wp.player} size={64} />
                    <div className="sponsor-card-who">
                      <div><strong>{o.sponsor}</strong> <span className="sponsor-tag">{CATEGORY_LABELS[o.category]}{o.category === "apparel" ? `: ${game.lib.itemsOf(o).map((it) => game.lib.APPAREL_LABELS[it].toLowerCase()).join(", ")}` : ""}</span> <span className="sponsor-offer-tag">Offer</span></div>
                      <PlayerName id={id}>{wp.player.name}</PlayerName>
                      {o.reason && <span className="small muted">Why now: {o.reason}</span>}
                    </div>
                    <div className="sponsor-card-terms">
                      <div><b>{money(o.annualValue)}</b><small>Per season</small></div>
                      <div><b>End of S{o.untilSeason}</b><small>Runs to</small></div>
                    </div>
                  </div>
                  <div className="sponsor-bonuses">
                    <div><b>{money(o.winBonus)}</b><small>a win</small></div>
                    <div><b>{money(o.majorBonus)}</b><small>extra for a major</small></div>
                    <div><b>{weeksLeft <= 0 ? "This week" : `${weeksLeft} week${weeksLeft === 1 ? "" : "s"}`}</b><small>to decide</small></div>
                  </div>
                  <div className="btn-row sponsor-offer-actions">
                    <span className="small muted sponsor-slots">Endorsement slots: {wp.client!.sponsors.length} of {game.lib.endorsementSlots(world, wp)} used</span>
                    <button className="btn btn-small btn-primary" disabled={!!game.lib.sponsorBlock(world, id)} title={game.lib.sponsorBlock(world, id) ?? undefined} onClick={() => game.act((w) => game.lib.acceptSponsor(w, id, o.id))}>Accept</button>
                    <button className="btn btn-small" onClick={() => game.act((w) => game.lib.declineSponsor(w, id, o.id))}>Decline</button>
                  </div>
                </article>
              );
            }),
          )}
        </div>
      )}
    </section>
  );
}

/** Every client's active deals as banner cards, with the season's totals on top. */
export function CurrentSponsorships({ world }: { world: World }) {
  const deals = world.clientIds.flatMap((id) => world.players[id]!.client!.sponsors.map((s) => ({ id, s })));
  const annual = deals.reduce((t, d) => t + d.s.annualValue, 0);
  const earned = deals.reduce((t, d) => t + (d.s.earned ?? 0), 0);
  return (
    <section className="panel">
      <div className="panel-head sponsor-head">
        <div>
          <h2>Current sponsorships</h2>
          <span className="muted small">{deals.length} active partnership{deals.length === 1 ? "" : "s"} driving your season</span>
        </div>
        <div className="sponsor-totals">
          <div><strong>{deals.length}</strong><span>Active deals</span></div>
          <div><strong>{money(annual)}</strong><span>Annual value</span></div>
          <div><strong>{money(earned)}</strong><span>Bonuses earned</span></div>
        </div>
      </div>
      {deals.length === 0 ? (
        <p className="empty">None yet.</p>
      ) : (
        <div className="sponsor-card-grid">
          {deals.map(({ id, s }) => {
            const wp = world.players[id]!;
            const art = BRAND_ART[s.sponsor];
            const wins = (wp.career.stats?.season === world.season ? wp.career.stats.wins : 0);
            return (
              <article className="sponsor-card" key={s.id}>
                {art ? <img className="sponsor-banner" src={`${import.meta.env.BASE_URL}${art.banner}`} alt={`${s.sponsor}: ${art.tagline}`} /> : <img className="sponsor-banner" src={`/art/sponsors/${s.category}.webp`} alt="" />}
                <div className="sponsor-card-body">
                  <Portrait player={wp.player} size={64} />
                  <div className="sponsor-card-who">
                    <div><strong>{s.sponsor}</strong> <span className="sponsor-tag">{CATEGORY_LABELS[s.category]}{s.category === "apparel" ? `: ${itemsOf(s).map((it) => APPAREL_LABELS[it].toLowerCase()).join(", ")}` : ""}</span> <span className="sponsor-active">Active</span></div>
                    <PlayerName id={id}>{wp.player.name}</PlayerName>
                  </div>
                  <div className="sponsor-card-terms">
                    <div><b>{money(s.annualValue)}</b><small>Annual payment</small></div>
                    <div><b>End of S{s.untilSeason}</b><small>Contract end</small></div>
                  </div>
                </div>
                <div className="sponsor-bonuses">
                  <span className="pp-label">Bonuses</span>
                  <div><b>{money(s.winBonus)}</b><small>a win · {wins} this season</small></div>
                  <div><b>{money(s.majorBonus)}</b><small>extra for a major</small></div>
                  <div><b>{money(s.earned ?? 0)}</b><small>earned so far</small></div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
