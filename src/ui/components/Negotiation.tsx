import { useState } from "react";
import { MAX_ROUNDS, describeTerms, warmth, type PromiseKind, type World } from "../../season";
import type { Game } from "../useGame";
import { PromisePicker } from "./Promises";

/** The negotiation table, for the talks going on (or just finished) with this player. */
export function NegotiationTable({ world, game, playerId, onClose }: { world: World; game: Game; playerId: string; onClose: () => void }) {
  const n = world.negotiation;
  const wp = world.players[playerId];
  const start = n?.counter ?? [...(n?.lines ?? [])].reverse().find((l) => l.terms)?.terms;
  const current = wp?.client?.contract.commission ?? 0.1;
  const [commission, setCommission] = useState(Math.round((start?.commission ?? current) * 100));
  const [years, setYears] = useState(start?.years ?? 2);
  const [promises, setPromises] = useState<PromiseKind[]>(start?.promises ?? []);
  if (!n || n.playerId !== playerId || !wp) return null;
  const open = n.status === "open";
  const terms = { commission: commission / 100, years, promises };
  const finish = () => {
    game.act((w) => {
      if (w.negotiation?.status === "open") game.lib.abandonNegotiation(w);
      delete w.negotiation;
    });
    onClose();
  };
  return (
    <div className="player-page" role="dialog" aria-modal="true" aria-labelledby="neg-title">
      <div className="player-page-inner" style={{ maxWidth: 760 }}>
        <section className="panel">
          <div className="panel-head">
            <h2 id="neg-title">{n.kind === "sign" ? "Signing" : "Extending"} {wp.player.name}</h2>
            <span className="small">
              Round {Math.min(n.round + (open ? 1 : 0), MAX_ROUNDS)} of {MAX_ROUNDS} · Patience{" "}
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
          {open ? (
            <>
              {n.counter && (
                <div className="btn-row" style={{ alignItems: "center" }}>
                  <button className="btn btn-primary" onClick={() => game.act((w) => game.lib.acceptCounter(w))}>Accept his terms</button>
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
                    {[1, 2, 3].map((y) => <option key={y} value={y}>{y} season{y === 1 ? "" : "s"}</option>)}
                  </select>
                </label>
                <span className="small">Your read: <strong>{warmth(world, n, terms)}</strong></span>
              </div>
              <PromisePicker wp={wp} value={promises} onChange={setPromises} />
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={() => game.act((w) => game.lib.makeOffer(w, terms))}>Make this offer</button>
                <button className="btn" onClick={finish}>Leave the table</button>
              </div>
              <p className="muted small" style={{ marginBottom: 0 }}>Each offer that falls short costs patience (a lowball costs double). He counters with the smallest change that would get it done; accept it, or try something else.</p>
            </>
          ) : (
            <div className="btn-row">
              <button className="btn btn-primary" onClick={finish}>{n.status === "agreed" ? "Done" : "Close"}</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
