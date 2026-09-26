import { CourseCard, CourseFacts, CoursePhoto } from "../components/CourseHeader";
import { Fragment, useMemo, useState } from "react";
import { fieldRoundStats, standingsAfterRound, type PlayerEventResult, type RoundStanding, type TournamentResult } from "../../engine";
import { theEvent, type TourEvent, type WeekReport, type World } from "../../season";
import { Scorecard } from "../components/Scorecard";
import { ShotTracer } from "../components/ShotTracer";
import { RoundLeaders, RoundStatsPanel } from "../components/RoundStatsPanel";
import { Leaderboard } from "../components/Leaderboard";
import { TIER_LABELS, millions, toPar } from "../format";

interface LiveEvent {
  event: TourEvent;
  result: TournamentResult;
  clientIds: string[];
}

/** The events your clients played this week. */
function liveEvents(report: WeekReport): LiveEvent[] {
  const byEvent = new Map<string, LiveEvent>();
  for (const [id, c] of Object.entries(report.clients)) {
    if (!c.record || !c.result) continue;
    const e = report.results.find((r) => r.event.id === c.record!.eventId)!;
    const entry = byEvent.get(e.event.id) ?? { event: e.event, result: c.result, clientIds: [] };
    entry.clientIds.push(id);
    byEvent.set(e.event.id, entry);
  }
  return [...byEvent.values()];
}

/**
 * A week your clients played, revealed a round at a time: play round 1,
 * see where they stand, and so on. If every client misses the cut, sim
 * the rest in one go.
 */
export function EventScreen({ world, report, onDone }: { world: World; report: WeekReport; onDone: () => void }) {
  const events = liveEvents(report);
  const [which, setWhich] = useState(0);
  const [stage, setStage] = useState<Record<string, number>>({});
  const live = events[which]!;
  const rounds = Math.max(...live.result.leaderboard.map((r) => r.rounds.length));
  const shown = stage[live.event.id] ?? 0;
  const setShown = (n: number) => setStage((s) => ({ ...s, [live.event.id]: n }));
  const hasCut = live.result.cutLine !== null;
  const rows = (id: string) => live.result.leaderboard.find((r) => r.player.id === id)!;
  const anyMadeCut = live.clientIds.some((id) => rows(id).madeCut);
  const finished = shown >= rounds;
  const allDone = events.every((e) => (stage[e.event.id] ?? 0) >= Math.max(...e.result.leaderboard.map((r) => r.rounds.length)));

  const next = () => {
    if (shown === 2 && hasCut && !anyMadeCut) setShown(rounds);
    else setShown(shown + 1);
  };
  const nextLabel =
    shown === 0 ? "Play round 1" : shown === 2 && hasCut && !anyMadeCut ? "Sim the rest of the tournament" : `Play round ${shown + 1}`;

  const c = live.result.course;
  return (
    <main>
      {events.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Your clients' events">
          {events.map((e, i) => (
            <button key={e.event.id} role="tab" aria-selected={i === which} onClick={() => setWhich(i)}>
              {e.event.name}
            </button>
          ))}
        </div>
      )}
      <section className="panel">
        <CoursePhoto course={c} />
        <div className="panel-head">
          <div>
            <div className="event-title">
              <span className={`badge${live.event.tier === "major" ? " badge-major" : ""}`}>{TIER_LABELS[live.event.tier]}</span>
              <h1 style={{ fontSize: 22 }}>{live.event.name}</h1>
            </div>
            <div className="facts" style={{ marginTop: 6 }}>
              <span>Week {report.week}</span>
              <CourseFacts course={c} />
              <span>Purse {millions(live.event.purse)}</span>
              <span>{live.result.leaderboard.length} players{hasCut ? ", cut after 36 holes" : ", no cut"}</span>
            </div>
          </div>
          <span className="secondary">{shown === 0 ? "Before round 1" : finished ? "Final" : `After round ${shown}`}</span>
        </div>
        <div className="btn-row">
          {!finished && <button className="btn btn-primary" onClick={next}>{nextLabel}</button>}
          {!finished && shown > 0 && <button className="btn" onClick={() => setShown(rounds)}>Skip to the final results</button>}
          {finished && allDone && <button className="btn btn-primary" onClick={onDone}>Continue</button>}
          {finished && !allDone && (
            <button className="btn btn-primary" onClick={() => setWhich(events.findIndex((e) => (stage[e.event.id] ?? 0) < Math.max(...e.result.leaderboard.map((r) => r.rounds.length))))}>
              Next event
            </button>
          )}
          {shown === 0 && <button className="btn" onClick={() => setShown(rounds)}>Skip to the final results</button>}
        </div>
      </section>

      {shown === 0 ? (
        <section className="panel">
          <div className="panel-head"><h2>Your clients in the field</h2></div>
          <ul className="news">
            {live.clientIds.map((id) => {
              const r = rows(id);
              return (
                <li key={id} style={{ color: "var(--text)" }}>
                  <strong>{r.player.name}</strong> · round 1 tee time {r.waves[0] === "AM" ? "morning" : "afternoon"}
                  {report.clients[id]!.record!.via === "monday" ? " · got in through the Monday qualifier" : ""}
                </li>
              );
            })}
          </ul>
          <p className="muted small" style={{ marginBottom: 0 }}>Round 1 weather: wind {Math.round(live.result.weather[0]!.windMph.AM)} mph in the morning, {Math.round(live.result.weather[0]!.windMph.PM)} mph in the afternoon{live.result.weather[0]!.rain ? ", with rain" : ""}.</p>
        </section>
      ) : null}
      {shown === 0 ? (
        <CourseCard course={c} />
      ) : finished ? (
        <Final world={world} report={report} live={live} />
      ) : (
        <RoundView live={live} round={shown} rows={rows} />
      )}
    </main>
  );
}

