import { Fragment } from "react";
import { seasonWeeks, eventsInWeek, type World } from "../../season";
import { TIER_LABELS, millions, toPar } from "../format";
import type { Go } from "../nav";
import type { Game } from "../useGame";
import { TournamentCard, TournamentEmblem } from "../components/TournamentLogo";
import { PlayerName } from "../components/PlayerLink";

export function Calendar({ world, game, go }: { world: World; game: Game; go: Go }) {
  const winners = new Map<string, { id: string; name: string; toPar: number }>();
  for (const wp of Object.values(world.players)) {
    for (const r of wp.career.results) {
      if (r.season === world.season && r.position === 1) winners.set(r.eventId, { id: wp.player.id, name: wp.player.name, toPar: r.toPar });
    }
  }
  // Each client's finish per event, e.g. "Rhodes T5".
  const mine = new Map<string, { id: string; text: string }[]>();
  for (const id of world.clientIds) {
    const wp = world.players[id]!;
    const surname = wp.player.name.split(" ").slice(-1)[0];
    for (const r of wp.career.results.filter((x) => x.season === world.season)) {
      mine.set(r.eventId, [...(mine.get(r.eventId) ?? []), { id, text: `${surname} ${r.label}${r.via === "monday" ? " (MQ)" : ""}` }]);
    }
  }
  const inSession = new Set(game.state.reports.flatMap((r) => r.results.map((x) => x.event.id)));

  return (
    <main>
      {world.week <= seasonWeeks(world) && (
        <section className="panel">
          <div className="panel-head"><h2>This week</h2><span className="muted small">Week {world.week}</span></div>
          <div className="tc-row">
            {eventsInWeek(world, world.week).map((e) => {
              const c = world.courses.find((x) => x.id === e.courseId)!;
              return <TournamentCard key={e.id} event={e} course={c} venue={`${c.name}${c.info ? `, ${c.info.city}` : ""}`} />;
            })}
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panel-head"><h2>Season {world.season} calendar</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Week</th><th>Event</th><th>Type</th><th>Venue</th><th className="num">Purse</th><th>Winner</th><th>Your clients</th></tr></thead>
            <tbody>
              {Array.from({ length: seasonWeeks(world) }, (_, i) => i + 1).flatMap((week) =>
                eventsInWeek(world, week).map((e) => {
                  const w = winners.get(e.id);
                  const r = mine.get(e.id);
                  const course = world.courses.find((c) => c.id === e.courseId)!;
                  return (
                    <tr key={e.id} className={week === world.week ? "me" : ""}>
                      <td>{week}</td>
                      <td>
                        <span className="cal-event">
                          <TournamentEmblem event={e} course={course} size={26} />
                          {inSession.has(e.id) ? <button className="linkish" onClick={() => go("tournament", e.id)}>{e.name}</button> : e.name}
                        </span>
                      </td>
                      <td><span className={`badge${e.tier === "major" ? " badge-major" : ""}`}>{e.devFinals ? `Dev Finals ${e.devFinals}/4` : TIER_LABELS[e.tier]}</span></td>
                      <td className="secondary">{course.name}</td>
                      <td className="num">{millions(e.purse)}</td>
                      <td>{w ? <><PlayerName id={w.id}>{w.name}</PlayerName> ({toPar(w.toPar)})</> : week < world.week ? "–" : ""}</td>
                      <td className="small">{r ? r.map((x, i) => <Fragment key={x.id}>{i ? ", " : ""}<PlayerName id={x.id}>{x.text}</PlayerName></Fragment>) : ""}</td>
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
