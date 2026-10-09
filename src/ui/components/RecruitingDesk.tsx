import { useState } from "react";
import { nationInfo } from "../../engine";
import {
  ACTIONS,
  DEALBREAKERS,
  READ_TIERS,
  SELLING_POINTS,
  SHOWCASE_HOURS,
  actionBlock,
  agencyList,
  ceilingRange,
  dealbreaker,
  dealbreakerMet,
  gemOrBust,
  grades,
  groupRange,
  headStart,
  holdShowcase,
  hoursLeft,
  interestIn,
  knownArchetype,
  knownTraits,
  narrowing,
  priorities,
  prospects,
  proProspects,
  actionsFor,
  hoursFor,
  isPro,
  commissionGrace,
  firstCall,
  FIRST_CALL,
  recruitMark,
  type RecruitMark,
  marketRate,
  rankMap,
  readOf,
  recruit,
  recruitingOf,
  rivalInterest,
  rivalMoves,
  schoolLabel,
  showcaseBlock,
  stars,
  weeklyHours,
  spentThisWeek,
  AMATEUR_CLASS_SIZE,
  type RecruitAction,
  type World,
} from "../../season";
import type { Game } from "../useGame";
import { GROUP_LABELS } from "./StatBoxes";
import { PlayerName, useOpenPlayer } from "./PlayerLink";
import { Portrait } from "./Portrait";
import { Stars } from "./Stars";
import { TraitChips } from "./Traits";

const readWords = (r: number) => (r <= 0 ? "Not scouted" : r < READ_TIERS.skills ? "A glimpse" : r < READ_TIERS.ceiling ? "Rough read" : r < READ_TIERS.details ? "Good read" : "Detailed read");
const range = (x: { low: number; high: number }) => (x.low === x.high ? `${x.low}` : `${x.low}–${x.high}`);

/** The desk's summary bar: hours this week, who you're working on, who's keen, and the amateur class places. */
function RecruitSummary({ world }: { world: World }) {
  const spent = spentThisWeek(world);
  const left = hoursLeft(world);
  const total = weeklyHours(world);
  const worked = Object.keys(world.agency.prospects ?? {}).filter((id) => world.players[id]);
  const recruiting = worked.filter((id) => recruitMark(world, id) === "recruiting");
  const keen = worked.filter((id) => recruitMark(world, id) === "keen");
  const keenAmateurs = keen.filter((id) => !isPro(world, id)).length;
  const keenPros = keen.length - keenAmateurs;
  return (
    <div className="recruit-summary" aria-label="Recruiting summary">
      <div>
        <span className="small muted">Hours left this week</span>
        <strong>{left}<span className="small muted"> of {total}</span></strong>
        <span className="small muted">Amateurs {spent.amateur} h · Pros {spent.pro} h spent</span>
      </div>
      <div>
        <span className="small muted">Recruits you're working on</span>
        <strong>{worked.length}</strong>
        <span className="small muted">{recruiting.length} recruiting · {keen.length} keen</span>
      </div>
      <div>
        <span className="small muted">Keen</span>
        <strong>{keen.length}</strong>
        <span className="small muted">{keenAmateurs} amateurs · {keenPros} pros</span>
      </div>
      <div>
        <span className="small muted">Class places</span>
        <strong>{keenAmateurs}<span className="small muted"> of {AMATEUR_CLASS_SIZE}</span></strong>
        <span className="small muted">Amateurs keen · commit on signing day</span>
      </div>
    </div>
  );
}

/** The mark on a prospect you've worked on: a ring while you recruit him, a filled pill once he's keen. Nothing for the rest. */
function RecruitBadge({ state, pro }: { state: RecruitMark; pro: boolean }) {
  if (state === "none") return null;
  if (state === "recruiting") {
    return <span className="recruit-mark recruiting" role="img" aria-label="Recruiting" title="You've worked on him: his interest is building">◉</span>;
  }
  const label = pro ? "First call" : "Keen";
  return <span className="recruit-mark keen" role="img" aria-label={label} title={`You've recruited him: his interest is at the first-call level (${FIRST_CALL})`}>● {label}</span>;
}