function RoundView({ live, round, rows }: { live: LiveEvent; round: number; rows: (id: string) => PlayerEventResult }) {
  const standings = standingsAfterRound(live.result, round);
  const field = useMemo(() => fieldRoundStats(live.result, round - 1), [live.result, round]);
  const [watch, setWatch] = useState<{ id: string; hole: number } | null>(null);
  const w = live.result.weather[round - 1]!;
  const cutLine = round === 2 && live.result.cutLine !== null ? live.result.cutLine : null;
  return (
    <>
      <div className="grid-2">
        <div className="stack">
          {live.clientIds.map((id) => {
            const r = rows(id);
            const s = standings.find((x) => x.player.id === id)!;
            const played = r.rounds.length >= round;
            return (
              <section className="panel" key={id}>
                <div className="panel-head">
                  <h2>{r.player.name}</h2>
                  <span className="secondary">
                    {played ? (
                      <>
                        Today <strong>{r.rounds[round - 1]}</strong> ({toPar(r.rounds[round - 1]! - live.result.par)}) · {toPar(s.toPar)} · <strong>{s.positionLabel}</strong>
                        {s.movement ? <span className={s.movement > 0 ? "good-text" : "bad-text"}> {s.movement > 0 ? `▲${s.movement}` : `▼${-s.movement}`}</span> : null}
                      </>
                    ) : (
                      "Missed the cut"
                    )}
                  </span>
                </div>
                {played ? (
                  <>
                    <Scorecard course={live.result.course} rounds={[r.holes[round - 1]!]} firstRound={round} onPick={(_, hole) => setWatch({ id, hole })} />
                    <RoundStatsPanel result={live.result} row={r} round={round} field={field} />
                  </>
                ) : (
                  <p className="empty">He's done for the week after {toPar(r.toPar)} over two rounds.</p>
                )}
                {round === 2 && cutLine !== null && played && (
                  <p className={r.madeCut ? "good-text" : "bad-text"} style={{ marginBottom: 0 }}>
                    <strong>{r.madeCut ? "Made the cut." : "Missed the cut."}</strong> The cut fell at {toPar(cutLine)}.
                  </p>
                )}
              </section>
            );
          })}
        </div>
        <section className="panel">
          <div className="panel-head">
            <h2>Round {round}</h2>
            <span className="muted small">Wind {Math.round(w.windMph.AM)} mph AM, {Math.round(w.windMph.PM)} mph PM{w.rain ? ", rain" : ""}</span>
          </div>
          <RoundBoard standings={standings} clientIds={live.clientIds} round={round} cutLine={cutLine} />
          <h2 style={{ marginTop: 18 }}>Round {round} leaders</h2>
          <RoundLeaders result={live.result} field={field} clientIds={live.clientIds} />
        </section>
      </div>
      {watch && <ShotTracer result={live.result} row={rows(watch.id)} round={round - 1} hole={watch.hole} onClose={() => setWatch(null)} />}
    </>
  );
}

function RoundBoard({ standings, clientIds, round, cutLine }: { standings: RoundStanding[]; clientIds: string[]; round: number; cutLine: number | null }) {
  const [all, setAll] = useState(false);
  const shown = all ? standings : standings.filter((s, i) => i < 15 || clientIds.includes(s.player.id));
  const firstOut = cutLine === null ? -1 : standings.findIndex((s) => s.toPar > cutLine);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Pos</th><th /><th>Player</th><th className="num">To par</th><th className="num">R{round}</th><th className="num">Total</th></tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <Fragment key={s.player.id}>
              {standings.indexOf(s) === firstOut && <tr className="divider"><td colSpan={6}>Cut line ({toPar(cutLine!)})</td></tr>}
              <tr className={clientIds.includes(s.player.id) ? "me" : ""}>
                <td>{s.positionLabel}</td>
                <td className="small">{s.movement ? <span className={s.movement > 0 ? "good-text" : "bad-text"}>{s.movement > 0 ? `▲${s.movement}` : `▼${-s.movement}`}</span> : ""}</td>
                <td>{s.player.name}</td>
                <td className={`num ${s.toPar < 0 ? "good-text" : s.toPar > 0 ? "bad-text" : ""}`}>{toPar(s.toPar)}</td>
                <td className="num">{s.today ?? "–"}</td>
                <td className="num">{s.total}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <button className="linkish" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${standings.length}`}</button>
    </div>
  );
}

function Final({ world, report, live }: { world: World; report: WeekReport; live: LiveEvent }) {
  const winner = live.result.leaderboard[0]!;
  return (
    <>
      <section className="panel">
        <div className="panel-head"><h2>Final result</h2></div>
        <p style={{ marginTop: 0 }}>
          <strong>{winner.player.name}</strong> wins {theEvent(live.event.name)} at {toPar(winner.toPar)}
          {live.result.playoff ? ` after a ${live.result.playoff.holesPlayed}-hole playoff` : ""}.
        </p>
        <ul className="news">
          {live.clientIds.map((id) => (
            <li key={id} style={{ color: "var(--text)" }}>{report.clients[id]!.summary}</li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <Leaderboard result={live.result} clientIds={world.clientIds} limit={20} />
      </section>
    </>
  );
}
