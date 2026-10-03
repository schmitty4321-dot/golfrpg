import { CourseCard, CourseFacts } from "../components/CourseHeader";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { autoFinishRound, clientActive, fieldRoundStats, finishLive, inRound, liveBoard, liveSnapshot, standingsAfterRound, startLiveRound, type Course, type PlayerEventResult, type RoundPlan, type RoundStanding, type TournamentResult } from "../../engine";
import { courseFit, familiarityTags, familiarityWith, rankMap, theEvent, type LiveEvent, type TourEvent, type WeekReport, type World, knownArchetypes } from "../../season";
import { HoleByHole } from "../components/HoleByHole";
import type { Game, LiveWeek } from "../useGame";
import { Scorecard } from "../components/Scorecard";
import { ShotTracer } from "../components/ShotTracer";
import { RoundLeaders, RoundStatsPanel } from "../components/RoundStatsPanel";
import { Leaderboard } from "../components/Leaderboard";
import { TIER_LABELS, formWord, millions, signed, toPar } from "../format";
import { TournamentEmblem } from "../components/TournamentLogo";
import { PLAN_LABELS, setRoundPlan, tickerLine } from "../components/WeekTempo";
import { MomentsView } from "../components/MomentsView";

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
  if (lw.mode === "moments") return <MomentsView world={world} game={game} lw={lw} />;
  return <FollowView world={world} game={game} lw={lw} />;
}

/** The client nearest the lead (the one worth following), among those still playing. */
function closestToLead(t: LiveEvent["tournament"], ids: string[]): string {
  const active = ids.filter((id) => clientActive(t, id));
  if (!active.length || t.round === 0) return active[0] ?? ids[0]!;
  const board = liveBoard(t, active[0]);
  return [...active].sort((x, y) => board.findIndex((r) => r.player.id === x) - board.findIndex((r) => r.player.id === y))[0]!;
}

