import { Fragment, useState } from "react";
import { NegotiationTable } from "../components/Negotiation";
import { BRAND_ART, CAREER_SEASONS, STATUS_LABELS, WISHES, ageingNote, rivalBidFor, extensionWindow, knownWishes, leverage, pointsList, rankMap, rosterLimit, talkItOver, tenure, wishesOf, type World } from "../../season";
import { Portrait } from "../components/Portrait";
import { Nation } from "../components/Flag";
import { PlayerName } from "../components/PlayerLink";
import { TraitChips } from "../components/Traits";
import { traitsOf } from "../../engine";
import { money } from "../format";
import type { Game } from "../useGame";
import { ArchetypeBadge } from "../components/Archetype";

const CATEGORY_LABELS = { equipment: "Equipment", apparel: "Apparel", watch: "Watch", financial: "Financial", automotive: "Automotive", beverage: "Beverage" } as const;

function mood(h: number): string {
  if (h >= 75) return "Delighted";
  if (h >= 60) return "Happy";
  if (h >= 45) return "Content";
  if (h >= 30) return "Unsettled";
  return "Unhappy";
}

export function Agency({ world, game }: { world: World; game: Game }) {
  const [extending, setExtending] = useState<string | null>(null);
  const ranks = rankMap(world);
  const pts = pointsList(world);
  const limit = rosterLimit(world.agency.reputation, world.agency.hq);

  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <h2>Clients ({world.clientIds.length} of {limit})</h2>
          <span className="muted small">Reputation {Math.round(world.agency.reputation)}: {limit < 8 ? `reach ${(limit - (world.agency.hq ?? 0) - 1) * 15} for another roster spot` : "full roster size"}</span>
        </div>
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
                      <tr>
                        <td>{wp.player.archetype && <ArchetypeBadge id={wp.player.archetype} size={18} />} <PlayerName id={id}>{wp.player.name}</PlayerName> <Nation nationality={wp.player.nationality} /> <span className="muted small">{wp.player.age}</span></td>
                        <td className="secondary small" style={{ whiteSpace: "normal", minWidth: 110 }}>{STATUS_LABELS[wp.career.status]}</td>
                        <td className="num">{pts.indexOf(id) >= 0 ? `#${pts.indexOf(id) + 1}` : "—"}</td>
                        <td className="num">#{ranks.get(id) ?? "—"}</td>
                        <td>{mood(m.happiness)} <span className="muted small">{Math.round(m.happiness)}</span></td>
                        <td><TraitChips ids={[...traitsOf(wp.player)]} /></td>
                        <td className={expiring ? "bad-text" : ""}>{Math.round(m.contract.commission * 100)}% · {expiring ? "ends this season" : `to S${m.contract.untilSeason}`}</td>
                        <td className="num">{money(m.sponsors.reduce((s, x) => s + x.annualValue, 0))}</td>
                        <td className="num">{money(m.finances.commission)}</td>
                        <td>
                          <div className="btn-row">
                            <button className="btn btn-small" onClick={() => setExtending(extending === id ? null : id)}>Extend</button>
                            <button className="btn btn-small" onClick={() => confirm(`Release ${wp.player.name}? He'll leave the agency now.`) && game.act((w) => game.lib.releaseClient(w, id))}>Release</button>
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
                        <div><strong>{o.sponsor}</strong> <span className="sponsor-tag">{CATEGORY_LABELS[o.category]}</span> <span className="sponsor-offer-tag">Offer</span></div>
                        <PlayerName id={id}>{wp.player.name}</PlayerName>
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
                      <button className="btn btn-small btn-primary" onClick={() => game.act((w) => game.lib.acceptSponsor(w, id, o.id))}>Accept</button>
                      <button className="btn btn-small" onClick={() => game.act((w) => game.lib.declineSponsor(w, id, o.id))}>Decline</button>
                    </div>
                  </article>
                );
              }),
            )}
          </div>
        )}
      </section>

      <CurrentSponsorships world={world} />
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
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          className="btn btn-primary btn-small"
          onClick={() => {
            let text = "";
            game.act((w) => (text = game.lib.startNegotiation(w, id, "extend") ?? ""));
            setMsg(text || null);
            if (!text) setTalking(true);
          }}
        >
          {talks?.status === "open" ? "Back to the talks" : "Open talks"}
        </button>
        {msg && <strong className="small">{msg}</strong>}
      </div>
      {talking && <NegotiationTable world={world} game={game} playerId={id} onClose={() => setTalking(false)} />}
    </div>
  );
}

/** Every client's active deals as banner cards, with the season's totals on top. */
function CurrentSponsorships({ world }: { world: World }) {
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
                    <div><strong>{s.sponsor}</strong> <span className="sponsor-tag">{CATEGORY_LABELS[s.category]}</span> <span className="sponsor-active">Active</span></div>
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
