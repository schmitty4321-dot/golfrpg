import { useEffect, useRef, useState } from "react";
import { NegotiationTable } from "./Negotiation";
import { ProfileCoaches, ProfileEquipment } from "./ProfileGear";
import { PromisePicker } from "./Promises";
import { ATTRIBUTE_LABELS, createRng, describeTendencies, feetInches, liveBoard, nationInfo, tendencies, type AttributeKey } from "../../engine";
import {
  STATUS_LABELS,
  abilityView,
  ARCHETYPE_KEY,
  type PromiseKind,
  TRAIT_SKILLS,
  masteryTier,
  acceptChance,
  competingBid,
  knownTraits,
  approachBlock,
  GOLF_SKILLS,
  attributePotential,
  ceilingStars,
  potentialEstimate,
  knowsHidden,
  mixSeed,
  pointsList,
  queueScouting,
  rankMap,
  scoutedAttribute,
  type LiveEvent, type World, type WorldPlayer, knownArchetype, followers, onShortlist, toggleShortlist } from "../../season";
import { Stars } from "./Stars";
import { TendenciesPanel } from "./TendenciesPanel";
import { PortraitCard } from "./Portrait";
import { StatBoxes, StatLegend } from "./StatBoxes";
import { SkillRadar } from "./SkillRadar";
import { CareerEvolution, RollingSgChart, SgPercentiles } from "./StatCharts";
import { DevelopmentTab } from "./DevelopmentTab";
import { TraitChip, TraitList } from "./Traits";
import { FamiliarityPanel } from "./Familiarity";
import { money, plural, signed, TIER_LABELS, toPar } from "../format";
import type { Game } from "../useGame";
import { ArchetypePill } from "./Archetype";

export function chanceWords(p: number): string {
  if (p < 0.1) return "Very unlikely";
  if (p < 0.35) return "Unlikely";
  if (p < 0.65) return "Could go either way";
  if (p < 0.9) return "Likely";
  return "Very likely";
}

