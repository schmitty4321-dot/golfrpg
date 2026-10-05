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
  readOf,
  recruit,
  recruitingOf,
  schoolLabel,
  showcaseBlock,
  stars,
  weeklyHours,
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

/** The recruiting desk: this week's hours, how prospects see the agency, the prospects, and last season's class. */
export function RecruitingDesk({ world, game }: { world: World; game: Game }) {
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const total = weeklyHours(world);
  const left = hoursLeft(world);
  const g = grades(world);
  const list = prospects(world).slice(0, showAll ? 120 : 30);
  const ranking = recruitingOf(world).lastRanking;
  const showcase = showcaseBlock(world);
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>Recruiting desk</h2><span className="muted small">Amateurs: scout them, build their interest, and win them on signing day (the season's end)</span></div>
        <div className="recruit-hours"><strong>{left}</strong><span>of {total} hours left this week</span></div>
      </div>
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
      <div className="table-wrap">
        <table>
          <thead><tr><th>Stars</th><th>Prospect</th><th className="num">Age</th><th>School</th><th>Your read</th><th>Interest</th><th>His list</th><th /></tr></thead>
          <tbody>
            {list.map((id) => {
              const wp = world.players[id]!;
              const interest = interestIn(world, id);
              const mine = world.agency.prospects?.[id];
              const pos = narrowing(wp) && mine ? agencyList(world, id).findIndex((a) => a.you) + 1 : 0;
              return (
                <tr key={id} className={open === id ? "row-current" : undefined}>
                  <td><Stars value={stars(world, id)} /></td>
                  <td><PlayerName id={id}>{wp.player.name}</PlayerName>{wp.academy ? <span className="sponsor-tag">Academy</span> : null}</td>
                  <td className="num">{wp.player.age}</td>
                  <td className="small">{schoolLabel(world, wp)}</td>
                  <td className="small">{readWords(readOf(world, id))}</td>
                  <td style={{ minWidth: 110 }}><span className="meter"><span style={{ width: `${interest}%` }} /></span><span className="small muted">{Math.round(interest)}</span></td>
                  <td className="small">{pos ? (pos <= 3 ? <span className="good-text">You're #{pos}</span> : <span className="bad-text">Not in his top 3</span>) : narrowing(wp) ? "Deciding this season" : "—"}</td>
                  <td><button className="btn btn-small" onClick={() => setOpen(open === id ? null : id)}>{open === id ? "Close" : "Card"}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!showAll && prospects(world).length > 30 && <button className="btn btn-small" style={{ marginTop: 8 }} onClick={() => setShowAll(true)}>Show all {prospects(world).length} prospects</button>}
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
  return (
    <article className="prospect-card">
      <header className="prospect-head">
        <Portrait player={wp.player} size={84} />
        <div>
          <h3 style={{ margin: 0 }}>{wp.player.name} <Stars value={stars(world, id)} /></h3>
          <div className="secondary small">{wp.player.age} · {nationInfo(wp.player.nationality).name} · {schoolLabel(world, wp)}</div>
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
            <p className="muted small">Call or visit to find out what he cares about.</p>
          )}
          {head.notes.length > 0 && <p className="small good-text">Head start: {head.notes.join(" · ")}</p>}
          {list && mine && (
            <>
              <span className="recruit-label">His top three</span>
              <ol className="ws-lines">{list.map((a) => <li key={a.agency} className={a.you ? "good-text" : undefined}>{a.agency}{a.you ? " (you)" : ""}</li>)}</ol>
            </>
          )}
          {narrowing(wp) && <p className="small">He turns pro at the end of this season and commits on signing day to the top of his list.</p>}
        </section>
      </div>

      <div className="btn-row" style={{ flexWrap: "wrap", marginTop: 10 }}>
        {(Object.keys(ACTIONS) as RecruitAction[]).map((a) => {
          const block = actionBlock(world, id, a);
          return (
            <button key={a} className="btn btn-small" disabled={!!block} title={block ?? ACTIONS[a].blurb} onClick={() => act(a)}>
              {ACTIONS[a].label} · {ACTIONS[a].hours}h
            </button>
          );
        })}
        {openPlayer && <button className="btn btn-small btn-primary" onClick={() => openPlayer(id)}>Player page and offer</button>}
      </div>
      {msg && <p className="small" style={{ marginBottom: 0 }}>{msg}</p>}
    </article>
  );
}
