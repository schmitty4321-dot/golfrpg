import { useMemo } from "react";
import { sgExtremes, weekSummary, type ClientWeek, type WeekReport, type World } from "../../season";
import { money, signed, toPar } from "../format";

const SG_WORDS = { offTheTee: "off the tee", approach: "approach play", aroundTheGreen: "around the green", putting: "putting" } as const;
const HOLE_WORDS: Record<number, string> = { [-3]: "albatross", [-2]: "eagle", [-1]: "birdie", 0: "par", 1: "bogey", 2: "double bogey" };
const holeWord = (d: number) => HOLE_WORDS[d] ?? (d > 0 ? `+${d}` : `${d}`);

/** A rank and where it went: "#212 → #188 ▲24". */
function Move({ before, after, prefix = "#" }: { before: number | null; after: number | null; prefix?: string }) {
  if (after === null) return <span className="muted">unranked</span>;
  const up = before !== null ? before - after : 0;
  return (
    <span>
      {before !== null && before !== after && <span className="muted">{prefix}{before} → </span>}
      <strong>{prefix}{after}</strong>
      {up !== 0 && <span className={up > 0 ? "good-text" : "bad-text"}> {up > 0 ? `▲${up}` : `▼${-up}`}</span>}
    </span>
  );
}

function Delta({ before, after }: { before: number; after: number }) {
  const d = Math.round(after - before);
  return <span>{Math.round(after)}{d !== 0 && <span className={d > 0 ? "good-text" : "bad-text"}> ({d > 0 ? "+" : ""}{d})</span>}</span>;
}

function ClientCard({ c }: { c: ClientWeek }) {
  const ex = sgExtremes(c.sg);
  const gap = c.race.after === null ? null : c.race.line - c.race.after;
  const line = c.race.lineLabel.split(" ").slice(0, 2).join(" ");
  return (
    <article className="ws-client">
      <div className="ws-client-head">
        <div>
          <strong>{c.name}</strong>
          <span className="secondary small">{c.eventName}</span>
        </div>
        <span className={`ws-finish${c.madeCut ? "" : " mc"}`}>{c.madeCut ? c.label : "MC"} <small>{toPar(c.toPar)}</small></span>
      </div>
      <div className="ws-facts">
        <div><span className="muted small">Prize money</span><b>{money(c.earnings)}</b><span className="secondary small">Your cut {money(c.commission)}</span></div>
        <div><span className="muted small">{c.race.label}</span><b><Move before={c.race.before} after={c.race.after} /></b><span className="secondary small">{gap === null ? c.race.lineLabel : gap >= 0 ? `${gap} inside the ${line}` : `${-gap} outside the ${line}`}{c.points ? ` · +${c.points} pts` : ""}</span></div>
        <div><span className="muted small">World ranking</span><b><Move before={c.worldRank.before} after={c.worldRank.after} /></b></div>
      </div>
      <ul className="ws-lines">
        <li>Best part of his game: <strong>{SG_WORDS[ex.best]}</strong> ({signed(c.sg[ex.best], 2)}); weakest: <strong>{SG_WORDS[ex.worst]}</strong> ({signed(c.sg[ex.worst], 2)}).</li>
        {c.best && c.worst && (
          <li>Best hole: {holeWord(c.best.toPar)} on {c.best.hole} (round {c.best.round}). Worst: {holeWord(c.worst.toPar)} on {c.worst.hole} (round {c.worst.round}).</li>
        )}
        <li>{c.callsMade ? `You made the call on ${c.callsMade} hole${c.callsMade === 1 ? "" : "s"}.` : "He made every call himself."}</li>
        {c.roundCalls.map((l) => <li key={l} className="secondary">{l.slice(c.name.length + 2)}</li>)}
        {c.goals.length > 0 && <li>Season goals: {c.goals.map((g, i) => <span key={i} className={g.met ? "good-text" : ""}>{i ? " · " : ""}{g.met ? "✓ " : ""}{g.text}</span>)}</li>}
        <li>Mood <Delta before={c.mood.before} after={c.mood.after} /> · trust <Delta before={c.trust.before} after={c.trust.after} /> · condition {c.condition}%</li>
        <li><strong>Next week:</strong> {c.nextWeek}</li>
      </ul>
    </article>
  );
}

/** The week in review: your players first, then the agency's week and the story of each event. */
export function WeekSummary({ world, report }: { world: World; report: WeekReport }) {
  const s = useMemo(() => weekSummary(world, report), [world, report]);
  if (!s.clients.length) return null;
  return (
    <section className="panel week-summary">
      <div className="panel-head"><h2>Week {report.week} in review</h2><span className="muted small">How your players and the agency did</span></div>
      <div className="ws-clients">{s.clients.map((c) => <ClientCard key={c.id} c={c} />)}</div>
      <div className="ws-bottom">
        {s.agency && (
          <article className="ws-box">
            <h3>The agency's week</h3>
            <ul className="ws-lines">
              <li>Commission earned: <strong>{money(s.agency.commission)}</strong>{s.agency.costs ? <> · costs {money(s.agency.costs)}</> : null}</li>
              <li>Bank: {money(s.agency.bankBefore)} → <strong>{money(s.agency.bankAfter)}</strong> <span className={s.agency.net >= 0 ? "good-text" : "bad-text"}>({s.agency.net >= 0 ? "+" : "−"}{money(Math.abs(s.agency.net))})</span></li>
              <li>Reputation: <Delta before={s.agency.reputation.before} after={s.agency.reputation.after} /></li>
              {s.agency.achievements.map((a) => <li key={a} className="good-text">Achievement unlocked: {a}</li>)}
              {s.agency.rivals.length > 0 && <li>Rival agencies: {s.agency.rivals.map((r, i) => <span key={r.agency}>{i ? " · " : ""}{r.agency} ({r.name}, {r.label})</span>)}</li>}
            </ul>
          </article>
        )}
        {s.events.map((e) => (
          <article className="ws-box" key={e.eventName}>
            <h3>{e.eventName}</h3>
            <ul className="ws-lines">
              <li><strong>{e.winner}</strong> wins at {toPar(e.winningScore)}{e.playoff.length > 1 ? `, in a playoff with ${e.playoff.filter((n) => n !== e.winner).join(" and ")}` : ""}.</li>
              {e.lowRound && <li>Low round: {e.lowRound.score} by {e.lowRound.name} (round {e.lowRound.round}).</li>}
              {e.cutLine !== null && <li>Cut: {toPar(e.cutLine)}.</li>}
              {e.mover && e.mover.places > 0 && <li>Mover of the day: {e.mover.name}, up {e.mover.places} places on Sunday.</li>}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
