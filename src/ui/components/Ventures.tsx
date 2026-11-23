import {
  VENTURES,
  VENTURE_KINDS,
  VENTURE_SALE_SHARE,
  businessShare,
  buyVenture,
  personalWealth,
  sellVenture,
  ventureBlock,
  venturesOf,
  type World,
} from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";

const range = (r: [number, number]) => `${Math.round(r[0] * 100)}% to +${Math.round(r[1] * 100)}% a year`;

/** The client's own businesses: what he owns, and what he could start with his money. */
export function VenturesPanel({ world, game, clientId }: { world: World; game: Game; clientId: string }) {
  const wp = world.players[clientId]!;
  const owned = venturesOf(wp);
  const share = businessShare(wp);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>His businesses</h2>
        <span className="muted small">
          Paid from his own money ({money(personalWealth(wp))}). Results come in each winter. {share ? `Your contract takes ${Math.round(share * 100)}% of the profits.` : "Your contract takes no share."}
        </span>
      </div>
      {owned.length > 0 && (
        <ul className="small" style={{ marginTop: 0 }}>
          {owned.map((v) => (
            <li key={v.kind}>
              <strong>{VENTURES[v.kind].label}</strong> since season {v.since} · {money(v.stake)} in
              {v.last !== undefined && <> · last winter {v.last >= 0 ? "+" : "−"}{money(Math.abs(v.last))}</>}{" "}
              <button className="linkish" onClick={() => confirm(`Close it for ${money(Math.round(v.stake * VENTURE_SALE_SHARE))}?`) && game.act((w) => void sellVenture(w, clientId, v.kind))}>
                Close ({Math.round(VENTURE_SALE_SHARE * 100)}% back)
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="choice-list">
        {VENTURE_KINDS.filter((k) => !owned.some((v) => v.kind === k)).map((k) => {
          const d = VENTURES[k];
          const block = ventureBlock(world, clientId, k);
          return (
            <button key={k} className="choice" disabled={!!block} onClick={() => confirm(`Start a ${d.label.toLowerCase()} for ${money(d.cost)} of his money?`) && game.act((w) => buyVenture(w, clientId, k))}>
              <strong>{d.label} · {money(d.cost)}</strong>
              <span className="secondary small">{d.blurb}</span>
              <span className="small">{range(d.returnRange)}{d.day ? ` · a ${d.day} day every fourth week` : ""}{d.qBonus ? ` · Q +${d.qBonus}` : ""}</span>
              {block && <span className="small muted">{block}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