/** The recruiting desk: this week's hours, how prospects see the agency, the prospects, and last season's class. */
export function RecruitingDesk({ world, game }: { world: World; game: Game }) {
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState<"amateur" | "pro">("amateur");
  const total = weeklyHours(world);
  const left = hoursLeft(world);
  const g = grades(world);
  const pool = tab === "pro" ? proProspects(world, 120) : prospects(world);
  const list = pool.slice(0, showAll ? 120 : 30);
  const ranks = rankMap(world);
  const ranking = recruitingOf(world).lastRanking;
  const showcase = showcaseBlock(world);
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Recruiting desk</h2><span className="muted small">One budget of hours for amateurs and pros: scout them and build their interest. Amateurs choose on signing day; pros weigh it when you make an offer.</span></div>
        <div className="recruit-hours"><strong>{left}</strong><span>of {total} hours left this week</span></div>
      </div>
      <RecruitSummary world={world} />
      <div className="meter" style={{ marginBottom: 12 }}><span style={{ width: `${Math.round((left / total) * 100)}%` }} /></div>
      <div className="recruit-grades">
        <span className="recruit-label">How prospects see you</span>
        {(Object.keys(SELLING_POINTS) as (keyof typeof SELLING_POINTS)[]).map((k) => (
          <span key={k} className={`grade grade-${g[k]}`}><b>{g[k]}</b> {SELLING_POINTS[k]}</span>
        ))}
        <button className="btn btn-small" disabled={!!showcase} title={showcase ?? undefined} onClick={() => game.act((w) => { const n = holdShowcase(w); setNote(`Junior showcase: a first look at ${n} high-school prospect${n === 1 ? "" : "s"}.`); })}>
          Junior showcase · {SHOWCASE_HOURS}h
        </button>
      </div>
      {note && <p className="small good-text">{note}</p>}
      <div className="tabs" role="tablist" style={{ marginBottom: 8 }}>
        <button role="tab" aria-selected={tab === "amateur"} onClick={() => { setTab("amateur"); setOpen(null); }}>Amateurs</button>
        <button role="tab" aria-selected={tab === "pro"} onClick={() => { setTab("pro"); setOpen(null); }}>Pros</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Stars</th><th>{tab === "pro" ? "Player" : "Prospect"}</th><th className="num">Age</th><th>{tab === "pro" ? "World · contract" : "School"}</th><th>Your read</th><th>Interest (0-100)</th><th>Most interested rival</th><th>His list</th><th /></tr></thead>
          <tbody>
            {list.map((id) => {
              const wp = world.players[id]!;
              const interest = interestIn(world, id);
              const mine = world.agency.prospects?.[id];
              const pos = narrowing(wp) && mine ? agencyList(world, id).findIndex((a) => a.you) + 1 : 0;
              return (
                <tr key={id} className={open === id ? "row-current" : undefined}>
                  <td><Stars value={stars(world, id)} /></td>
                  <td><RecruitBadge state={recruitMark(world, id)} pro={tab === "pro"} /><PlayerName id={id}>{wp.player.name}</PlayerName>{wp.academy ? <span className="sponsor-tag">Academy</span> : null}{firstCall(world, id) ? <span className="sponsor-tag" title="His deal is up and he's keen on you: he'll hear you out before the other agencies bid">First call</span> : null}</td>
                  <td className="num">{wp.player.age}</td>
                  <td className="small">{tab === "pro" ? <>#{ranks.get(id)} · {wp.agent && wp.agent.untilSeason > world.season ? `${wp.agent.agency} to S${wp.agent.untilSeason}` : wp.agent ? `${wp.agent.agency}, final season` : "Free agent"}</> : schoolLabel(world, wp)}</td>
                  <td className="small">{readWords(readOf(world, id))}</td>
                  <td style={{ minWidth: 110 }}><span className="meter"><span style={{ width: `${interest}%` }} /></span><span className="small muted">{Math.round(interest)}</span></td>
                  <td className="small">{(() => { const [a, v] = Object.entries(rivalInterest(world, id)).sort((x, y) => y[1] - x[1])[0] ?? []; return a ? <>{a} <span className="muted">({Math.round(v!)})</span></> : "—"; })()}</td>
                  <td className="small">{pos ? (pos <= 3 ? <span className="good-text">You're #{pos}</span> : <span className="bad-text">Not in his top 3</span>) : narrowing(wp) ? "Deciding this season" : "—"}</td>
                  <td><button className="btn btn-small" onClick={() => setOpen(open === id ? null : id)}>{open === id ? "Close" : "Card"}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!showAll && pool.length > 30 && <button className="btn btn-small" style={{ marginTop: 8 }} onClick={() => setShowAll(true)}>Show all {pool.length}</button>}
      {open && world.players[open] && <ProspectCard world={world} game={game} id={open} />}
      {ranking && (
        <div style={{ marginTop: 14 }}>
          <span className="recruit-label">Season {ranking.season} recruiting classes</span>
          <ol className="recruit-classes">
            {ranking.rows.slice(0, 7).map((r) => (
              <li key={r.agency} className={r.agency === world.agency.name ? "me" : undefined}><b>{r.agency}</b> <span className="muted small">{r.signed} signed · score {r.score}</span></li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** A recruit's card: more comes into view the more you scout him, and it's never exact. */
export function ProspectCard({ world, game, id }: { world: World; game: Game; id: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const openPlayer = useOpenPlayer();
  const wp = world.players[id]!;
  const read = readOf(world, id);
  const mine = world.agency.prospects?.[id];
  const interest = interestIn(world, id);
  const head = headStart(world, wp);
  const ceiling = ceilingRange(world, id);
  const gb = gemOrBust(world, id);
  const db = dealbreaker(world, id);
  const list = narrowing(wp) ? agencyList(world, id).slice(0, 3) : null;
  const groups = (Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[]).filter((k) => k !== "physical");
  const act = (a: RecruitAction) => game.act((w) => setMsg(recruit(w, id, a)));
  const pro = isPro(world, id);
  return (
    <article className="prospect-card">
      <header className="prospect-head">
        <Portrait player={wp.player} size={84} />
        <div>
          <h3 style={{ margin: 0 }}>{wp.player.name} <Stars value={stars(world, id)} /></h3>
          <div className="secondary small">{wp.player.age} · {nationInfo(wp.player.nationality).name} · {pro ? `World #${rankMap(world).get(id) ?? "—"} · ${wp.agent ? `with ${wp.agent.agency} to S${wp.agent.untilSeason}` : "free agent"}` : schoolLabel(world, wp)}</div>
          <div className="small">Your read: <b>{readWords(read)}</b>{gb && <span className={`gem-tag ${gb}`}>{gb === "gem" ? "Hidden gem" : "Possible bust"}</span>}</div>
        </div>
        <div className="prospect-interest">
          <span className="recruit-label">Interest in you</span>
          <strong>{Math.round(interest)}</strong>
          <span className="meter"><span style={{ width: `${interest}%` }} /></span>
        </div>
      </header>

      <div className="prospect-grid">
        <section>
          <span className="recruit-label">His game</span>
          {read < READ_TIERS.skills ? (
            <p className="muted small">Watch film or go to one of his events to start reading his game.</p>
          ) : (
            <ul className="prospect-ranges">
              {groups.map((k) => {
                const r = groupRange(world, id, k);
                return r ? (
                  <li key={k}><span>{GROUP_LABELS[k]}</span><span className="range-bar"><span style={{ left: `${((r.low - 1) / 19) * 100}%`, width: `${Math.max(3, ((r.high - r.low) / 19) * 100)}%` }} /></span><b>{range(r)}</b></li>
                ) : null;
              })}
            </ul>
          )}
          {ceiling ? <p className="small">Ceiling: <b>{range(ceiling)}</b> overall <span className="muted">(tour average 12)</span></p> : read >= READ_TIERS.skills ? <p className="muted small">A good read ({Math.round(READ_TIERS.ceiling * 100)}%) shows his ceiling.</p> : null}
          {read >= READ_TIERS.details ? (
            <>
              {knownArchetype(world, id) && <p className="small">Type: <b>{knownArchetype(world, id)}</b></p>}
              <TraitChips ids={knownTraits(world, id)} empty="No standout traits seen" />
            </>
          ) : read >= READ_TIERS.ceiling ? <p className="muted small">A detailed read ({Math.round(READ_TIERS.details * 100)}%) shows his traits and type.</p> : null}
          <p className="muted small" style={{ marginBottom: 0 }}>Ranges narrow with every look, and faster with better scouts. You'll never have an exact number until he's your client.</p>
        </section>

        <section>
          <span className="recruit-label">What he wants</span>
          {mine?.known ? (
            <>
              <ul className="ws-lines">
                {priorities(world, id).map((p) => <li key={p}>{SELLING_POINTS[p]} <span className={`grade grade-${grades(world)[p]}`}><b>{grades(world)[p]}</b></span></li>)}
              </ul>
              {db ? <p className={`small ${dealbreakerMet(world, db) ? "good-text" : "bad-text"}`}>Dealbreaker: {DEALBREAKERS[db]}{dealbreakerMet(world, db) ? " (you qualify)" : " (you don't)"}</p> : <p className="small muted">No dealbreakers.</p>}
            </>
          ) : (
            <p className="muted small">{pro ? "Talk to his caddie and coach, or take him to dinner," : "Call or visit"} to find out what he cares about.</p>
          )}
          {head.notes.length > 0 && <p className="small good-text">Head start: {head.notes.join(" · ")}</p>}
          {list && mine && (
            <>
              <span className="recruit-label">His top three</span>
              <ol className="ws-lines">{list.map((a) => <li key={a.agency} className={a.you ? "good-text" : undefined}>{a.agency}{a.you ? " (you)" : ""}</li>)}</ol>
            </>
          )}
          <span className="recruit-label">Who else is after him</span>
          <ul className="prospect-ranges">
            {Object.entries(rivalInterest(world, id)).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([a, v]) => (
              <li key={a}><span>{a}</span><span className="range-bar"><span style={{ left: 0, width: `${v}%`, background: "var(--muted)" }} /></span><b>{Math.round(v)}</b></li>
            ))}
            <li className="good-text"><span>You</span><span className="range-bar"><span style={{ left: 0, width: `${interest}%` }} /></span><b>{Math.round(interest)}</b></li>
          </ul>
          {rivalMoves(world, id).length > 0 && (
            <p className="small muted">Latest: {rivalMoves(world, id).slice(0, 3).map((m) => `${m.agency} ${m.text} (week ${m.absWeek - world.season * 52})`).join(" · ")}</p>
          )}
          {pro && firstCall(world, id) && <p className="small"><strong>First call.</strong> His deal is up and he's keen on you: he'll hear your offer before the winter market, so rival bids{wp.agent ? ` and ${wp.agent.agency}` : ""} don't count against you.</p>}
          {pro && !firstCall(world, id) && <p className="small muted">At interest {FIRST_CALL}, he takes your call first when his deal is up: rival bids won't count against you.</p>}
          {pro && commissionGrace(world, id) > 0 && <p className="small">He's keen enough to pay up to {Math.round((marketRate(wp) + commissionGrace(world, id)) * 1000) / 10}% (his going rate is {Math.round(marketRate(wp) * 1000) / 10}%) without it hurting your chances, or his mood once he's signed.</p>}
          {pro && <p className="small">Interest counts when you make him an offer{wp.agent && wp.agent.untilSeason > world.season ? `, which you can from his final season with ${wp.agent.agency}` : ""}. His tour numbers are public, so you start with a read of him.</p>}
          {narrowing(wp) && <p className="small">He turns pro at the end of this season and commits on signing day to the top of his list. With you, that's a three-season rookie deal at 13%.</p>}
        </section>
      </div>

      <div className="btn-row" style={{ flexWrap: "wrap", marginTop: 10 }}>
        {actionsFor(world, id).map((a) => {
          const block = actionBlock(world, id, a);
          return (
            <button key={a} className="btn btn-small" disabled={!!block} title={block ?? ACTIONS[a].blurb} onClick={() => act(a)}>
              {ACTIONS[a].label} · {hoursFor(world, id, a)}h
            </button>
          );
        })}
        {openPlayer && <button className="btn btn-small btn-primary" onClick={() => openPlayer(id)}>Player page and offer</button>}
      </div>
      {msg && <p className="small" style={{ marginBottom: 0 }}>{msg}</p>}
    </article>
  );
}
