import { useMemo, useState } from "react";
import { ScoutTripsPanel } from "../components/ScoutTrips";
import { EYE_LABELS, REPORTS_PER_WEEK, STATUS_LABELS, approachBlock, knownTraits, pointsList, queueScouting, rankMap, scoutEye, weeklyScoutCost, type TourStatus, type World, knownArchetype } from "../../season";
import { PlayerName, useOpenPlayer } from "../components/PlayerLink";
import { Stars } from "../components/Stars";
import { TraitChips } from "../components/Traits";
import { TRAITS } from "../../engine";
import { money } from "../format";
import type { Game } from "../useGame";
import { Nation } from "../components/Flag";
import { ArchetypeBadge } from "../components/Archetype";
import { Portrait } from "../components/Portrait";

type Filter = "all" | "approachable" | "free";

export function Scouting({ world, game }: { world: World; game: Game }) {
  const openPlayer = useOpenPlayer();
  const [filter, setFilter] = useState<Filter>("approachable");
  const [status, setStatus] = useState<TourStatus | "any">("any");
  const [maxAge, setMaxAge] = useState(50);
  const [q, setQ] = useState("");
  const [trait, setTrait] = useState("any");
  const [show, setShow] = useState(50);
  const ranks = rankMap(world);
  const pts = pointsList(world);
  const a = world.agency;

  const rows = useMemo(
    () =>
      Object.values(world.players)
        .filter((wp) => !wp.client)
        .filter((wp) => filter === "all" || (filter === "free" ? !wp.agent : !approachBlock(world, wp.player.id)))
        .filter((wp) => status === "any" || wp.career.status === status)
        .filter((wp) => wp.player.age <= maxAge)
        .filter((wp) => !q || wp.player.name.toLowerCase().includes(q.toLowerCase()))
        .filter((wp) => trait === "any" || knownTraits(world, wp.player.id).includes(trait))
        .sort((x, y) => (ranks.get(x.player.id) ?? 999) - (ranks.get(y.player.id) ?? 999)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, world.week, filter, status, maxAge, q, trait, a.reputation, world.clientIds.length],
  );

  return (
    <main className="scouting-page">
      <ScoutTripsPanel world={world} game={game} />
      <div className="scouting-workbench">
        <section className="panel scout-market-panel">
          <div className="panel-head">
            <h2>Available scouts</h2>
            <span className="secondary small">{money(weeklyScoutCost(world))}/week · each files {REPORTS_PER_WEEK} reports a week</span>
          </div>
          <div className="scout-card-grid">
              {a.scouts.map((s) => {
                const hired = a.hiredScouts.includes(s.id);
                return (
                  <article className={`scout-card${hired ? " hired" : ""}`} key={s.id}>
                    <Portrait player={{ id: `staff-${s.id}`, nationality: "USA", age: 28 + (Number(s.id.replace(/\D/g, "")) % 28) }} size={72} title={s.name} />
                    <div className="scout-card-copy"><strong>{s.name}</strong><Stars value={Math.max(0.5, Math.round((s.quality / 20) * 10) / 2)} /><span className="scout-specialty">{EYE_LABELS[scoutEye(s)]}</span><span className="small secondary">{money(s.weeklyFee)}/week</span></div>
                      <button className={`btn btn-small${hired ? "" : " btn-primary"}`} onClick={() => game.act((w) => (hired ? game.lib.releaseScout(w, s.id) : game.lib.hireScout(w, s.id)))}>
                        {hired ? "Release" : "Hire"}
                      </button>
                  </article>
                );
              })}
          </div>
          <p className="muted small">Better scouts write more accurate reports. A second report on the same player sharpens it.</p>
        </section>

        <section className="panel scouting-expedition-panel">
          <div className="panel-head"><h2>Scouting expedition</h2><span className="muted small">{(a.trips ?? []).length ? `${(a.trips ?? []).length} active` : "No scout travelling"}</span></div>
          <div className="expedition-map"><img src="/art/scouting/expedition-map.png" alt="Illustrated world scouting map with travel gear" /><span className="expedition-route">✈</span></div>
          {(a.trips ?? []).length > 0 ? <div className="expedition-list">{(a.trips ?? []).map((t) => <div key={t.id}><strong>{a.scouts.find((s) => s.id === t.scoutId)?.name}</strong><span>{t.weeksLeft} week{t.weeksLeft === 1 ? "" : "s"} remaining</span><i><b style={{ width: `${Math.max(8, ((t.weeks - t.weeksLeft) / t.weeks) * 100)}%` }} /></i></div>)}</div> : <p className="empty">Hire a scout and choose a region to begin an expedition.</p>}
        </section>
      </div>

      <div className="scouting-reports-grid">
      <section className="panel player-reports-panel">
        <div className="panel-head"><h2>Player reports</h2><span className="muted small">{rows.length} players</span></div>
        <div className="btn-row" style={{ alignItems: "center", marginBottom: 12 }}>
          <div className="tabs" role="tablist" style={{ margin: 0 }}>
            {(["approachable", "free", "all"] as Filter[]).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
                {f === "approachable" ? "Can approach now" : f === "free" ? "Free agents" : "Everyone"}
              </button>
            ))}
          </div>
          <select aria-label="Tour status" value={status} onChange={(e) => setStatus(e.target.value as TourStatus | "any")}>
            <option value="any">Any status</option>
            {(Object.keys(STATUS_LABELS) as TourStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <label className="small secondary">Max age <input type="number" min={16} max={50} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value) || 50)} style={{ width: 64 }} /></label>
          <select aria-label="Trait" value={trait} onChange={(e) => setTrait(e.target.value)}>
            <option value="any">Any trait</option>
            {[...TRAITS].sort((x, y) => x.name.localeCompare(y.name)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="text" placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Player</th><th className="num">Age</th><th>Status</th><th className="num">World</th><th className="num">Points</th><th>Agent</th><th>Report</th><th>Traits</th><th /></tr></thead>
            <tbody>
              {rows.slice(0, show).map((wp) => {
                const id = wp.player.id;
                const k = a.knowledge[id];
                const queued = a.scoutingQueue.includes(id);
                return (
                  <tr key={id}>
                    <td>{(() => { const arch = knownArchetype(world, id); return arch ? <ArchetypeBadge id={arch} size={18} /> : null; })()} <PlayerName id={id}>{wp.player.name}</PlayerName> <Nation nationality={wp.player.nationality} /></td>
                    <td className="num">{wp.player.age}</td>
                    <td className="secondary small">{STATUS_LABELS[wp.career.status]}</td>
                    <td className="num">{ranks.get(id) ?? "—"}</td>
                    <td className="num">{pts.indexOf(id) >= 0 ? `#${pts.indexOf(id) + 1}` : "—"}</td>
                    <td className="small">{wp.agent ? `${wp.agent.agency} (S${wp.agent.untilSeason})` : <span className="good-text">Free agent</span>}</td>
                    <td className="small">{k ? `${Math.round(k.accuracy * 100)}%` : <span className="muted">None</span>}</td>
                    <td><TraitChips ids={knownTraits(world, id)} empty={k ? "None spotted" : "Unscouted"} /></td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-small" disabled={queued} onClick={() => game.act((w) => queueScouting(w, id))}>{queued ? "Queued" : "Scout"}</button>
                        <button className="btn btn-small" onClick={() => openPlayer?.(id)}>View</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > show && <button className="linkish" style={{ marginTop: 8 }} onClick={() => setShow(show + 50)}>Show 50 more</button>}
      </section>
      <section className="panel scouting-queue-panel">
        <div className="panel-head"><h2>Scouting queue</h2><span className="muted small">{a.scoutingQueue.length} waiting</span></div>
        {a.hiredScouts.length === 0 && <p className="bad-text small">No scouts hired: nobody is working through this queue.</p>}
        {a.scoutingQueue.length === 0 ? <div className="queue-empty"><span>＋</span><strong>Nothing queued</strong><p>Pick a player from the reports and press Scout.</p></div> : <div className="queue-paper-list">{a.scoutingQueue.map((id) => <article key={id}><span className="queue-pin">●</span><Portrait player={world.players[id]!.player} size={42} title={world.players[id]!.player.name} /><div><strong><PlayerName id={id}>{world.players[id]?.player.name ?? "Retired player"}</PlayerName></strong><small>Waiting for a report</small></div><button className="linkish small" onClick={() => game.act((w) => (w.agency.scoutingQueue = w.agency.scoutingQueue.filter((x) => x !== id)))}>×</button></article>)}</div>}
      </section>
      </div>
    </main>
  );
}
