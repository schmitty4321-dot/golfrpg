import { ARCHETYPES, nationInfo, traitsOf } from "../../engine";
import { ARCHETYPE_KEY, PROMISE_BY_KIND, STATUS_LABELS, TRAIT_BY_ID_NAME, goalProgress, masteries, masteryPoints, masteryTier, pointsList, promiseState, rankMap, rivalriesOf, tierProgress, trustOf, type World } from "../../season";
import { ArchetypePill } from "../components/Archetype";
import { Nation } from "../components/Flag";
import { Portrait } from "../components/Portrait";
import { formWord, money } from "../format";

const COURSE_ART = ["/art/scenes/approach.webp", "/art/scenes/longGame.webp", "/art/scenes/shortGame.webp", "/art/facilities/center-1.webp", "/art/facilities/center-2.webp", "/art/facilities/center-3.webp"];

export function PlayerScreen({ world, clientId }: { world: World; clientId: string }) {
  const wp = world.players[clientId]!;
  const p = wp.player;
  const c = wp.career;
  const management = wp.client!;
  const season = c.results.filter((r) => r.season === world.season);
  const recent = season.slice(-10);
  const rank = rankMap(world).get(clientId) ?? 400;
  const pointsRank = pointsList(world).indexOf(clientId) + 1 || null;
  const trust = Math.round(trustOf(wp));
  const mood = Math.round(management.happiness);
  const upcoming = world.schedule.filter((e) => e.week >= world.week).slice(0, 6);
  const caddie = (world.caddies ?? []).find((x) => x.id === management.caddieId);
  const coaches = Object.entries(management.staff).map(([role, id]) => ({ role, coach: world.coaches.find((x) => x.id === id) })).filter((x) => x.coach);
  const rival = rivalriesOf(world, clientId)[0];
  const goals = management.goals ?? [];
  const promises = [...(management.promises ?? [])].reverse().slice(0, 2);
  const madeCuts = season.filter((r) => r.madeCut).length;
  const top10s = season.filter((r) => r.madeCut && r.position <= 10).length;
  const avgFinish = madeCuts ? Math.round(season.filter((r) => r.madeCut).reduce((n, r) => n + r.position, 0) / madeCuts) : null;
  const outlook = management.happiness >= 72 && p.condition >= 80 ? "Confident" : p.condition < 70 ? "Needs recovery" : p.form > .2 ? "Trending up" : "Stable";
  const best = season.length ? [...season].sort((a, b) => a.position - b.position)[0] : null;

  return <main className="player-command-page">
    <aside className="player-command-rail" aria-label="Player command sections">
      <div className="player-command-mark">⚑<strong>PLAYER<br />COMMAND</strong></div>
      <Portrait player={p} size={104} title={p.name} />
      <h2>{p.name}</h2>
      <span><Nation nationality={p.nationality} /> {p.age} · {nationInfo(p.nationality).name}</span>
      <nav>
        <a href="#command-overview">⌂ <span>Overview</span></a><a href="#command-performance">↗ <span>Performance</span></a><a href="#command-schedule">▣ <span>Schedule</span></a><a href="#command-team">♟ <span>Team</span></a><a href="#command-goals">◆ <span>Goals</span></a><a href="#command-career">★ <span>Career</span></a>
      </nav>
      <div className="rail-vitals"><span>World rank <b>#{rank}</b></span><span>Trust <b>{trust}</b></span><span>Mood <b>{mood}</b></span><span>Contract <b>to S{management.contract.untilSeason}</b></span></div>
    </aside>

    <div className="player-command-content">
      <section className="player-command-hero" id="command-overview">
        <img src="/art/player-command/hero.png" alt="Illustrated coastal golf course and clubhouse" /><div className="player-command-hero-shade" />
        <div className="player-command-title"><span>PLAYER COMMAND CENTER</span><h1>{p.name}</h1><p>{p.age} · {nationInfo(p.nationality).name} · {STATUS_LABELS[c.status]}</p>{p.archetype && <ArchetypePill id={p.archetype} tier={masteryTier(wp, ARCHETYPE_KEY)} />}</div>
        <div className="command-vitals">
          <CommandVital label="World" value={`#${rank}`} note={pointsRank ? `Points list #${pointsRank}` : "Not yet ranked"} /><CommandVital label="Form" value={formWord(p.form)} note={recent.length ? `${madeCuts}/${season.length} cuts made` : "Season begins here"} /><CommandVital label="Mood" value={mood >= 75 ? "Happy" : mood >= 55 ? "Content" : "Concerned"} note={`${mood}/100`} /><CommandVital label="Trust" value={trust >= 75 ? "High" : trust >= 45 ? "Steady" : "Fragile"} note={`${trust}/100`} /><CommandVital label="Condition" value={`${Math.round(p.condition)}%`} note={wp.injury ? wp.injury.name : p.condition >= 80 ? "Fit to compete" : "Manage workload"} /><CommandVital label="Contract" value={`${Math.max(0, management.contract.untilSeason - world.season + 1)} seasons`} note={`${Math.round(management.contract.commission * 100)}% commission`} />
        </div>
      </section>

      <div className="command-primary-grid" id="command-performance">
        <section className="command-card performance-card"><CommandHeading title="Season Performance" note={`${season.length} starts · ${top10s} top 10${top10s === 1 ? "" : "s"}`} /><div className="performance-summary"><MiniStat label="Best finish" value={best?.label ?? "—"} /><MiniStat label="Average finish" value={avgFinish ? `#${avgFinish}` : "—"} /><MiniStat label="Prize money" value={money(c.seasonEarnings)} /><MiniStat label="Season points" value={Math.round(c.seasonPoints).toLocaleString()} /></div><PerformanceChart results={recent} /><div className="result-strip">{(recent.length ? recent.slice(-6) : upcoming.slice(0, 6)).map((item, i) => "eventName" in item ? <article key={item.eventId}><img src={COURSE_ART[i % COURSE_ART.length]} alt="" /><span>{item.eventName}</span><strong className={!item.madeCut ? "bad-text" : item.position <= 10 ? "good-text" : ""}>{item.label}</strong></article> : <article key={item.id}><img src={COURSE_ART[i % COURSE_ART.length]} alt="" /><span>{item.name}</span><strong>W{item.week}</strong></article>)}</div></section>
        <section className="command-card outlook-card"><CommandHeading title="Current Outlook" note={outlook} /><Outlook icon="⚑" label="Strength" text={best ? `${best.label} at ${best.eventName} is his season benchmark.` : "Fresh season and a clean opportunity to build momentum."} /><Outlook icon="⚙" label="Concern" text={p.condition < 80 ? `Condition is ${Math.round(p.condition)}%; schedule recovery before fatigue compounds.` : recent.some((r) => !r.madeCut) ? "Recent missed cuts call for a steadier event plan." : "No immediate concern; protect his current rhythm."} /><Outlook icon="⌁" label="Course fit" text={p.attributes.drivingAccuracy >= p.attributes.drivingDistance ? "Best on strategic courses where accuracy creates chances." : "Best on open courses where distance is rewarded."} /><Outlook icon="✦" label="Recommended action" text={p.condition < 75 ? "Add a rest week before the next priority start." : top10s ? "Keep the current schedule and target a high-value event." : "Choose a favorable course and build familiarity before the start."} /></section>
      </div>

      <section className="command-card schedule-card" id="command-schedule"><CommandHeading title="Schedule & Readiness" note="Next six events" /><div className="command-schedule-strip">{upcoming.map((e, i) => { const readiness = Math.max(35, Math.round(p.condition - i * 4)); const course = world.courses.find((x) => x.id === e.courseId); return <article key={e.id}><img src={COURSE_ART[i % COURSE_ART.length]} alt="" /><small>WEEK {e.week}</small><strong>{e.name}</strong><span>{course?.name ?? e.region}</span><em className={readiness < 60 ? "risk" : readiness < 80 ? "manage" : "ready"}>{readiness < 60 ? "Recovery needed" : readiness < 80 ? "Manage load" : "Ready"}</em></article>; })}{!upcoming.length && <p className="empty">The season schedule is complete.</p>}</div></section>

      <div className="command-lower-grid">
        <section className="command-card" id="command-goals"><CommandHeading title="Goals & Promises" note={`${goals.length + promises.length} active`} /><div className="command-list">{goals.map((g) => { const progress = goalProgress(world, wp, g); return <div key={g.id}><span>🏆</span><p><strong>{g.label}</strong><small>{progress.text}</small></p><b>{progress.met ? "Done" : "On track"}</b></div>; })}{promises.map((promise) => { const state = promiseState(world, wp, promise); return <div key={promise.id}><span>🤝</span><p><strong>{PROMISE_BY_KIND.get(promise.kind)?.label}</strong><small>{state.word}</small></p><b className={state.tone === "bad" ? "bad-text" : state.tone === "warn" ? "warn-text" : "good-text"}>{state.word}</b></div>; })}{!goals.length && !promises.length && <p className="empty">No active goals or promises yet.</p>}</div></section>
        <section className="command-card" id="command-team"><CommandHeading title="Team & Caddie" note={`${coaches.length + (caddie ? 1 : 0)} assigned`} /><div className="command-team-grid">{caddie && <PersonCard id={`caddie-${caddie.id}`} name={caddie.name} role="Caddie" quality={`Together ${management.caddieWeeks ?? 0} weeks`} />}{coaches.slice(0, 3).map(({ role, coach }) => <PersonCard key={role} id={`coach-${coach!.id}`} name={coach!.name} role={`${role.replace(/([A-Z])/g, " $1")} coach`} quality={`${coach!.quality}/20`} />)}{!caddie && !coaches.length && <p className="empty">Build his team from Team & gear.</p>}</div></section>
        <section className="command-card"><CommandHeading title="Traits & Mastery" note="Competitive identity" /><div className="mastery-command-list">{masteries(wp).slice(0, 4).map(({ key }) => { const pts = masteryPoints(wp, key); const tier = masteryTier(wp, key); const name = key === ARCHETYPE_KEY && p.archetype ? ARCHETYPES[p.archetype].name : TRAIT_BY_ID_NAME(key); return <div key={key}><span>{tier === "gold" ? "♛" : tier === "silver" ? "✦" : "◈"}</span><p><strong>{name}</strong><small>{tier} · {Math.round(tierProgress(pts) * 100)}% to next tier</small></p></div>; })}{!masteries(wp).length && [...traitsOf(p)].slice(0, 4).map((id) => <div key={id}><span>◈</span><p><strong>{TRAIT_BY_ID_NAME(id)}</strong><small>Active player trait</small></p></div>)}</div></section>
        <section className="command-card rival-command-card"><CommandHeading title="Key Rival" note={rival ? `Heat ${Math.round(rival.heat)}` : "No rivalry yet"} />{rival ? <><div className="rival-command-portraits"><Portrait player={p} size={68} title={p.name} /><b>VS</b><Portrait player={world.players[rival.b]!.player} size={68} title={world.players[rival.b]!.player.name} /></div><strong>{world.players[rival.b]!.player.name}</strong><p>{rival.aWins}-{rival.bWins} head to head</p></> : <p className="empty">A playoff, Sunday duel or match-play meeting can start one.</p>}</section>
      </div>

      <section className="command-card career-command-card" id="command-career"><CommandHeading title="Career Milestones" note={`${c.careerEvents} career starts`} /><div className="career-command-timeline"><Milestone year="Start" title="Turned professional" note={STATUS_LABELS[c.status]} /><Milestone year="Agency" title="Signed with your agency" note={`${Math.round(management.contract.commission * 100)}% commission`} /><Milestone year="Best" title={c.careerWins ? `${c.careerWins} career win${c.careerWins === 1 ? "" : "s"}` : `${c.careerTop10s} career top 10s`} note={money(c.careerEarnings)} /><Milestone year="Now" title={`World #${rank}`} note={best ? `Best this year: ${best.label}` : "The next result writes the story"} /></div></section>
    </div>
  </main>;
}