function FollowView({ world, game, lw }: { world: World; game: Game; lw: LiveWeek }) {
  const [which, setWhich] = useState(0);
  const [holeByHole, setHoleByHole] = useState<Record<string, boolean>>({});
  const [who, setWho] = useState<Record<string, string>>({});
  const [ticker, setTicker] = useState<string[]>([]);
  const ev = lw.events[which]!;
  const t = ev.tournament;
  const snap = useMemo(() => liveSnapshot(t), [t, lw.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const view: EventView = { event: ev.event, result: snap, clientIds: ev.clientIds };
  const rows = (id: string) => snap.leaderboard.find((r) => r.player.id === id)!;
  const done = (e: LiveEvent) => e.tournament.round >= 4 && !inRound(e.tournament);
  const allDone = lw.events.every(done);
  const stillIn = t.round < 2 || ev.clientIds.some((id) => clientActive(t, id));
  const followed = who[ev.event.id] ?? closestToLead(t, ev.clientIds);
  const walker = world.players[followed]!.player.name;
  const inHbh = !!holeByHole[ev.event.id];
  const next = t.round + 1;
  const status = t.round === 0 ? "Before round 1" : t.live[followed] ? `Round ${t.round}, hole ${t.live[followed]!.holes.length + 1}` : done(ev) ? "Final round done" : `After round ${t.round}`;
  const canFollow = (id: string) => t.round < 2 || clientActive(t, id);
  const startHbh = () => {
    game.liveAct(() => startLiveRound(t));
    setTicker([]);
    setHoleByHole((h) => ({ ...h, [ev.event.id]: true }));
  };
  const picker = ev.clientIds.length > 1 && !inHbh && (
    <div className="tabs follow-pick" role="radiogroup" aria-label="Who to follow">
      <span className="secondary small">Follow</span>
      {ev.clientIds.filter(canFollow).map((id) => (
        <button key={id} role="radio" aria-checked={followed === id} aria-selected={followed === id} onClick={() => setWho((w) => ({ ...w, [ev.event.id]: id }))}>
          {world.players[id]!.player.name}
        </button>
      ))}
    </div>
  );

  return (
    <main>
      <EventTabs names={lw.events.map((e) => e.event.name)} which={which} setWhich={setWhich} />
      <EventHeader event={ev.event} course={t.config.course} week={world.week} players={t.config.field.length} hasCut={t.config.cutTop !== undefined} status={status} compact={inHbh}>
        {!inHbh && t.round > 0 && !done(ev) && stillIn && (
          <>
            <button className="btn btn-primary" onClick={() => game.liveAct(() => { startLiveRound(t); autoFinishRound(t); })}>Play round {next}</button>
            {canFollow(followed) && (
              <button className="btn btn-primary" onClick={startHbh}>
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
      {picker}
      {inHbh && ticker.length > 0 && (
        <p className="ticker secondary small" aria-live="polite">{ticker.slice(-4).join(" · ")}</p>
      )}

      {inHbh ? (
        <HoleByHole
          key={`${ev.event.id}-${t.round}-${followed}`}
          t={t}
          who={followed}
          name={walker}
          onChange={() => game.liveAct(() => {})}
          onRoundDone={() => setHoleByHole((h) => ({ ...h, [ev.event.id]: false }))}
          onTicker={(items) => setTicker((x) => [...x, ...items.map((i) => tickerLine(world, i)).filter((l): l is string => !!l)].slice(-12))}
        />
      ) : t.round === 0 ? (
        <PreRoundHub
          world={world}
          event={ev.event}
          tournament={t}
          clientId={followed}
          mondayQualifier={ev.field.mondayQualifiers.includes(followed)}
          onPlay={startHbh}
          onSim={() => game.liveAct(() => { startLiveRound(t); autoFinishRound(t); })}
          onPlan={(plan) => setRoundPlan(game, t, followed, plan)}
        />
      ) : (
        <RoundView live={view} round={t.round} rows={rows} />
      )}
    </main>
  );
}

type PreRoundTab = "command" | "scouting" | "matchup" | "tournament" | "preparation";

function PreRoundHub({ world, event, tournament: t, clientId, mondayQualifier, onPlay, onSim, onPlan }: {
  world: World;
  event: TourEvent;
  tournament: LiveEvent["tournament"];
  clientId: string;
  mondayQualifier: boolean;
  onPlay: () => void;
  onSim: () => void;
  onPlan: (plan: RoundPlan) => void;
}) {
  const [tab, setTab] = useState<PreRoundTab>("command");
  const strategy = t.plans[clientId] ?? "steady";
  const planCards = (Object.keys(PLAN_LABELS) as RoundPlan[]).map((k) => <InfoCard key={k} title={PLAN_LABELS[k].label} selected={strategy === k} onClick={() => onPlan(k)} text={PLAN_LABELS[k].blurb} />);
  const wp = world.players[clientId]!;
  const p = wp.player;
  const course = t.config.course;
  const fit = courseFit(wp, course);
  const familiarity = Math.round(familiarityWith(wp, course.id));
  const worldRank = rankMap(world).get(clientId) ?? 400;
  const hard = [...course.holes].sort((a, b) => ((b.tourAverage ?? b.par) - b.par) - ((a.tourAverage ?? a.par) - a.par)).slice(0, 3);
  const hardestStretch = course.holes.slice(0, -2).reduce((best, _hole, index) => {
    const difficulty = course.holes.slice(index, index + 3).reduce((sum, hole) => sum + (hole.tourAverage ?? hole.par) - hole.par, 0);
    return difficulty > best.difficulty ? { start: index + 1, difficulty } : best;
  }, { start: 1, difficulty: Number.NEGATIVE_INFINITY });
  const chances = [...course.holes].filter((hole) => hole.par === 5 || (hole.tourAverage ?? hole.par) < hole.par).sort((a, b) => ((a.tourAverage ?? a.par) - a.par) - ((b.tourAverage ?? b.par) - b.par)).slice(0, 3);
  const weather = t.weather[0];
  const wind = weather ? Math.round((weather.windMph.AM + weather.windMph.PM) / 2) : Math.round(course.windiness * 20);
  const archetype = p.archetype ? p.archetype.split("-").map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ") : "Tour professional";
  const startButtons = <div className="btn-row preround-actions"><button className="btn btn-primary" onClick={onPlay}>Play round 1 hole by hole</button><button className="btn" onClick={onSim}>Sim round 1</button></div>;
  const labels: [PreRoundTab, string][] = [["command", "Command Center"], ["scouting", "Scouting"], ["matchup", "Matchup"], ["tournament", "Tournament"], ["preparation", "Preparation"]];

  return (
    <div className="preround-hub">
      <div className="tabs preround-tabs" role="tablist" aria-label="Pre-round views">
        {labels.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === "command" && <div className="preround-grid">
        <section className="panel preround-main"><div className="panel-head"><h2>Pre-round command center</h2><span className="secondary small">Decision summary</span></div>
          <div className="preround-player"><div><strong>{p.name}</strong><span>{archetype} · form {formWord(p.form).toLowerCase()} · familiarity {familiarity}</span></div><b>{Math.round(p.condition)}% condition</b></div>
          <div className="preround-metrics"><Metric label="World rank" value={`#${worldRank}`} /><Metric label="Course fit" value={signed(fit, 2)} /><Metric label="Wind" value={`${wind} mph`} /><Metric label="Field" value={`${t.config.field.length}`} /></div>
          <div className="preround-choices">{planCards}</div>{startButtons}
        </section>
        <aside className="panel"><div className="panel-head"><h2>What matters today</h2></div><Fact label="Driving accuracy" value={`${p.attributes.drivingAccuracy}/20`} /><Fact label={`${course.grass} greens`} value={p.grassPreference === course.grass ? "Familiar" : "Adjustment"} /><Fact label="Key stretch" value={`Holes ${hardestStretch.start}–${hardestStretch.start + 2}`} />{mondayQualifier && <p className="preround-note">In the field through Monday qualifying.</p>}</aside>
      </div>}

      {tab === "scouting" && <div className="preround-grid"><section className="panel preround-main"><div className="panel-head"><h2>Course scouting report</h2><span className="secondary small">{course.name}</span></div><div className="preround-scout"><div className="preround-par"><b>{course.holes.reduce((sum, h) => sum + h.par, 0)}</b><span>Par · {course.holes.reduce((sum, h) => sum + h.yards, 0).toLocaleString("en-US")} yards</span></div><div><h2>Accuracy, wind and {course.grass}</h2><p className="secondary">A quick read of the course before choosing how aggressively to play.</p><Fact label="Fairway demand" value={course.holes.filter((h) => h.par > 3).reduce((sum, h) => sum + h.fairwayWidth, 0) / course.holes.filter((h) => h.par > 3).length < 31 ? "Narrow" : "Average"} /><Fact label="Wind exposure" value={`${wind} mph`} /><Fact label="Green speed" value={`${course.greenSpeed.toFixed(1)} ft`} /></div></div>{startButtons}</section><aside className="panel"><div className="panel-head"><h2>Decisive holes</h2></div>{hard.map((h) => <Fact key={h.number} label={`Hole ${h.number} · ${h.yards} yd par ${h.par}`} value="Caution" />)}{chances.map((h) => <Fact key={`c${h.number}`} label={`Hole ${h.number} · ${h.yards} yd par ${h.par}`} value="Opportunity" />)}</aside></div>}

      {tab === "matchup" && <div className="preround-grid"><section className="panel preround-main"><div className="panel-head"><h2>Player versus course</h2><span className="secondary small">Where the matchup is won</span></div><div className="preround-versus"><div><span className="stat-label">{p.name}</span><h2>{archetype}</h2><Fact label="Driving accuracy" value={`${p.attributes.drivingAccuracy}`} /><Fact label="Mid irons" value={`${p.attributes.midIrons}`} /><Fact label="Green reading" value={`${p.attributes.greenReading}`} /></div><b>VS</b><div><span className="stat-label">{course.name} asks for</span><h2>Control</h2><Fact label="Tee accuracy" value="High" /><Fact label="Wind control" value={course.windiness > 0.5 ? "High" : "Medium"} /><Fact label={`${course.grass} reading`} value="Important" /></div></div><div className="preround-metrics"><Metric label="Overall fit" value={signed(fit, 2)} /><Metric label="Best edge" value={p.attributes.drivingAccuracy >= p.attributes.drivingDistance ? "Accuracy" : "Distance"} /><Metric label="Familiarity" value={`${familiarity}`} /><Metric label="Condition" value={`${Math.round(p.condition)}%`} /></div>{startButtons}</section><aside className="panel"><div className="panel-head"><h2>Manager recommendation</h2></div><div className="preround-grade">{fit > .05 ? "Good fit" : fit < -.05 ? "Tough fit" : "Neutral fit"}</div><p className="secondary">Lean on {p.attributes.drivingAccuracy >= p.attributes.drivingDistance ? "accuracy and disciplined targets" : "distance while leaving safe misses"}.</p></aside></div>}

      {tab === "tournament" && <div className="preround-grid"><section className="panel preround-main"><div className="panel-head"><h2>Tournament dashboard</h2><span className="secondary small">Round 1</span></div><div className="preround-metrics"><Metric label="Field size" value={`${t.config.field.length}`} /><Metric label="Cut after" value={t.config.cutTop ? `${t.config.cutTop} & ties` : "No cut"} /><Metric label="Purse" value={millions(event.purse)} /><Metric label="Your player" value={`#${worldRank}`} /></div><h3 className="preround-section-title">Players to watch</h3><div className="preround-watch">{t.config.field.slice(0, 3).map((player) => <div key={player.id}><strong>{player.name}</strong><span>{player.id === clientId ? "Your client" : `World-class field`}</span></div>)}</div>{startButtons}</section><aside className="panel"><div className="panel-head"><h2>Conditions</h2></div><Fact label="Wind" value={`${wind} mph`} /><Fact label="Greens" value={course.firmness > .55 ? "Firm" : "Receptive"} /><Fact label="Weather" value={weather?.rain ? "Rain" : "Dry"} /><Fact label="Course fit" value={signed(fit, 2)} /></aside></div>}

      {tab === "preparation" && <div className="preround-grid"><section className="panel preround-main"><div className="panel-head"><h2>Round preparation checklist</h2><span className="secondary small">Ready to play</span></div><Check title="Round plan" text={`${PLAN_LABELS[strategy].label}: the calls you don't make are played this way.`} /><Check title="Danger holes reviewed" text={`Pay attention on holes ${hard.map((h) => h.number).join(", ")}.`} /><Check title="Player status checked" text={`${Math.round(p.condition)}% condition · form ${formWord(p.form).toLowerCase()}.`} /><Check title="Round control" text="Choose every key call hole by hole, or simulate the full round." />{startButtons}</section><aside className="panel"><div className="panel-head"><h2>Round plan</h2></div>{planCards}</aside></div>}

      <CourseCard course={course} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="preround-fact"><span>{label}</span><strong>{value}</strong></div>; }
function InfoCard({ title, text, selected = false, onClick }: { title: string; text: string; selected?: boolean; onClick?: () => void }) {
  return <button type="button" className={`preround-choice${selected ? " selected" : ""}`} aria-pressed={onClick ? selected : undefined} onClick={onClick}><strong>{title}</strong><span>{text}</span></button>;
}
function Check({ title, text }: { title: string; text: string }) { return <div className="preround-check"><b aria-hidden>✓</b><div><strong>{title}</strong><span>{text}</span></div></div>; }

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
