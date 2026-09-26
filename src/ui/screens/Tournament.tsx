import { coursePar, courseYards } from "../../engine";
import type { World } from "../../season";
import { Leaderboard } from "../components/Leaderboard";
import { TIER_LABELS, millions } from "../format";
import type { Game } from "../useGame";

export function Tournament({ world, game, eventId, setEventId }: { world: World; game: Game; eventId?: string; setEventId: (id: string) => void }) {
  const all = game.state.reports.flatMap((r) => r.results.map((x) => ({ ...x, week: r.week })));
  if (all.length === 0) {
    return (
      <main>
        <section className="panel">
          <h2>Leaderboards</h2>
          <p className="empty">No events played this session yet. Leaderboards appear here as weeks are played (they aren't kept in the save file; results are, in the Calendar).</p>
        </section>
      </main>
    );
  }
  const clientEvents = new Set(game.state.reports.map((r) => r.client.record?.eventId).filter(Boolean));
  const selected = all.find((x) => x.event.id === eventId) ?? [...all].reverse().find((x) => clientEvents.has(x.event.id)) ?? all[all.length - 1]!;
  const { event, result } = selected;
  const c = result.course;
  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="event-title">
              <span className={`badge${event.tier === "major" ? " badge-major" : ""}`}>{TIER_LABELS[event.tier]}</span>
              <h2 style={{ fontSize: 20 }}>{event.name}</h2>
            </div>
            <div className="facts" style={{ marginTop: 6 }}>
              <span>Week {selected.week}</span>
              <span>{c.name} ({c.style}), par {coursePar(c)}, {courseYards(c).toLocaleString("en-US")} yds</span>
              <span>Purse {millions(event.purse)}</span>
              {result.cutLine !== null && <span>Cut {result.cutLine > 0 ? `+${result.cutLine}` : result.cutLine === 0 ? "E" : result.cutLine}</span>}
              {result.playoff && <span>Won in a {result.playoff.holesPlayed}-hole playoff</span>}
            </div>
          </div>
          <select aria-label="Choose an event" value={event.id} onChange={(e) => setEventId(e.target.value)}>
            {[...all].reverse().map((x) => (
              <option key={x.event.id} value={x.event.id}>
                Week {x.week}: {x.event.name}{clientEvents.has(x.event.id) ? " ★" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="facts small" style={{ marginBottom: 12 }}>
          {result.weather.map((w, i) => (
            <span key={i}>
              R{i + 1}: wind {Math.round(w.windMph.AM)} mph AM / {Math.round(w.windMph.PM)} PM{w.rain ? ", rain" : ""}
            </span>
          ))}
        </div>
        <Leaderboard key={event.id} result={result} clientId={world.clientId} limit={30} />
      </section>
    </main>
  );
}
