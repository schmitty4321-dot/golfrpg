import { useState } from "react";
import { createRng } from "../../engine";
import {
  STATUS_LABELS,
  acceptChance,
  agencyTable,
  approachBlock,
  ceilingStars,
  knowsHidden,
  mixSeed,
  overall,
  poachRisk,
  potentialEstimate,
  rankMap,
  toggleShortlist,
  type World,
} from "../../season";
import { PlayerProfile } from "../components/PlayerProfile";
import { Stars } from "../components/Stars";
import { money } from "../format";
import type { Game } from "../useGame";

/** The recruitment board: players you're tracking, where they stand, and whether you can sign them. */
export function Recruiting({ world, game }: { world: World; game: Game }) {
  const [profile, setProfile] = useState<string | null>(null);
  const ranks = rankMap(world);
  const board = (world.agency.shortlist ?? []).map((id) => world.players[id]).filter((wp) => wp && !wp.client);
  return (
    <main>
      <section className="panel">
        <div className="panel-head"><h2>Recruitment board</h2><span className="muted small">Add players from their profile · {board.length} on the board</span></div>
        {board.length === 0 ? (
          <p className="empty">Nobody on the board yet. Open any player (from Scouting, a leaderboard or the standings) and press "Add to board".</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Player</th><th className="num">Age</th><th>Status</th><th className="num">World</th><th>Represented by</th><th>Report</th><th>Ceiling</th><th>Can you sign him?</th><th /></tr></thead>
              <tbody>
                {board.map((wp) => {
                  const id = wp!.player.id;
                  const k = world.agency.knowledge[id];
                  const accuracy = k?.accuracy ?? 0;
                  const ceiling = knowsHidden(world, id)
                    ? potentialEstimate(wp!, 4 + accuracy * 16, createRng(mixSeed(world.seed, world.season, Number(id.replace(/\D/g, "")) || 3)))
                    : null;
                  const block = approachBlock(world, id);
                  const chance = block ? 0 : acceptChance(world, id, { commission: 0.1, years: 2 });
                  return (
                    <tr key={id}>
                      <td><button className="linkish" onClick={() => setProfile(id)}>{wp!.player.name}</button></td>
                      <td className="num">{wp!.player.age}</td>
                      <td>{STATUS_LABELS[wp!.career.status]}</td>
                      <td className="num">{ranks.get(id) ? `#${ranks.get(id)}` : "—"}</td>
                      <td>{wp!.agent ? `${wp!.agent.agency} (to S${wp!.agent.untilSeason})` : <strong>Free agent</strong>}</td>
                      <td>{accuracy > 0 ? `${Math.round(accuracy * 100)}% sure · level ~${overall(wp!.player).toFixed(0)}` : <span className="muted">Not scouted</span>}</td>
                      <td>{ceiling === null ? <span className="muted">—</span> : <Stars value={ceilingStars(ceiling)} />}</td>
                      <td className="small">{block ?? `${Math.round(chance * 100)}% at 10%, 2 seasons`}</td>
                      <td><button className="btn btn-small" onClick={() => game.act((w) => toggleShortlist(w, id))}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>At each season's end the board tells you who became a free agent and whose deal is about to run out.</p>
      </section>
      {profile && <PlayerProfile world={world} game={game} id={profile} onClose={() => setProfile(null)} />}
    </main>
  );
}

/** The agency league: every agency's players and results this season, and which of your clients rivals are circling. */
export function Rivals({ world }: { world: World }) {
  const rows = agencyTable(world);
  const watched = world.clientIds.map((id) => world.players[id]!).filter((wp) => poachRisk(wp) !== "none");
  return (
    <main>
      <section className="panel">
        <div className="panel-head"><h2>Agency league</h2><span className="muted small">Season {world.season} · by players' earnings</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th className="num">#</th><th>Agency</th><th className="num">Players</th><th className="num">Wins</th><th className="num">Majors</th><th className="num">Players' earnings</th><th>Best player</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name} className={r.yours ? "row-current" : undefined}>
                  <td className="num">{i + 1}</td>
                  <td>{r.yours ? <strong>{r.name}</strong> : r.name}</td>
                  <td className="num">{r.clients}</td>
                  <td className="num">{r.wins}</td>
                  <td className="num">{r.majors}</td>
                  <td className="num">{money(r.earnings)}</td>
                  <td>{r.best ? `${r.best.name} (#${r.best.rank})` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Rivals circling</h2><span className="muted small">Unhappy clients get calls at season's end</span></div>
        {watched.length === 0 ? (
          <p className="empty">Your clients are happy enough that rivals aren't calling.</p>
        ) : (
          <ul>
            {watched.map((wp) => (
              <li key={wp.player.id}>
                <strong>{wp.player.name}</strong> (mood {Math.round(wp.client!.happiness)}):{" "}
                {poachRisk(wp) === "threat" ? "a real chance he leaves for a rival this winter." : "rivals are listening; below 30 he may go."}
              </li>
            ))}
          </ul>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>If a rival takes a client mid-contract they pay you a buyout of about half a season's commission.</p>
      </section>
    </main>
  );
}