/** Everything your agency knows about a player, and the offer form. */
export function PlayerProfile({ world, game, id, onClose }: { world: World; game: Game; id: string; onClose: () => void }) {
  const wp = world.players[id];
  // The negotiation table opens when you make an offer or look at the talks.
  const [talking, setTalking] = useState(false);
  const [commission, setCommission] = useState(10);
  const [years, setYears] = useState(2);
  const [promises, setPromises] = useState<PromiseKind[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [tab, setTab] = useState<"profile" | "stats" | "results" | "development" | "coaches" | "equipment">("profile");
  // A full screen of its own: Escape goes back, and the page underneath doesn't scroll.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
    };
  }, []);
  if (!wp) return null;
  const k = world.agency.knowledge[id];
  const known = (k?.accuracy ?? 0) > 0;
  const hidden = knowsHidden(world, id);
  const rank = rankMap(world).get(id);
  const pr = pointsList(world).indexOf(id) + 1;
  const season = wp.career.results.filter((r) => r.season === world.season);
  const liveEvent = game.state.liveWeek?.events.find((e) => e.clientIds.includes(id));
  const best = season.filter((r) => r.madeCut).sort((a, b) => a.position - b.position)[0];
  const block = approachBlock(world, id);
  const offer = { commission: commission / 100, years, promises };
  const chance = block ? 0 : acceptChance(world, id, offer);
  const bid = block ? null : competingBid(world, id);
  const queued = world.agency.scoutingQueue.includes(id);
  // A scout out on him: the weeks left until his report (see intel.ts).
  const job = (world.agency.intelJobs ?? []).find((j) => j.playerId === id);
  const pending = queued || !!job;
  // His ceiling: the coaches' estimate for a client, the scouts' once a report is good enough.
  const potential = wp.client
    ? abilityView(world, id).potential
    : hidden
      ? potentialEstimate(wp, 4 + (k!.accuracy ?? 0) * 16, createRng(mixSeed(world.seed, world.season, Number(id.replace(/\D/g, "")) || 3)))
      : null;
  const ceiling = potential === null ? null : ceilingStars(potential);
  const traits = knownTraits(world, id);
  const archetype = knownArchetype(world, id);
  const view = (key: AttributeKey) => {
    const v = scoutedAttribute(world, id, key)!;
    return { ...v, ...(potential === null ? {} : { potential: attributePotential(wp.player, key, potential, v.value) }) };
  };

  return (
    <div className="player-page" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="player-page-inner">
        <button className="btn btn-small player-back" onClick={onClose}><span aria-hidden>←</span> Back</button>
        <div className="pp-layout">
          <div className="pp-side">
          <aside className="pp-card">
            <PortraitCard player={wp.player} size={96} title={wp.player.name} />
            <div>
              <h1 id="profile-title">{wp.player.name}</h1>
              <div className="pp-meta">
                {wp.player.age} · {nationInfo(wp.player.nationality).name} · {STATUS_LABELS[wp.career.status]}
                {game.lib.schoolLabel(world, wp) && <> · {game.lib.schoolLabel(world, wp)}</>}
                <br />
                {wp.client ? "Your client" : wp.agent ? `${wp.agent.agency} (until end of season ${wp.agent.untilSeason})${wp.agent.deal ? " · development deal" : ""}` : "Free agent"}
                {!wp.client && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                    <button className="btn btn-small" onClick={() => game.act((w) => toggleShortlist(w, id))}>{onShortlist(world, id) ? "On your watch list ✓" : "Add to watch list"}</button>
                    <button className="btn btn-small" disabled={pending} onClick={() => game.act((w) => queueScouting(w, id))}>{job ? `Scout is gathering intel · ${job.weeksLeft} wk${job.weeksLeft === 1 ? "" : "s"} left` : queued ? "Waiting for a scout" : known ? "Scout again for a sharper report" : "Have a scout gather intel"}</button>
                    {world.agency.hiredScouts.length === 0 && <span className="muted small">Hire a scout to start gathering intel.</span>}
                  </div>
                )}
                {archetype && <div style={{ marginTop: 8 }}><ArchetypePill id={archetype} tier={masteryTier(wp, ARCHETYPE_KEY)} /></div>}
              </div>
            </div>
            <dl className="pp-kv">
              <div><dt>World rank</dt><dd>{rank ? `#${rank}` : "—"}</dd></div>
              <div><dt>Points list</dt><dd>{pr ? `#${pr}` : "—"}</dd></div>
              <div><dt>This season</dt><dd>{plural(season.length + (liveEvent ? 1 : 0), "start")} · {season.filter((r) => r.madeCut).length} cuts{liveEvent ? " · playing now" : best ? ` · best ${best.label}` : ""}</dd></div>
              <div><dt>Career</dt><dd>{plural(wp.career.careerWins, "win")} · {plural(wp.career.careerMajors, "major")}</dd></div>
              <div><dt>Earnings</dt><dd>{money(wp.career.careerEarnings)}</dd></div>
              {wp.client && <div><dt>Followers</dt><dd>{Math.round(followers(world, wp) / 1000)}k</dd></div>}
              {ceiling !== null && <div><dt>Ceiling</dt><dd><Stars value={ceiling} /></dd></div>}
              {hidden && <div><dt>Home greens</dt><dd>{wp.player.grassPreference}</dd></div>}
              {hidden &&
                (["windTolerance", "professionalism", "coachability", "ambition"] as AttributeKey[]).map((key) => {
                  const v = scoutedAttribute(world, id, key)!;
                  return <div key={key}><dt>{ATTRIBUTE_LABELS[key]}</dt><dd>{v.low === v.high ? v.value : `${v.low}-${v.high}`}</dd></div>;
                })}
            </dl>
            {traits.length > 0 && (
              <div>
                <div className="pp-label">Traits</div>
                <div className="pp-chips">{traits.map((t) => <TraitChip key={t} id={t} dark {...(TRAIT_SKILLS[t] ? { tier: masteryTier(wp, t) } : {})} />)}</div>
              </div>
            )}
            {hidden && (
              <div>
                <div className="pp-label">Tendencies</div>
                <div className="pp-chips">
                  {describeTendencies(tendencies(wp.player)).map((t) => <span key={t.label} className="pp-chip" title={`${t.label}: ${t.detail}`}>{t.value}</span>)}
                </div>
              </div>
            )}
            <nav className="pp-nav" aria-label={`${wp.player.name} profile sections`}>
              <button aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}>Profile</button>
              <button aria-current={tab === "stats" ? "page" : undefined} onClick={() => setTab("stats")}>Stats</button>
              <button aria-current={tab === "results" ? "page" : undefined} onClick={() => setTab("results")}>Results</button>
              <button aria-current={tab === "development" ? "page" : undefined} onClick={() => setTab("development")}>Development</button>
              {wp.client && <button aria-current={tab === "coaches" ? "page" : undefined} onClick={() => setTab("coaches")}>Coaches</button>}
              <button aria-current={tab === "equipment" ? "page" : undefined} onClick={() => setTab("equipment")}>Equipment</button>
            </nav>
          </aside>
          {known && (
            <section className="panel pp-radar">
              <div className="panel-head">
                <h2>Skill radar</h2>
                <StatLegend potential={potential !== null} />
              </div>
              <SkillRadar view={view} />
              <p className="muted small" style={{ margin: 0 }}>Group averages on the 1-20 scale. The dashed ring is a tour-average player (12).</p>
            </section>
          )}
          </div>

          <div className="pp-main">
            {tab === "profile" ? (
              <>
            <section className="panel">
              <div className="panel-head">
                <h2>Skills</h2>
                <span className="muted small">
                  {known && <StatLegend potential={potential !== null} />}{" "}
                  {wp.client ? "Known exactly" : known ? `Scouted to ${Math.round(k!.accuracy * 100)}% · ${k!.reports} report${k!.reports === 1 ? "" : "s"}` : "Not scouted"}
                </span>
              </div>
              {!known ? (
                <p className="empty">
                  Your agency has no report on him: only his results are public.{pending ? " A scout is on his way to gather intel." : ""}
                </p>
              ) : (
                <>
                  <OverallRatings current={GOLF_SKILLS.reduce((t, k) => t + view(k).value, 0) / GOLF_SKILLS.length} potential={potential} />
                  <StatBoxes view={view} />
                  {!hidden && <p className="muted small">A more accurate report (60%+) would reveal his ceiling, how far each skill can grow, his work ethic and other hidden traits.</p>}
                  {potential !== null && <p className="muted small" style={{ marginBottom: 0 }}>Potential is an estimate from his overall ceiling{wp.client ? ", judged by his coaches" : ", judged by your scouts"}.</p>}
                </>
              )}
            </section>

            {(known || wp.client) && (
              <section className="panel">
                <div className="panel-head"><h2>Traits</h2><span className="muted small">What sets him apart, on the course and off it</span></div>
                <TraitList
                  ids={traits}
                  hiddenNote={wp.client ? undefined : "Scouts spot each trait with a chance equal to their report's accuracy, so there may be more."}
                />
              </section>
            )}

            <FamiliarityPanel world={world} wp={wp} />

            {hidden && (
              <section className="panel">
                <div className="panel-head"><h2>Tendencies</h2><span className="muted small">His habits: they show up in replays and round stats</span></div>
                <TendenciesPanel player={wp.player} />
              </section>
            )}

        {!wp.client && (
          <section className="panel">
            <div className="panel-head"><h2>Offer representation</h2></div>
            {block ? (
              <p className="secondary" style={{ margin: 0 }}>{block}</p>
            ) : (
              <>
                <div className="btn-row" style={{ alignItems: "center" }}>
                  <label className="small secondary">Commission
                    <select value={commission} onChange={(e) => setCommission(Number(e.target.value))} style={{ marginLeft: 6 }}>
                      {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((c) => <option key={c} value={c}>{c}%</option>)}
                    </select>
                  </label>
                  <label className="small secondary">Length
                    <select value={years} onChange={(e) => setYears(Number(e.target.value))} style={{ marginLeft: 6 }}>
                      {[1, 2, 3].map((y) => <option key={y} value={y}>{y} season{y === 1 ? "" : "s"}</option>)}
                    </select>
                  </label>
                  <span className="small">Your read: <strong>{chanceWords(chance)}</strong></span>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      let msg = "";
                      // Your offer opens the talks at the negotiation table.
                      game.act((w) => {
                        msg = game.lib.startNegotiation(w, id, "sign") ?? "";
                        const n = game.lib.negotiationFor(w, id);
                        // A new round of talks opens with your offer, if this week's is still to make.
                        if (!msg && n && n.round === 0 && !game.lib.offerBlock(w, n)) game.lib.makeOffer(w, { commission: offer.commission, years: offer.years, promises }, id);
                      });
                      setResult(msg || null);
                      if (!msg) setTalking(true);
                    }}
                  >
                    {world.talks?.[id]?.status === "open" ? "View talks" : "Make an offer"}
                  </button>
                </div>
                <PromisePicker wp={wp} value={promises} onChange={setPromises} />
                {bid && (
                  <p className="small" style={{ marginBottom: 0 }}>
                    {wp.career.status === "amateur" ? "Interested for when he turns pro" : "Also talking to him"}: <strong>{game.lib.interestedAgencies(world, id).join(", ")}</strong>. Their terms are private.
                  </p>
                )}
                <p className="muted small">You can make one offer a week. Players usually take two to four weeks to decide; they weigh your reputation against their standing, the commission, the length, and their own ambition. Turn-downs mean a four-week wait.</p>
              </>
            )}
          </section>
        )}
        {talking && <NegotiationTable world={world} game={game} playerId={id} onClose={() => { setTalking(false); setResult(null); }} />}
        {result && (
          <p className={wp.client ? "good-text" : ""} style={{ margin: 0 }} role="status">
            <strong>{result}</strong>
          </p>
        )}
              </>
            ) : tab === "coaches" ? (
              <ProfileCoaches world={world} game={game} wp={wp} />
            ) : tab === "equipment" ? (
              <ProfileEquipment wp={wp} />
            ) : tab === "development" ? (
              <DevelopmentTab world={world} game={game} wp={wp} potential={potential} known={known} />
            ) : tab === "stats" ? (
              <PlayerStats world={world} wp={wp} season={world.season} liveEvent={liveEvent} />
            ) : (
              <PlayerResults wp={wp} season={world.season} liveEvent={liveEvent} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const per = (value: number, count: number) => (count > 0 ? value / count : null);
const pct = (value: number, count: number) => (count > 0 ? (100 * value) / count : null);

function StatValue({ label, value }: { label: string; value: string }) {
  return <div className="player-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function value(value: number | null, format: (n: number) => string): string {
  return value === null ? "—" : format(value);
}

function liveProgress(liveEvent: LiveEvent | undefined, playerId: string) {
  if (!liveEvent) return null;
  const t = liveEvent.tournament;
  const board = liveBoard(t);
  const standing = board.find((row) => row.player.id === playerId);
  const position = standing ? board.findIndex((row) => row.player.id === playerId) + 1 : null;
  const entry = t.entries.find((row) => row.player.id === playerId);
  const completedRounds = entry?.rounds.length ?? 0;
  const currentHoles = t.current && t.controlledId === playerId ? t.current.holes.length : 0;
  const round = t.round || 1;
  const status = t.done
    ? "Complete"
    : currentHoles > 0
      ? `Round ${round} · thru ${currentHoles}`
      : completedRounds > 0
        ? `After round ${completedRounds}`
        : "Before round 1";
  return { event: liveEvent.event, standing, position, completedRounds, currentHoles, status };
}

function LiveTournamentPanel({ liveEvent, playerId }: { liveEvent: LiveEvent; playerId: string }) {
  const live = liveProgress(liveEvent, playerId)!;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Playing now</h2><span className="muted small">In-progress scores update after every hole</span></div>
      <div className="player-stat-grid">
        <StatValue label="Event" value={live.event.name} />
        <StatValue label="Status" value={live.status} />
        <StatValue label="Score" value={live.standing ? toPar(live.standing.toPar) : "—"} />
        <StatValue label="Live position" value={live.position ? `#${live.position}` : "—"} />
      </div>
    </section>
  );
}

