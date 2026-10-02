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
  RIVAL_STYLES,
  competingBid,
  rivalSummaries,
  agentOf,
  relationshipWord,
  potentialEstimate,
  rankMap,
  toggleShortlist,
  type Trophy,
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
                      <td className="small">{block ?? `${Math.round(chance * 100)}% at 10%, 2 seasons`}{!block && competingBid(world, id) ? <><br /><span className="muted">vs {competingBid(world, id)!.agency}</span></> : null}</td>
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
      <RivalAgencies world={world} />
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

/** Who the rivals are, how they work, and what they did last winter. */
function RivalAgencies({ world }: { world: World }) {
  const rows = rivalSummaries(world).sort((a, b) => b.rival.reputation - a.rival.reputation);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="panel">
      <div className="panel-head"><h2>The rivals</h2><span className="muted small">Your reputation: {Math.round(world.agency.reputation)}</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Agency</th><th>Head agent</th><th>Style</th><th className="num">Reputation</th><th className="num">Players</th><th className="num">Dev deals</th><th>Coaching</th><th>Last winter</th></tr></thead>
          <tbody>
            {rows.map(({ rival, style, players, deals }) => (
              <tr key={rival.name}>
                <td>{rival.name}</td>
                <td>{agentOf(rival.name).agent} <span className={`small ${(rival.relationship ?? 0) <= -20 ? "bad-text" : (rival.relationship ?? 0) >= 20 ? "good-text" : "muted"}`}>· {relationshipWord(rival.relationship ?? 0)} ({Math.round(rival.relationship ?? 0)})</span></td>
                <td title={style.blurb}>{style.label}</td>
                <td className="num">{Math.round(rival.reputation)}</td>
                <td className="num">{players} / {style.capacity}</td>
                <td className="num">{deals}</td>
                <td className="small">{style.coach > 0 ? `Better than average (+${style.coach})` : style.coach < 0 ? `Cheap (${style.coach})` : "Average"}</td>
                <td className="small">
                  {rival.moves.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    <button className="linkish" onClick={() => setOpen(open === rival.name ? null : rival.name)}>{rival.moves.length} move{rival.moves.length === 1 ? "" : "s"}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <ul className="small" style={{ marginTop: 10 }}>
          {(rows.find((r) => r.rival.name === open)?.rival.moves ?? []).slice(0, 25).map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>
        {Object.values(RIVAL_STYLES).map((s) => `${s.label}: ${s.blurb}`).join(" ")} Every player who comes free in the winter goes to the best bid, so sign the ones you want first. Head agents remember how you answer their messages: hostile ones bid harder against you and come for your unhappy clients; friendly ones ease off and pass on the odd tip.
      </p>
    </section>
  );
}

const TROPHY_LABELS: Record<Trophy["kind"], string> = { major: "Majors", win: "Wins", pointsTitle: "Points titles", award: "Awards" };

/** The trophy cabinet: what your clients have won for you, the agency's awards, and its reputation over time. */
export function Trophies({ world }: { world: World }) {
  const list = [...(world.agency.trophies ?? [])].reverse();
  const count = (k: Trophy["kind"]) => list.filter((t) => t.kind === k).length;
  const rep = world.agency.repHistory ?? [];
  const W = 640;
  const H = 160;
  const x = (i: number) => 40 + (rep.length > 1 ? (i / (rep.length - 1)) * (W - 56) : 0);
  const y = (v: number) => 12 + ((100 - v) / 100) * (H - 36);
  return (
    <main>
      <section className="panel">
        <div className="panel-head"><h2>Trophy cabinet</h2><span className="muted small">Won while they were your clients</span></div>
        <div className="player-stat-grid">
          {(["major", "win", "pointsTitle", "award"] as Trophy["kind"][]).map((k) => (
            <div key={k} className="player-stat"><span>{TROPHY_LABELS[k]}</span><strong>{count(k)}</strong></div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Reputation</h2><span className="muted small">At each season's end · now {Math.round(world.agency.reputation)}</span></div>
        {rep.length === 0 ? (
          <p className="empty">The line starts when your first season closes.</p>
        ) : (
          <svg className="sg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Reputation by season: ${rep.map((r) => `season ${r.season} ${Math.round(r.reputation)}`).join(", ")}`}>
            {[0, 25, 50, 75, 100].map((t) => (
              <g key={t}>
                <line x1={40} x2={W - 16} y1={y(t)} y2={y(t)} className="chart-grid" />
                <text x={34} y={y(t) + 4} textAnchor="end" className="chart-axis">{t}</text>
              </g>
            ))}
            <path d={rep.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r.reputation).toFixed(1)}`).join("")} className="chart-line" />
            {rep.map((r, i) => (
              <g key={r.season}>
                <circle cx={x(i)} cy={y(r.reputation)} r="3.5" className="dev-dot" />
                <text x={x(i)} y={H - 6} textAnchor="middle" className="chart-axis">S{r.season}</text>
              </g>
            ))}
          </svg>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Honours</h2></div>
        {list.length === 0 ? (
          <p className="empty">Nothing in the cabinet yet. A client win puts the first trophy in it.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Season</th><th>Honour</th><th>Player</th></tr></thead>
              <tbody>
                {list.map((t, i) => (
                  <tr key={i}>
                    <td>{t.season}</td>
                    <td>{t.kind === "major" ? <strong>{t.title} (major)</strong> : t.title}</td>
                    <td>{t.player ?? world.agency.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
