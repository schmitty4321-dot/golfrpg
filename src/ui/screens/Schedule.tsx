import { Fragment, useState } from "react";
import { eventsInWeek, finaleWeek, isRyderCupSeason, lastRegularWeek, ryderCupWeek, seasonWeeks, yearOf, type TourEvent, type World } from "../../season";
import { TIER_LABELS, millions, toPar } from "../format";
import type { Go } from "../nav";
import type { Game } from "../useGame";
import { TournamentEmblem } from "../components/TournamentLogo";
import { PlayerName } from "../components/PlayerLink";

type Filter = "all" | "main" | "big" | "dev";
const FILTERS: [Filter, string][] = [["all", "Everything"], ["main", "Main tour"], ["big", "Majors & signature"], ["dev", "Developmental tour"]];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The Thursday a week's events start (the real tour's season opens the second full week of January). */
function weekStart(season: number, week: number): Date {
  const year = yearOf(season);
  const d = new Date(Date.UTC(year, 0, 12));
  while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7);
  return d;
}
const dayRange = (d: Date) => {
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 3);
  const m = (x: Date) => MONTHS[x.getUTCMonth()]!.slice(0, 3);
  return d.getUTCMonth() === end.getUTCMonth() ? `${m(d)} ${d.getUTCDate()}–${end.getUTCDate()}` : `${m(d)} ${d.getUTCDate()} – ${m(end)} ${end.getUTCDate()}`;
};

const shows = (e: TourEvent, f: Filter) =>
  f === "all" || (f === "main" && e.tier !== "dev") || (f === "big" && (e.tier === "major" || e.tier === "signature" || e.tier === "playoff" || e.tier === "finale")) || (f === "dev" && e.tier === "dev");

/**
 * The season at a glance: every week, grouped by month, with each week's
 * events, winners so far, your clients' results, and the season's
 * milestones (majors, the card cut-off, the playoffs, the Ryder Cup, the
 * developmental tour's Finals).
 */
export function Schedule({ world, game, go }: { world: World; game: Game; go: Go }) {
  const [filter, setFilter] = useState<Filter>("all");
  const weeks = seasonWeeks(world);
  const cardWeek = lastRegularWeek(world);
  const finale = finaleWeek(world);
  const ryder = isRyderCupSeason(world.season) ? ryderCupWeek(world) : null;
  const all = world.schedule;
  const winners = new Map<string, { id: string; name: string; toPar: number; mine: boolean }>();
  const mine = new Map<string, { id: string; text: string }[]>();
  for (const wp of Object.values(world.players)) {
    for (const r of wp.career.results) {
      if (r.season !== world.season) continue;
      if (r.position === 1) winners.set(r.eventId, { id: wp.player.id, name: wp.player.name, toPar: r.toPar, mine: !!wp.client });
      if (wp.client) mine.set(r.eventId, [...(mine.get(r.eventId) ?? []), { id: wp.player.id, text: `${wp.player.name.split(" ").slice(-1)[0]} ${r.label}` }]);
    }
  }
  const inSession = new Set(game.state.reports.flatMap((r) => r.results.map((x) => x.event.id)));
  const majors = all.filter((e) => e.tier === "major").length;
  const purse = all.filter((e) => e.tier !== "dev").reduce((s, e) => s + e.purse, 0);
  const firstPlayoff = all.filter((e) => e.tier === "playoff").sort((a, b) => a.week - b.week)[0];
  const firstFinals = all.find((e) => e.devFinals === 1);
  const milestone = (week: number): string[] => {
    const out: string[] = [];
    if (week === cardWeek) out.push("Card cut-off: the points list after this week decides cards");
    if (firstPlayoff && week === firstPlayoff.week) out.push("The playoffs begin");
    if (finale !== null && week === finale) out.push("Season finale");
    if (ryder !== null && week === ryder) out.push("Ryder Cup week");
    if (firstFinals && week === firstFinals.week) out.push("Developmental tour Finals begin");
    return out;
  };

  // Weeks grouped by the month they start in.
  const months: { name: string; weeks: number[] }[] = [];
  for (let w = 1; w <= weeks; w++) {
    const name = MONTHS[weekStart(world.season, w).getUTCMonth()]!;
    const last = months[months.length - 1];
    if (last?.name === name) last.weeks.push(w);
    else months.push({ name, weeks: [w] });
  }

  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{yearOf(world.season)} season schedule</h2>
            <span className="secondary small">
              {weeks} weeks · {majors} majors · {millions(purse)} in main-tour purses · {world.week > weeks ? "season complete" : `week ${world.week}, ${weeks - world.week + 1} to go`}
            </span>
          </div>
          <div className="tabs schedule-filter" role="radiogroup" aria-label="Show">
            {FILTERS.map(([id, label]) => (
              <button key={id} role="radio" aria-checked={filter === id} aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="schedule-progress" aria-hidden>
          <span style={{ width: `${Math.min(100, ((world.week - 1) / weeks) * 100)}%` }} />
        </div>
      </section>

      {months.map((m) => {
        const rows = m.weeks.map((w) => ({ w, events: eventsInWeek(world, w).filter((e) => shows(e, filter)), notes: milestone(w) })).filter((r) => r.events.length);
        if (!rows.length) return null;
        return (
          <section className="panel" key={m.name}>
            <div className="panel-head"><h2>{m.name}</h2></div>
            <div className="schedule-weeks">
              {rows.map(({ w, events, notes }) => (
                <article key={w} className={`schedule-week${w === world.week ? " now" : w < world.week ? " past" : ""}`}>
                  <div className="schedule-when">
                    <strong>Week {w}</strong>
                    <span className="muted small">{dayRange(weekStart(world.season, w))}</span>
                    {w === world.week && <span className="badge">This week</span>}
                  </div>
                  <div className="schedule-events">
                    {notes.map((n) => <span key={n} className="schedule-note">{n}</span>)}
                    {events.map((e) => {
                      const course = world.courses.find((c) => c.id === e.courseId);
                      const win = winners.get(e.id);
                      const r = mine.get(e.id);
                      return (
                        <div key={e.id} className={`schedule-event tier-${e.tier}`}>
                          <TournamentEmblem event={e} course={course} size={34} />
                          <div className="schedule-event-main">
                            <div>
                              {inSession.has(e.id) ? <button className="linkish" onClick={() => go("tournament", e.id)}><strong>{e.name}</strong></button> : <strong>{e.name}</strong>}
                              {" "}
                              <span className={`badge${e.tier === "major" ? " badge-major" : ""}`}>{e.devFinals ? `Dev Finals ${e.devFinals}/4` : TIER_LABELS[e.tier]}</span>
                            </div>
                            <span className="secondary small">
                              {course ? `${course.name}${course.info ? `, ${course.info.city}` : ""} · ` : ""}{millions(e.purse)} · {e.fieldSize} players{e.cutTop ? "" : ", no cut"}
                            </span>
                            {(win || r) && (
                              <span className="small">
                                {win && <>Winner: <strong className={win.mine ? "good-text" : ""}><PlayerName id={win.id}>{win.name}</PlayerName></strong> ({toPar(win.toPar)})</>}
                                {r && <span className="schedule-mine">{r.map((x, i) => <Fragment key={x.id}>{i ? " · " : ""}<PlayerName id={x.id}>{x.text}</PlayerName></Fragment>)}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