function PlayerStats({ world, wp, season, liveEvent }: { world: World; wp: WorldPlayer; season: number; liveEvent?: LiveEvent }) {
  const stats = wp.career.stats?.season === season ? wp.career.stats : undefined;
  const charts = (
    <>
      <SgPercentiles world={world} id={wp.player.id} />
      <RollingSgChart wp={wp} />
      <CareerEvolution world={world} wp={wp} />
    </>
  );
  if (!stats || stats.rounds === 0) {
    return <>
      {liveEvent && <LiveTournamentPanel liveEvent={liveEvent} playerId={wp.player.id} />}
      <section className="panel"><div className="panel-head"><h2>Season {season} stats</h2></div><p className="empty">{liveEvent ? "Finalized season stats will appear after the tournament. The live event is shown above." : "No main-tour rounds yet this season."}</p></section>
      {charts}
    </>;
  }
  const rounds = stats.rounds;
  const roundCount = stats.shots.holes / 18;
  const sgTotal = stats.sg.offTheTee + stats.sg.approach + stats.sg.aroundTheGreen + stats.sg.putting;
  const fixed = (n: number) => n.toFixed(2);
  const percent = (n: number) => `${n.toFixed(1)}%`;
  return (
    <>
      {liveEvent && <LiveTournamentPanel liveEvent={liveEvent} playerId={wp.player.id} />}
      <section className="panel">
        <div className="panel-head"><h2>Season {season} stats</h2><span className="muted small">Main-tour events</span></div>
        <div className="player-stat-grid">
          <StatValue label="Events" value={`${stats.events}`} />
          <StatValue label="Rounds" value={`${rounds}`} />
          <StatValue label="Wins" value={`${stats.wins}`} />
          <StatValue label="Top 10s" value={`${stats.top10s}`} />
          <StatValue label="Cuts made" value={value(pct(stats.cuts, stats.events), (n) => `${Math.round(n)}%`)} />
          <StatValue label="Scoring average" value={value(per(stats.strokes, rounds), fixed)} />
          <StatValue label="Season points" value={`${Math.round(stats.points)}`} />
          <StatValue label="Earnings" value={money(stats.earnings)} />
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Strokes gained</h2><span className="muted small">Per round</span></div>
        <div className="player-stat-grid">
          <StatValue label="Total" value={signed(sgTotal / rounds, 2)} />
          <StatValue label="Off the tee" value={signed(stats.sg.offTheTee / rounds, 2)} />
          <StatValue label="Approach" value={signed(stats.sg.approach / rounds, 2)} />
          <StatValue label="Around the green" value={signed(stats.sg.aroundTheGreen / rounds, 2)} />
          <StatValue label="Putting" value={signed(stats.sg.putting / rounds, 2)} />
        </div>
      </section>
      <div className="player-stat-sections">
        <section className="panel">
          <div className="panel-head"><h2>Ball striking</h2></div>
          <div className="player-stat-grid">
            <StatValue label="Driving distance" value={value(per(stats.shots.driveYards, stats.shots.drives), (n) => `${n.toFixed(1)} yds`)} />
            <StatValue label="Fairways" value={value(pct(stats.shots.fairwaysHit, stats.shots.fairwayAttempts), percent)} />
            <StatValue label="Greens in regulation" value={value(pct(stats.shots.gir, stats.shots.holes), percent)} />
            <StatValue label="Proximity" value={value(per(stats.shots.proximityFeet, stats.shots.proximityCount), feetInches)} />
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Short game & putting</h2></div>
          <div className="player-stat-grid">
            <StatValue label="Scrambling" value={value(pct(stats.shots.scrambles, stats.shots.scrambleAttempts), percent)} />
            <StatValue label="Sand saves" value={value(pct(stats.shots.sandSaves, stats.shots.sandAttempts), percent)} />
            <StatValue label="Putts / round" value={value(per(stats.shots.putts, roundCount), fixed)} />
            <StatValue label="Birdies+ / round" value={value(per(stats.shots.birdies + stats.shots.eagles, roundCount), fixed)} />
          </div>
        </section>
      </div>
      {charts}
    </>
  );
}