function CommandVital({ label, value, note }: { label: string; value: string; note: string }) { return <div><small>{label}</small><strong>{value}</strong><span>{note}</span></div>; }
function CommandHeading({ title, note }: { title: string; note: string }) { return <header className="command-heading"><h2>{title}</h2><span>{note}</span></header>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }
function Outlook({ icon, label, text }: { icon: string; label: string; text: string }) { return <div className="outlook-row"><span>{icon}</span><strong>{label}</strong><p>{text}</p></div>; }
function PersonCard({ id, name, role, quality }: { id: string; name: string; role: string; quality: string }) { return <article><Portrait player={{ id, nationality: "USA", age: 38 }} size={70} title={name} /><strong>{name}</strong><span>{role}</span><small>{quality}</small></article>; }
function Milestone({ year, title, note }: { year: string; title: string; note: string }) { return <div><span>{year}</span><strong>{title}</strong><small>{note}</small></div>; }

type Result = World["players"][string]["career"]["results"][number];
function PerformanceChart({ results }: { results: Result[] }) {
  if (!results.length) return <div className="performance-empty"><span>↗</span><strong>Season tracking begins with his first result</strong><small>Finishes, cuts and momentum will appear here.</small></div>;
  const xy = (r: Result, i: number) => ({ x: results.length === 1 ? 50 : (i / (results.length - 1)) * 100, y: Math.min(88, Math.max(8, r.madeCut ? r.position : 115)) / 1.3 });
  const points = results.map((r, i) => { const q = xy(r, i); return `${q.x},${q.y}`; }).join(" ");
  return <div className="performance-chart"><div className="chart-labels"><span>Top 10</span><span>Made cut</span><span>Missed cut</span></div><svg viewBox="0 0 100 90" preserveAspectRatio="none" aria-label="Recent finishing positions"><line x1="0" y1="46" x2="100" y2="46" className="cut-line" /><polyline points={points} /><g>{results.map((r, i) => { const q = xy(r, i); return <circle key={r.eventId} cx={q.x} cy={q.y} r="2" className={!r.madeCut ? "miss" : r.position <= 10 ? "top" : ""} />; })}</g></svg></div>;
}
