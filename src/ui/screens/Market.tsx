import { useState } from "react";
import { Binoculars, DoorOpen, FileSearch, LockKeyhole, UsersRound } from "lucide-react";
import { LegacyPanel } from "../components/Legacy";
import { createRng } from "../../engine";
import {
  STATUS_LABELS,
  acceptChance,
  agencyTable,
  approachBlock,
  ceilingStars,
  knowsHidden,
  mixSeed,
  legacyScore,
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
  rivalCapacity,
  type Trophy,
  type World,
} from "../../season";
import { PlayerName } from "../components/PlayerLink";
import { Stars } from "../components/Stars";
import { money } from "../format";
import type { Game } from "../useGame";
import { Portrait } from "../components/Portrait";
import { RecruitingDesk } from "../components/RecruitingDesk";

const crest = (name: string) => ({
  "Apex Sports Management": "★", "Fairway Global": "◎", "Links & Co.": "♜", "Pinnacle Talent": "♠", "Clubhouse Partners": "♛", "Eagle Rock Agency": "◆",
}[name] ?? "FM");
/** World rank → player id, to link the agency table's best players (it keeps only name and rank). */
const rankIds = (world: World) => new Map([...rankMap(world)].map(([id, rank]) => [rank, id]));
const styleIcon = (id: string) => id === "stars" ? "★" : id === "developer" ? "♠" : id === "boutique" ? "◆" : "♟";

/** The recruiting desk: the amateurs you can look at this week. */
export function Recruiting({ world, game }: { world: World; game: Game }) {
  return (
    <main>
      <RecruitingDesk world={world} game={game} />
    </main>
  );
}