function PlayerResults({ wp, season, liveEvent }: { wp: WorldPlayer; season: number; liveEvent?: LiveEvent }) {
  const results = [...wp.career.results].sort((a, b) => b.season - a.season || b.week - a.week);
  const live = liveProgress(liveEvent, wp.player.id);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Tournament results</h2><span className="muted small">{plural(results.length + (live ? 1 : 0), "start")} including events in progress</span></div>
      {results.length === 0 && !live ? (
        <p className="empty">No tournament results recorded.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Season</th><th>Week</th><th>Event</th><th>Level</th><th>Finish</th><th className="num">Score</th><th className="num">Earnings</th><th className="num">Points</th><th className="num">SG / round</th></tr></thead>
            <tbody>
              {live && (
                <tr>
                  <td>{season}</td>
                  <td>{live.event.week}</td>
                  <td><strong>{live.event.name}</strong> <span className="muted small">· in progress</span></td>
                  <td>{TIER_LABELS[live.event.tier]}</td>
                  <td>{live.status}</td>
                  <td className="num">{live.standing ? toPar(live.standing.toPar) : "—"}</td>
                  <td className="num">—</td><td className="num">—</td><td className="num">—</td>
                </tr>
              )}
              {results.map((r, i) => (
                <tr key={`${r.season}-${r.week}-${r.eventId}-${i}`}>
                  <td>{r.season}</td>
                  <td>{r.week}</td>
                  <td>{r.eventName}{r.via === "monday" ? <span className="muted small"> · Monday qualifier</span> : null}</td>
                  <td>{TIER_LABELS[r.tier]}</td>
                  <td>{r.label}</td>
                  <td className="num">{toPar(r.toPar)}</td>
                  <td className="num">{r.earnings ? money(r.earnings) : "—"}</td>
                  <td className="num">{Math.round(r.seasonPoints)}</td>
                  <td className={`num ${r.sgPerRound >= 0 ? "good-text" : "bad-text"}`}>{signed(r.sgPerRound, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** His overall level now and the ceiling it can grow to (the average golf skill, 1-20), above the skill boxes. */
function OverallRatings({ current, potential }: { current: number; potential: number | null }) {
  return (
    <div className="overall-ratings">
      <div><span className="overall-label">Overall current</span><strong className="overall-cur">{current.toFixed(1)}</strong></div>
      {potential !== null && <div><span className="overall-label">Overall potential</span><strong className="overall-pot pot-text">{Math.max(current, potential).toFixed(1)}</strong></div>}
      <span className="muted small">Tour average is 12; a top-20 player is about 14.5.</span>
    </div>
  );
}
