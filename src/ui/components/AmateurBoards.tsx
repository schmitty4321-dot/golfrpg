import {
  recruitMark,
  recruitingWindow,
  schoolLabel,
  stars,
  standingMove,
  standingOrder,
  toggleShortlist,
  type World,
} from "../../season";
import { Stars } from "./Stars";
import type { Game } from "../useGame";

/** 1st, 2nd, 3rd, 4th... */
export const ordinal = (n: number): string => {
  const v = n % 100;
  return `${n}${["th", "st", "nd", "rd"][(v - 20) % 10] ?? ["th", "st", "nd", "rd"][v] ?? "th"}`;
};

/** Up or down by how many places since last week's standing. */
export function MoveArrow({ move }: { move: number | null }) {
  if (!move) return <span className="muted small">–</span>;
  return move > 0 ? <span className="good-text small" title={`Up ${move} since last week`}>▲ {move}</span> : <span className="bad-text small" title={`Down ${-move} since last week`}>▼ {-move}</span>;
}

/** An amateur's season in a short line for the desk: wins, top 10s and top 20s. */
export function seasonShort(world: World, id: string): string {
  const r = world.amateurRecords?.[id];
  return r ? `${r.wins}W · ${r.top10} T10 · ${r.top20} T20` : "–";
}

/** An amateur's season so far, for his card: events, wins, top tens and twenties, best and last finish, and his place. */
export function SeasonLine({ world, id }: { world: World; id: string }) {
  const place = standingOrder(world).indexOf(id) + 1;
  const move = standingMove(world, id);
  const r = world.amateurRecords?.[id];
  if (!r) return <div className="small muted">No events yet this season. Standing #{place}.</div>;
  return (
    <div className="small">
      This season: {r.events} events · {r.wins} wins · {r.top10} top 10s · {r.top20} top 20s · best {ordinal(r.best)} · last {ordinal(r.lastFinish ?? r.best)} · standing #{place} <MoveArrow move={move} />
    </div>
  );
}

/** This week's amateur event: the finish order, and where his board players finished. */
export function AmateurResults({ world }: { world: World; game: Game }) {
  const ev = world.amateurEvent;
  if (!ev) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>Amateur results</h2></div>
        <p className="empty">No amateur event yet. The first one is played at the end of week 1.</p>
      </section>
    );
  }
  const board = new Set(world.agency.shortlist ?? []);
  const row = (id: string, place: number) => {
    const wp = world.players[id]!;
    return (
      <tr key={id}>
        <td className="num">{place}</td>
        <td>{wp.player.name}{board.has(id) && <span className="sponsor-tag">On board</span>}</td>
        <td className="small">{schoolLabel(world, wp)}</td>
        <td><Stars value={stars(world, id)} /></td>
        <td><MoveArrow move={standingMove(world, id)} /></td>
      </tr>
    );
  };
  const top = ev.finishes.slice(0, 20).map((id, i) => row(id, i + 1));
  const below = ev.finishes.map((id, i) => ({ id, place: i + 1 })).filter((x) => x.place > 20 && board.has(x.id)).map((x) => row(x.id, x.place));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Amateur results · week {ev.week}</h2>
        <span className="secondary small">{ev.field} amateurs, one event, no rounds</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th className="num">Place</th><th>Amateur</th><th>School</th><th>Stars</th><th>Standing</th></tr></thead>
          <tbody>{top}{below}</tbody>
        </table>
      </div>
      {below.length > 0 && <p className="muted small">Board players outside the top 20 are listed under the line of finishers above.</p>}
    </section>
  );
}

/** The players you're monitoring: their place on the standing, their results this season, and where recruiting stands. */
export function ScoutingBoard({ world, game }: { world: World; game: Game }) {
  const order = standingOrder(world);
  const rank = new Map(order.map((id, i) => [id, i]));
  const ids = (world.agency.shortlist ?? [])
    .filter((id) => world.players[id]?.career.status === "amateur")
    .sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  const closed = recruitingWindow(world);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Scouting board</h2>
        <span className="secondary small">{ids.length} on your board</span>
      </div>
      {closed && <p className="small muted">{closed}</p>}
      {ids.length === 0 ? (
        <p className="empty">Your board is empty. Add amateurs from their card on the desk to follow them here.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">#</th><th>Move</th><th>Amateur</th><th>School</th><th>Stars</th>
                <th className="num">Wins</th><th className="num">Top 10s</th><th className="num">Top 20s</th><th className="num">Best</th><th className="num">Last week</th>
                <th>Recruiting</th><th />
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const wp = world.players[id]!;
                const r = world.amateurRecords?.[id];
                const mark = recruitMark(world, id);
                return (
                  <tr key={id}>
                    <td className="num">{(rank.get(id) ?? 0) + 1}</td>
                    <td><MoveArrow move={standingMove(world, id)} /></td>
                    <td>{wp.player.name}</td>
                    <td className="small">{schoolLabel(world, wp)}</td>
                    <td><Stars value={stars(world, id)} /></td>
                    <td className="num">{r?.wins ?? 0}</td>
                    <td className="num">{r?.top10 ?? 0}</td>
                    <td className="num">{r?.top20 ?? 0}</td>
                    <td className="num">{r ? ordinal(r.best) : "–"}</td>
                    <td className="num">{r?.lastFinish ? ordinal(r.lastFinish) : "–"}</td>
                    <td className="small">{mark === "keen" ? "Leaning in" : mark === "recruiting" ? "Recruiting" : "Not worked on"}</td>
                    <td><button className="btn btn-small" onClick={() => game.act((w) => toggleShortlist(w, id))}>Remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