/** The recruitment board: players you're tracking, where they stand, and whether you can sign them. */
export function RecruitmentBoard({ world, game }: { world: World; game: Game }) {
  const ranks = rankMap(world);
  const board = (world.agency.shortlist ?? []).map((id) => world.players[id]).filter((wp) => wp && !wp.client);
  const scouted = board.filter((wp) => (world.agency.knowledge[wp!.player.id]?.accuracy ?? 0) > 0).length;
  const attainable = board.filter((wp) => !approachBlock(world, wp!.player.id)).length;
  const signingState = (block: string | null) => {
    if (!block) return { label: "Available", tone: "available", Icon: DoorOpen };
    if (block.includes("can manage")) return { label: "Roster full", tone: "blocked", Icon: LockKeyhole };
    if (block.includes("bigger name")) return { label: "Reputation too low", tone: "warning", Icon: FileSearch };
    if (block.includes("under contract")) return { label: "Under contract", tone: "warning", Icon: FileSearch };
    if (block.includes("turned you down")) return { label: "Cooling off", tone: "blocked", Icon: LockKeyhole };
    return { label: "Not available", tone: "blocked", Icon: LockKeyhole };
  };
  return (
    <main className="recruitment-war-room">
      <section className="recruitment-board-hero">
        <img src="art/recruitment/scouting-war-room.png" alt="Rangefinder, player dossiers and a world scouting map in the agency war room" />
        <div className="recruitment-board-hero-copy">
          <span>Talent intelligence</span>
          <h1>Scouting War Room</h1>
          <p>Identify talent. Uncover opportunity. Build tomorrow’s roster.</p>
        </div>
      </section>
      <section className="recruitment-board-metrics" aria-label="Recruitment board summary">
        <div><span className="recruitment-metric-icon"><UsersRound /></span><strong>{board.length}</strong><span><b>On the board</b><small>Players currently tracked</small></span></div>
        <div><span className="recruitment-metric-icon gold"><Binoculars /></span><strong>{scouted}</strong><span><b>Scouted</b><small>Players with completed reports</small></span></div>
        <div><span className="recruitment-metric-icon"><DoorOpen /></span><strong>{attainable}</strong><span><b>Potentially attainable</b><small>Realistic signing opportunities</small></span></div>
      </section>
      <section className="panel recruitment-board-panel">
        <div className="panel-head"><h2>Player dossiers</h2><span className="muted small">Add players from their profile · {board.length} on the board</span></div>
        {board.length === 0 ? (
          <p className="empty">Nobody on your watch list yet. Open any player (from Scouting, a leaderboard or the standings) and press "Add to watch list".</p>
        ) : (
          <div className="recruitment-dossiers">
            {board.map((wp) => {
                  const id = wp!.player.id;
                  const k = world.agency.knowledge[id];
                  const accuracy = k?.accuracy ?? 0;
                  const ceiling = knowsHidden(world, id)
                    ? potentialEstimate(wp!, 4 + accuracy * 16, createRng(mixSeed(world.seed, world.season, Number(id.replace(/\D/g, "")) || 3)))
                    : null;
                  const block = approachBlock(world, id);
                  const chance = block ? 0 : acceptChance(world, id, { commission: 0.1, years: 2 });
                  const state = signingState(block);
                  return (
                    <article className="recruitment-dossier" key={id}>
                      <div className="recruitment-player">
                        <PlayerName id={id}>{wp!.player.name}</PlayerName>
                        <span>World rank <strong>{ranks.get(id) ? `#${ranks.get(id)}` : "—"}</strong></span>
                      </div>
                      <div className="recruitment-facts">
                        <span><small>Age</small><b>{wp!.player.age}</b></span>
                        <span><small>Status</small><b>{STATUS_LABELS[wp!.career.status]}</b></span>
                        <span><small>Represented by</small><b>{wp!.agent ? `${wp!.agent.agency} · S${wp!.agent.untilSeason}` : "Free agent"}</b></span>
                      </div>
                      <div className="recruitment-scouting">
                        <span><Binoculars size={15} /><b>Scouting report</b><strong>{Math.round(accuracy * 100)}%</strong></span>
                        <div className="recruitment-scout-bar"><i style={{ width: `${accuracy * 100}%` }} /></div>
                        <small>{accuracy > 0 ? `Level ~${overall(wp!.player).toFixed(0)} · ${accuracy >= .6 ? "Detailed read" : "Early read"}` : "Not yet scouted."}</small>
                      </div>
                      <div className="recruitment-ceiling"><small>Ceiling</small>{ceiling === null ? <span className="muted">Unknown</span> : <Stars value={ceilingStars(ceiling)} />}</div>
                      <div className={`recruitment-signing ${state.tone}`}>
                        <state.Icon size={22} />
                        <span><b>{state.label}</b><small>{block ?? `${Math.round(chance * 100)}% chance at 10% commission for 2 seasons`}{!block && competingBid(world, id) ? ` · Competing with ${competingBid(world, id)!.agency}` : ""}</small></span>
                      </div>
                      <button className="btn btn-small recruitment-remove" onClick={() => game.act((w) => toggleShortlist(w, id))}>Remove</button>
                    </article>
                  );
                })}
          </div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>At each season's end the board tells you who became a free agent and whose deal is about to run out.</p>
      </section>
    </main>
  );
}

/** The agency league: every agency's players and results this season, and which of your clients rivals are circling. */
export function Rivals({ world }: { world: World }) {
  const rows = agencyTable(world);
  const byRank = rankIds(world);
  const watched = world.clientIds.map((id) => world.players[id]!).filter((wp) => poachRisk(wp) !== "none");
  return (
    <main className="rivals-page">
      <section className="panel agency-league-panel">
        <div className="panel-head"><h2>Agency league</h2><span className="muted small">Season {world.season} · by players' earnings</span></div>
        <div className="table-wrap">
          <table className="agency-league-table">
            <thead><tr><th className="num">#</th><th>Agency</th><th>Head agent</th><th className="num">Players</th><th className="num">Wins</th><th className="num">Majors</th><th className="num">Earnings</th><th>Best player</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name} className={r.yours ? "row-current" : undefined}>
                  <td className="num"><span className={`league-rank rank-${i + 1}`}>{i + 1}</span></td>
                  <td><span className="agency-crest mini">{r.yours ? "FM" : crest(r.name)}</span>{r.yours ? <strong>{r.name}</strong> : r.name}</td>
                  <td><div className="league-person"><Portrait player={{ id: `league-agent-${r.name}`, nationality: "USA", age: r.yours ? 34 : 55 }} {...(!r.yours && agentOf(r.name).portrait ? { index: agentOf(r.name).portrait } : {})} size={36} title={r.yours ? "You" : agentOf(r.name).agent} /><span>{r.yours ? "You" : agentOf(r.name).agent}</span></div></td>
                  <td className="num">{r.clients}</td>
                  <td className="num">{r.wins}</td>
                  <td className="num">{r.majors}</td>
                  <td className="num">{money(r.earnings)}</td>
                  <td>{r.best ? <div className="league-person"><Portrait player={{ id: `league-best-${r.best.name}`, nationality: "USA", age: 29 }} size={34} title={r.best.name} /><span><PlayerName id={byRank.get(r.best.rank) ?? ""}>{r.best.name}</PlayerName> (#{r.best.rank})</span></div> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <RivalAgencies world={world} />
      <section className="panel rivals-circling-panel">
        <div className="panel-head"><h2>Rivals circling</h2><span className="muted small">Unhappy clients get calls at season's end</span></div>
        {watched.length === 0 ? (
          <p className="empty">Your clients are happy enough that rivals aren't calling.</p>
        ) : (
          <div className="circling-table">
            <div className="circling-head"><span>Client</span><span>Your relationship</span><span>Threatened by</span><span>Rival style</span><span>Intensity</span><span /></div>
            {watched.map((wp, index) => {
              const bid = competingBid(world, wp.player.id);
              const rival = bid?.agency ?? rivalSummaries(world)[index % Math.max(1, rivalSummaries(world).length)]?.rival.name ?? "Rival agency";
              const rivalStyle = rivalSummaries(world).find((r) => r.rival.name === rival)?.style;
              const intensity = poachRisk(wp) === "threat" ? 5 : 3;
              return <div className="circling-row" key={wp.player.id}>
                <div className="league-person"><Portrait player={wp.player} size={36} title={wp.player.name} /><strong><PlayerName id={wp.player.id}>{wp.player.name}</PlayerName></strong></div>
                <span className={`relationship ${wp.client!.happiness >= 65 ? "friendly" : wp.client!.happiness < 35 ? "hostile" : "neutral"}`}>{wp.client!.happiness >= 65 ? "☺ Happy" : wp.client!.happiness < 35 ? "☹ Unhappy" : "● Neutral"} ({Math.round(wp.client!.happiness)})</span>
                <div className="circling-agency"><span className="agency-crest mini">{crest(rival)}</span>{rival}</div>
                <div className="circling-style"><span>{styleIcon(rivalSummaries(world).find((r) => r.rival.name === rival)?.rival.style ?? "stars")}</span>{rivalStyle?.label ?? "Star hunter"}</div>
                <div className={`threat-meter threat-${intensity}`}>{Array.from({ length: 7 }, (_, i) => <i className={i < intensity ? "on" : ""} key={i} />)}</div>
                <span className="circling-phone" title="A rival is making calls">☎</span>
              </div>;
            })}
          </div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>If a rival takes a client mid-contract they pay you a buyout of about half a season's commission.</p>
      </section>
    </main>
  );
}

/** Who the rivals are, how they work, and what they did last winter. */
function RivalAgencies({ world }: { world: World }) {
  const rows = rivalSummaries(world).sort((a, b) => b.rival.reputation - a.rival.reputation);
  const byRank = rankIds(world);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="panel">
      <div className="panel-head"><h2>The rivals</h2><span className="muted small">Your reputation: {Math.round(world.agency.reputation)}</span></div>
      <div className="rival-card-grid">
            {rows.map(({ rival, style, players, deals }) => {
              const best = agencyTable(world).find((a) => a.name === rival.name)?.best;
              return (
              <article className="rival-card" key={rival.name}>
                <div className="rival-card-head"><span className="agency-crest">{crest(rival.name)}</span><strong>{rival.name}</strong></div>
                <div className="rival-agent"><Portrait player={{ id: `staff-${rival.name}`, nationality: "USA", age: 55 }} {...(agentOf(rival.name).portrait ? { index: agentOf(rival.name).portrait } : {})} size={118} title={agentOf(rival.name).agent} /><div><strong>{agentOf(rival.name).agent}</strong><span className={`relationship ${(rival.relationship ?? 0) <= -20 ? "hostile" : (rival.relationship ?? 0) >= 20 ? "friendly" : "neutral"}`}>{relationshipWord(rival.relationship ?? 0)} ({Math.round(rival.relationship ?? 0)})</span></div></div>
                <dl><div><dt>Reputation</dt><dd>{Math.round(rival.reputation)}</dd></div><div><dt>Players</dt><dd>{players}/{rivalCapacity(rival)}</dd></div><div><dt>Dev deals</dt><dd>{deals}</dd></div></dl>
                <div className="rival-style" title={style.blurb}><span>{styleIcon(rival.style)}</span><div><strong>{style.label}</strong><small>{style.blurb}</small></div></div>
                <div className="small rival-moves">
                  {rival.moves.length === 0 ? (
                    <span className="muted">No moves last winter</span>
                  ) : (
                    <button className="linkish" onClick={() => setOpen(open === rival.name ? null : rival.name)}>{rival.moves.length} move{rival.moves.length === 1 ? "" : "s"}</button>
                  )}
                  <span>{style.coach > 0 ? `Coaching +${style.coach}` : style.coach < 0 ? `Budget coaching ${style.coach}` : "Average coaching"}</span>
                </div>
                {best && <div className="rival-best"><Portrait player={{ id: `rival-best-${best.name}`, nationality: "USA", age: 29 }} size={34} title={best.name} /><span>Best player: <strong><PlayerName id={byRank.get(best.rank) ?? ""}>{best.name}</PlayerName></strong> (#{best.rank})</span></div>}
              </article>
            )})}
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
    <main className="trophies-page">
      <section className="trophy-room-hero">
        <img src="art/trophies/legacy-room.png" alt="Illustrated agency trophy room and hall of fame" />
        <div className="trophy-room-shade" />
        <div className="trophy-room-copy"><span>AGENCY LEGACY</span><h1>A history still being written</h1><p>Every victory, champion and era earns a permanent place in the room.</p></div>
        <div className="legacy-score-seal"><small>LEGACY SCORE</small><strong>{legacyScore(world)}</strong><span>{list.length ? `${list.length} honours collected` : "The first chapter awaits"}</span></div>
      </section>
      <LegacyPanel world={world} />
      <section className="panel trophy-cabinet-panel">
        <div className="panel-head"><h2>Trophy cabinet</h2><span className="muted small">Won while they were your clients</span></div>
        <div className="trophy-count-grid">
          {(["major", "win", "pointsTitle", "award"] as Trophy["kind"][]).map((k, i) => (
            <div key={k} className={`trophy-count trophy-count-${k}`}><span className="trophy-count-icon">{["♛", "♜", "№1", "★"][i]}</span><div><small>{TROPHY_LABELS[k]}</small><strong>{count(k)}</strong><em>{count(k) ? "In the cabinet" : "Plinth waiting"}</em></div></div>
          ))}
        </div>
      </section>
      <section className="panel reputation-gallery-panel">
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
      <section className="panel honours-gallery-panel">
        <div className="panel-head"><h2>Honours</h2></div>
        {list.length === 0 ? (
          <div className="empty-honours"><div className="empty-plinths"><span>♛</span><span>♜</span><span>★</span></div><strong>The cabinet is ready</strong><p>A client win places the first trophy here. Majors, season titles and awards receive their own display.</p></div>
        ) : (
          <div className="honours-card-grid">{list.map((t, i) => <article className={`honour-card honour-${t.kind}`} key={i}><span>{t.kind === "major" ? "♛" : t.kind === "pointsTitle" ? "№1" : t.kind === "award" ? "★" : "♜"}</span><small>Season {t.season}</small><strong>{t.title}</strong><em>{t.player ?? world.agency.name}</em></article>)}</div>
        )}
      </section>
    </main>
  );
}
