import { useState } from "react";
import { WISHES, rivalBidFor, cardsInHand, knownWishes, leverage, maxYears, roundsFor, wishMet, commissionGrace, interestedAgencies, marketRate, negotiationFor, offerBlock, RELEASE_CLAUSE_STEPS, RETAINER_STEPS, SIGNING_BONUS_STEPS, STRUCTURE_LABELS, WIN_BONUS_STEPS, cleanExtras, describeTerms, warmth, type CommissionStructure, type PromiseKind, type World } from "../../season";
import type { Game } from "../useGame";
import { PromisePicker } from "./Promises";
import { PlayerName } from "./PlayerLink";

/** The negotiation table, for the talks going on (or just finished) with this player. */
export function NegotiationTable({ world, game, playerId, onClose }: { world: World; game: Game; playerId: string; onClose: () => void }) {
  const n = negotiationFor(world, playerId);
  const wp = world.players[playerId];
  const start = n?.counter ?? [...(n?.lines ?? [])].reverse().find((l) => l.terms)?.terms;
  const current = wp?.client?.contract.commission ?? 0.1;
  const [commission, setCommission] = useState(Math.round((start?.commission ?? current) * 100));
  const [years, setYears] = useState(start?.years ?? 2);
  const [promises, setPromises] = useState<PromiseKind[]>(start?.promises ?? []);
  const was = start?.extras ?? wp?.client?.contract.extras;
  const [structure, setStructure] = useState<CommissionStructure>(was?.structure ?? "flat");
  const [majors, setMajors] = useState<number | "same">(was?.majorCommission !== undefined ? Math.round(was.majorCommission * 100) : "same");
  const [winBonus, setWinBonus] = useState(was?.winBonus ?? 0);
  const [signing, setSigning] = useState(was?.signingBonus ?? 0);
  const [clause, setClause] = useState(was?.releaseClause ?? 0);
  const [retainer, setRetainer] = useState(was?.retainer ?? 0);
  if (!n || n.playerId !== playerId || !wp) return null;
  const open = n.status === "open";
  const extras = cleanExtras({ structure, ...(majors !== "same" ? { majorCommission: majors / 100 } : {}), winBonus, signingBonus: signing, releaseClause: clause, retainer });
  const terms = { commission: commission / 100, years, promises, ...(extras ? { extras } : {}) };
  const k = (n: number) => (n === 0 ? "None" : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n / 1000}k`);
  const blocked = n ? offerBlock(world, n) : null;
  const rivals = n?.kind === "sign" ? interestedAgencies(world, playerId) : [];
  // Signing talks stay open over the weeks: closing the table only puts them aside.
  const finish = () => {
    game.act((w) => {
      // Talks still open stay open; finished ones come off the books.
      game.lib.clearTalks(w, playerId);
      if (w.negotiation?.playerId === playerId && w.negotiation.status !== "open") delete w.negotiation;
    });
    onClose();
  };
  const withdraw = () => {
    game.act((w) => {
      game.lib.abandonNegotiation(w, playerId);
      game.lib.clearTalks(w, playerId);
    });
    onClose();
  };
  return (
    <div className="player-page" role="dialog" aria-modal="true" aria-labelledby="neg-title">
      <div className="player-page-inner" style={{ maxWidth: 760 }}>
        <section className="panel">
          <div className="panel-head">
            <h2 id="neg-title">{n.kind === "sign" ? "Signing" : "Extending"} <PlayerName id={playerId}>{wp.player.name}</PlayerName></h2>
            <span className="small">
              Round {Math.min(n.round + (open ? 1 : 0), roundsFor(n))} of {roundsFor(n)} · Patience{" "}
              <span aria-label={`${Math.max(0, n.patience)} of ${n.patienceMax}`}>
                {Array.from({ length: n.patienceMax }, (_, i) => (i < n.patience ? "●" : "○")).join(" ")}
              </span>
            </span>
          </div>
          <ul className="neg-lines">
            {n.lines.map((l, i) => (
              <li key={i} className={`neg-${l.by}`}>
                <span className="small muted">{l.by === "you" ? "You" : l.by === "rival" ? "Rival" : wp.player.name}</span>
                <span>{l.text}</span>
              </li>
            ))}
          </ul>
          {open && n.pending && <p className="secondary" style={{ marginTop: 0 }}>{n.kind === "extend" ? "He's thinking it over. A client usually answers within a week or two." : "He's thinking over your offer. Players usually take two to four weeks over a first offer, a week or two after that."}</p>}
          {n.kind === "extend" && <ExtensionSide world={world} game={game} playerId={playerId} terms={terms} />}
          {rivals.length > 0 && <p className="small" style={{ marginTop: 0 }}>Also talking to him: <strong>{rivals.join(", ")}</strong>. Their terms are private.</p>}
          {open && !n.pending ? (
            <>
              {n.counter && (
                <div className="btn-row" style={{ alignItems: "center" }}>
                  <button className="btn btn-primary" onClick={() => game.act((w) => game.lib.acceptCounter(w, playerId))}>Accept his terms</button>
                  <span className="small muted">{describeTerms(n.counter)}</span>
                </div>
              )}
              <div className="btn-row" style={{ alignItems: "center", marginTop: 10 }}>
                <label className="small secondary">Commission
                  <select value={commission} onChange={(e) => setCommission(Number(e.target.value))} style={{ marginLeft: 6 }}>
                    {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((c) => <option key={c} value={c}>{c}%</option>)}
                  </select>
                </label>
                <label className="small secondary">{n.kind === "sign" ? "Length" : "Extra seasons"}
                  <select value={years} onChange={(e) => setYears(Number(e.target.value))} style={{ marginLeft: 6 }}>
                    {Array.from({ length: n.kind === "extend" ? maxYears(world, wp) : 3 }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{y} season{y === 1 ? "" : "s"}</option>)}
                  </select>
                </label>
                <span className="small muted" title="What players of his standing usually pay: stars less, players without status more">Going rate {Math.round(marketRate(wp) * 100)}%{commissionGrace(world, wp.player.id) > 0 && n.kind === "sign" ? ` (he's keen: up to ${Math.round((marketRate(wp) + commissionGrace(world, wp.player.id)) * 1000) / 10}% for you)` : ""}</span>
                <span className="small">Your read: <strong>{warmth(world, n, terms)}</strong></span>
              </div>
              <details className="deal-extras">
                <summary className="small secondary">Deal structure and bonuses{extras ? " (set)" : ""}</summary>
                <div className="btn-row" style={{ alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <label className="small secondary" title={STRUCTURE_LABELS[structure].blurb}>Structure
                    <select value={structure} onChange={(e) => setStructure(e.target.value as CommissionStructure)} style={{ marginLeft: 6 }}>
                      {(Object.keys(STRUCTURE_LABELS) as CommissionStructure[]).map((s) => <option key={s} value={s}>{STRUCTURE_LABELS[s].label}</option>)}
                    </select>
                  </label>
                  <label className="small secondary">On majors
                    <select value={majors} onChange={(e) => setMajors(e.target.value === "same" ? "same" : Number(e.target.value))} style={{ marginLeft: 6 }}>
                      <option value="same">Same rate</option>
                      {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((c) => <option key={c} value={c}>{c}%</option>)}
                    </select>
                  </label>
                  <label className="small secondary" title="Paid to the agency each time he wins">Win bonus
                    <select value={winBonus} onChange={(e) => setWinBonus(Number(e.target.value))} style={{ marginLeft: 6 }}>
                      {WIN_BONUS_STEPS.map((v) => <option key={v} value={v}>{k(v)}</option>)}
                    </select>
                  </label>
                  <label className="small secondary" title="Paid by the agency when he signs">Signing bonus
                    <select value={signing} onChange={(e) => setSigning(Number(e.target.value))} style={{ marginLeft: 6 }}>
                      {SIGNING_BONUS_STEPS.map((v) => <option key={v} value={v}>{k(v)}</option>)}
                    </select>
                  </label>
                  <label className="small secondary" title="He pays the agency this every week, whatever his results">Retainer
                    <select value={retainer} onChange={(e) => setRetainer(Number(e.target.value))} style={{ marginLeft: 6 }}>
                      {RETAINER_STEPS.map((v) => <option key={v} value={v}>{v ? `$${v.toLocaleString("en-US")}/wk` : "None"}</option>)}
                    </select>
                  </label>
                  <label className="small secondary" title="A rival can pay this to take him while he's restless">Release clause
                    <select value={clause} onChange={(e) => setClause(Number(e.target.value))} style={{ marginLeft: 6 }}>
                      {RELEASE_CLAUSE_STEPS.map((v) => <option key={v} value={v}>{k(v)}</option>)}
                    </select>
                  </label>
                </div>
                <p className="muted small" style={{ margin: "6px 0 0" }}>{STRUCTURE_LABELS[structure].blurb} Stars care most about structure and majors; players without status love a signing bonus; nobody likes a win bonus.</p>
              </details>
              <PromisePicker wp={wp} value={promises} onChange={setPromises} />
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" disabled={!!blocked} onClick={() => game.act((w) => game.lib.makeOffer(w, terms, playerId))}>Make this offer</button>
                <button className="btn" onClick={withdraw}>{n.kind === "sign" ? "Walk away" : "Break off talks"}</button>
                <button className="btn" onClick={finish}>Close</button>
              </div>
              {blocked && <p className="small muted" style={{ margin: "6px 0 0" }}>{blocked}</p>}
              <p className="muted small" style={{ marginBottom: 0 }}>Each offer that falls short costs patience (a lowball costs double). He counters with the smallest change that would get it done; accept it, or try something else.</p>
            </>
          ) : open ? (
            <div className="btn-row">
              <button className="btn btn-primary" onClick={finish}>Close</button>
              <button className="btn" onClick={withdraw}>Withdraw the offer</button>
            </div>
          ) : (
            <div className="btn-row">
              <button className="btn btn-primary" onClick={finish}>{n.status === "agreed" ? "Done" : "Close"}</button>
              {n.kind === "extend" && n.status === "walked" && cardsInHand(world).some((c) => c.id === "clearTheAir" && c.left > 0) && (
                <button className="btn" onClick={() => game.act((w) => game.lib.playTalksCard(w, playerId, "clearTheAir"))}>Clear the air (your dispute settler)</button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Extension talks: his wishes against your terms, his leverage, and your staff's cards. */
function ExtensionSide({ world, game, playerId, terms }: { world: World; game: Game; playerId: string; terms: { commission: number; years: number; promises: PromiseKind[]; extras?: ReturnType<typeof cleanExtras> } }) {
  const wp = world.players[playerId]!;
  const n = negotiationFor(world, playerId)!;
  const known = knownWishes(world, wp);
  const lev = leverage(world, playerId);
  const hand = cardsInHand(world);
  const open = n.status === "open" && !n.pending;
  const offer = { ...terms, ...(terms.extras ? { extras: terms.extras } : {}) };
  return (
    <div className="ext-side">
      <div className="small">
        <strong>What he wants:</strong>{" "}
        {known.length === 0 ? <span className="muted">talk it over with him to find out.</span> : known.map((w) => (
          <span key={w} className={`ext-wish ${wishMet(wp, w, offer) || n.fill === w ? "met" : ""}`} title={WISHES[w].ask}>{wishMet(wp, w, offer) || n.fill === w ? "✓ " : ""}{WISHES[w].label}</span>
        ))}
        {known.length === 1 && <span className="muted"> · one more you haven't found</span>}
      </div>
      {(() => {
        const bid = rivalBidFor(world, playerId);
        return bid ? <div className="small bad-text"><strong>Rival bid:</strong> {bid.agency} at {Math.round(bid.commission * 100)}%. Your rate above theirs counts against you.</div> : null;
      })()}
      <div className="small"><strong>His leverage:</strong> {lev >= 60 ? "strong" : lev >= 40 ? "fair" : "weak"} <span className="muted">({lev})</span>{n.boost ? <span className="good-text"> · your closer's word is in</span> : null}</div>
      {hand.length > 0 && (
        <div className="ext-cards">
          {hand.map((c) => (
            <button key={c.id} className="btn btn-small" disabled={!open || c.left <= 0} title={c.def.blurb} onClick={() => game.act((w) => game.lib.playTalksCard(w, playerId, c.id))}>
              {c.def.label} <span className="muted small">({c.left} left)</span>
            </button>
          ))}
        </div>
      )}
      {hand.length === 0 && <p className="small muted" style={{ margin: 0 }}>Hire a lawyer (and staff with renewal, closing, dispute or bonus skills) for cards to play at the table.</p>}
    </div>
  );
}
