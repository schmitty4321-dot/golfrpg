import { Fragment, useState } from "react";
import { PromisePicker } from "../components/Promises";
import type { PromiseKind } from "../../season";
import { STATUS_LABELS, pointsList, rankMap, rosterLimit, type World } from "../../season";
import { Nation } from "../components/Flag";
import { PlayerProfile } from "../components/PlayerProfile";
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
  const [profile, setProfile] = useState<string | null>(null);
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
                        <td>{wp.player.archetype && <ArchetypeBadge id={wp.player.archetype} size={18} />} <button className="linkish" onClick={() => setProfile(id)}>{wp.player.name}</button> <Nation nationality={wp.player.nationality} /> <span className="muted small">{wp.player.age}</span></td>
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
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Sponsor</th><th>Type</th><th className="num">Per season</th><th className="num">Win bonus</th><th className="num">Major bonus</th><th>Runs to</th><th /></tr></thead>
              <tbody>
                {world.clientIds.flatMap((id) =>
                  world.players[id]!.client!.offers.map((o) => (
                    <tr key={o.id}>
                      <td>{world.players[id]!.player.name}</td>
                      <td>{o.sponsor}</td>
                      <td>{CATEGORY_LABELS[o.category]}</td>
                      <td className="num">{money(o.annualValue)}</td>
                      <td className="num">{money(o.winBonus)}</td>
                      <td className="num">{money(o.majorBonus)}</td>
                      <td>End of S{o.untilSeason}</td>
                      <td>
                        <div className="btn-row">
                          <button className="btn btn-small btn-primary" onClick={() => game.act((w) => game.lib.acceptSponsor(w, id, o.id))}>Accept</button>
                          <button className="btn btn-small" onClick={() => game.act((w) => game.lib.declineSponsor(w, id, o.id))}>Decline</button>
                        </div>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Current sponsorships</h2></div>
        {world.clientIds.every((id) => world.players[id]!.client!.sponsors.length === 0) ? (
          <p className="empty">None yet.</p>
        ) : (
          <table>
            <thead><tr><th>Client</th><th>Sponsor</th><th>Type</th><th className="num">Per season</th><th>Runs to</th></tr></thead>
            <tbody>
              {world.clientIds.flatMap((id) =>
                world.players[id]!.client!.sponsors.map((s) => (
                  <tr key={s.id}>
                    <td>{world.players[id]!.player.name}</td>
                    <td>{s.sponsor}</td>
                    <td>{CATEGORY_LABELS[s.category]}</td>
                    <td className="num">{money(s.annualValue)}</td>
                    <td>End of S{s.untilSeason}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}
      </section>

      {profile && <PlayerProfile world={world} game={game} id={profile} onClose={() => setProfile(null)} />}
    </main>
  );
}

function ExtendForm({ world, game, id }: { world: World; game: Game; id: string }) {
  const m = world.players[id]!.client!;
  const [commission, setCommission] = useState(Math.round(m.contract.commission * 100));
  const [years, setYears] = useState(2);
  const [promises, setPromises] = useState<PromiseKind[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="btn-row" style={{ alignItems: "center", padding: "6px 0", flexWrap: "wrap" }}>
      <strong>New deal:</strong>
      <label className="small secondary">Commission
        <select value={commission} onChange={(e) => setCommission(Number(e.target.value))} style={{ marginLeft: 6 }}>
          {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((c) => <option key={c} value={c}>{c}%</option>)}
        </select>
      </label>
      <label className="small secondary">Extra seasons
        <select value={years} onChange={(e) => setYears(Number(e.target.value))} style={{ marginLeft: 6 }}>
          {[1, 2, 3].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <span className="small secondary">He's {mood(m.happiness).toLowerCase()}. Happier clients sign on more readily.</span>
      <button
        className="btn btn-primary btn-small"
        onClick={() => {
          let text = "";
          game.act((w) => (text = game.lib.extendContract(w, id, { commission: commission / 100, years, promises }).message));
          setMsg(text);
        }}
      >
        Offer extension
      </button>
      {msg && <strong className="small">{msg}</strong>}
      <span className="small muted">(Runs from the end of this season: new end is season {world.season + years}.)</span>
      <PromisePicker wp={world.players[id]!} value={promises} onChange={setPromises} />
    </div>
  );
}
