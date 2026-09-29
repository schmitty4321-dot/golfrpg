import { CourseCard, CourseFacts, CoursePhoto } from "../components/CourseHeader";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { autoFinishRound, clientActive, fieldRoundStats, finishLive, liveSnapshot, standingsAfterRound, startLiveRound, type Course, type PlayerEventResult, type RoundStanding, type TournamentResult } from "../../engine";
import { familiarityTags, theEvent, type LiveEvent, type TourEvent, type WeekReport, type World, knownArchetypes } from "../../season";
import { HoleByHole } from "../components/HoleByHole";
import type { Game, LiveWeek } from "../useGame";
import { Scorecard } from "../components/Scorecard";
import { ShotTracer } from "../components/ShotTracer";
import { RoundLeaders, RoundStatsPanel } from "../components/RoundStatsPanel";
import { Leaderboard } from "../components/Leaderboard";
import { TIER_LABELS, millions, toPar } from "../format";
import { TournamentEmblem } from "../components/TournamentLogo";

interface EventView {
  event: TourEvent;
  result: TournamentResult;
  clientIds: string[];
}

/** The events your clients played this week (from the finished week's report). */
function reportEvents(report: WeekReport): EventView[] {
  const byEvent = new Map<string, EventView>();
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
 * Your clients' events this week. While the week is live, each round is
 * played on demand (simulated, or hole by hole with your calls); once every
 * event is done the week is recorded and the final results show.
 */
export function EventScreen({ world, game, onDone }: { world: World; game: Game; onDone: () => void }) {
  const lw = game.state.liveWeek;
  if (lw) return <LiveWeekView world={world} game={game} lw={lw} />;
  return <FinalView world={world} report={game.state.live!} onDone={onDone} />;
}

function EventTabs({ names, which, setWhich }: { names: string[]; which: number; setWhich: (i: number) => void }) {
  if (names.length < 2) return null;
  return (
    <div className="tabs" role="tablist" aria-label="Your clients' events">
      {names.map((n, i) => (
        <button key={n} role="tab" aria-selected={i === which} onClick={() => setWhich(i)}>{n}</button>
      ))}
    </div>
  );
}

function EventHeader({ event, course, week, players, hasCut, status, compact, children }: { event: TourEvent; course: Course; week: number; players: number; hasCut: boolean; status: string; compact?: boolean; children: ReactNode }) {
  return (
    <section className={`panel${compact ? " event-head-compact" : ""}`}>
      <CoursePhoto course={course} />
      <div className="panel-head">
        <div>
          <div className="event-title">
            <TournamentEmblem event={event} course={course} size={compact ? 40 : 56} />
            <span className={`badge${event.tier === "major" ? " badge-major" : ""}`}>{TIER_LABELS[event.tier]}</span>
            <h1 style={{ fontSize: 22 }}>{event.name}</h1>
          </div>
          <div className="facts" style={{ marginTop: 6 }}>
            <span>Week {week}</span>
            <CourseFacts course={course} />
            <span>Purse {millions(event.purse)}</span>
            <span>{players} players{hasCut ? ", cut after 36 holes" : ", no cut"}</span>
          </div>
        </div>
        <span className="secondary">{status}</span>
      </div>
      <div className="btn-row">{children}</div>
    </section>
  );
}

function LiveWeekView({ world, game, lw }: { world: World; game: Game; lw: LiveWeek }) {
  const [which, setWhich] = useState(0);
  const [holeByHole, setHoleByHole] = useState<Record<string, boolean>>({});
  const ev = lw.events[which]!;
  const t = ev.tournament;
  const snap = useMemo(() => liveSnapshot(t), [t, lw.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const view: EventView = { event: ev.event, result: snap, clientIds: ev.clientIds };
  const rows = (id: string) => snap.leaderboard.find((r) => r.player.id === id)!;
  const done = (e: LiveEvent) => e.tournament.round >= 4 && !e.tournament.current;
  const allDone = lw.events.every(done);
  const stillIn = t.round < 2 || ev.clientIds.some((id) => t.entries.find((e) => e.player.id === id)?.active);
  const walker = world.players[t.controlledId]!.player.name;
  const inHbh = !!holeByHole[ev.event.id];
  const next = t.round + 1;
  const status = t.round === 0 ? "Before round 1" : t.current ? `Round ${t.round}, hole ${t.current.holes.length + 1}` : done(ev) ? "Final round done" : `After round ${t.round}`;

  return (
    <main>
      <EventTabs names={lw.events.map((e) => e.event.name)} which={which} setWhich={setWhich} />
      <EventHeader event={ev.event} course={t.config.course} week={world.week} players={t.config.field.length} hasCut={t.config.cutTop !== undefined} status={status} compact={inHbh}>
        {!inHbh && !done(ev) && stillIn && (
          <>
            <button className="btn btn-primary" onClick={() => game.liveAct(() => { startLiveRound(t); autoFinishRound(t); })}>Play round {next}</button>
            {(t.round < 2 || clientActive(t)) && (
              <button className="btn btn-primary" onClick={() => { game.liveAct(() => startLiveRound(t)); setHoleByHole((h) => ({ ...h, [ev.event.id]: true })); }}>
                Play round {next} hole by hole
              </button>
            )}
          </>
        )}
        {!inHbh && !done(ev) && !stillIn && <button className="btn btn-primary" onClick={() => game.liveAct(() => void finishLive(t))}>Sim the rest of the tournament</button>}
        {!inHbh && done(ev) && allDone && <button className="btn btn-primary" onClick={() => void game.completeLiveWeek()}>See the final results</button>}
        {!inHbh && done(ev) && !allDone && <button className="btn btn-primary" onClick={() => setWhich(lw.events.findIndex((e) => !done(e)))}>Next event</button>}
        {!allDone && <button className="btn" onClick={() => void game.completeLiveWeek()}>Skip to the final results</button>}
      </EventHeader>

      {inHbh ? (
        <HoleByHole
          key={`${ev.event.id}-${t.round}`}
          t={t}
          name={walker}
          onChange={() => game.liveAct(() => {})}
          onRoundDone={() => setHoleByHole((h) => ({ ...h, [ev.event.id]: false }))}
        />
      ) : t.round === 0 ? (
        <>
          <section className="panel">
            <div className="panel-head"><h2>Your clients in the field</h2></div>
            <ul className="news">
              {ev.clientIds.map((id) => (
                <li key={id} style={{ color: "var(--text)" }}>
                  <strong>{world.players[id]!.player.name}</strong>
                  {ev.field.mondayQualifiers.includes(id) ? " · got in through the Monday qualifier" : ""}
                </li>
              ))}
            </ul>
            <p className="muted small" style={{ marginBottom: 0 }}>
              Play a round at a time, or walk with {walker} hole by hole: you make the calls on the key holes (off the tee, going for par 5s, attacking pins, the closing putts) and watch every shot.
            </p>
          </section>
          <CourseCard course={t.config.course} />
        </>
      ) : (
        <RoundView live={view} round={t.round} rows={rows} />
      )}
    </main>
  );
}

function FinalView({ world, report, onDone }: { world: World; report: WeekReport; onDone: () => void }) {
  const events = reportEvents(report);
  const [which, setWhich] = useState(0);
  const live = events[which]!;
  return (
    <main>
      <EventTabs names={events.map((e) => e.event.name)} which={which} setWhich={setWhich} />
      <EventHeader event={live.event} course={live.result.course} week={report.week} players={live.result.leaderboard.length} hasCut={live.result.cutLine !== null} status="Final">
        <button className="btn btn-primary" onClick={onDone}>Continue</button>
      </EventHeader>
      <Final world={world} report={report} live={live} />
    </main>
  );
}

function RoundView({ live, round, rows }: { live: EventView; round: number; rows: (id: string) => PlayerEventResult }) {
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

function Final({ world, report, live }: { world: World; report: WeekReport; live: EventView }) {
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
        <Leaderboard result={live.result} archetypes={knownArchetypes(world, live.result.leaderboard.map((r) => r.player.id))} clientIds={world.clientIds} limit={20} tags={familiarityTags(world, live.event.courseId, live.result.leaderboard.map((r) => r.player.id))} />
      </section>
    </>
  );
}
