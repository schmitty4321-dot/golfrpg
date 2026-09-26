import { SEASON_WEEKS, eventsInWeek, type World } from "../../season";
import { TIER_LABELS, millions, toPar } from "../format";
import type { Go } from "../nav";
import type { Game } from "../useGame";

export function Calendar({ world, game, go }: { world: World; game: Game; go: Go }) {
  const winners = new Map<string, { name: string; toPar: number }>();
  for (const wp of Object.values(world.players)) {
    for (const r of wp.career.results) {
      if (r.season === world.season && r.position === 1) winners.set(r.eventId, { name: wp.player.name, toPar: r.toPar });
    }
  }
  const mine = new Map(world.players[world.clientId]!.career.results.filter((r) => r.season === world.season).map((r) => [r.eventId, r]));
  const inSession = new Set(game.state.reports.flatMap((r) => r.results.map((x) => x.event.id)));

  return (
    <main>
      <section className="panel">
        <div className="panel-head"><h2>Season {world.season} calendar</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Week</th><th>Event</th><th>Type</th><th>Venue</th><th className="num">Purse</th><th>Winner</th><th>Your client</th></tr></thead>
            <tbody>
              {Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).flatMap((week) =>
                eventsInWeek(world, week).map((e) => {
                  const w = winners.get(e.id);
                  const r = mine.get(e.id);
                  const course = world.courses.find((c) => c.id === e.courseId)!;
                  return (
                    <tr key={e.id} className={week === world.week ? "me" : ""}>
                      <td>{week}</td>
                      <td>
                        {inSession.has(e.id) ? <button className="linkish" onClick={() => go("tournament", e.id)}>{e.name}</button> : e.name}
                      </td>
                      <td><span className={`badge${e.tier === "major" ? " badge-major" : ""}`}>{TIER_LABELS[e.tier]}</span></td>
                      <td className="secondary">{course.name}</td>
                      <td className="num">{millions(e.purse)}</td>
                      <td>{w ? `${w.name} (${toPar(w.toPar)})` : week < world.week ? "–" : ""}</td>
                      <td>{r ? `${r.label}${r.via === "monday" ? " (MQ)" : ""}` : ""}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
