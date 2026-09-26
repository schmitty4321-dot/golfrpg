import { coursePar, courseYards } from "../../engine";
import {
  FULL_CARD,
  REGION_NAMES,
  SEASON_WEEKS,
  clientOptions,
  pointsList,
  type EntryOption,
  type World,
} from "../../season";
import { ClientStrip } from "../components/ClientStrip";
import { Leaderboard } from "../components/Leaderboard";
import { TIER_LABELS, fitWord, millions, signed } from "../format";
import type { Go } from "../nav";
import type { Game } from "../useGame";

const ACCESS_TONE: Record<EntryOption["access"], string> = {
  invited: "var(--good)",
  in: "var(--good)",
  alternate: "var(--warning)",
  monday: "var(--serious)",
  "not-invited": "var(--critical)",
};

export function Home({ world, game, go }: { world: World; game: Game; go: Go }) {
  const seasonOver = world.week > SEASON_WEEKS;
  const last = game.state.reports[game.state.reports.length - 1];
  return (
    <main>
      <ClientStrip world={world} />
      <div className="grid-2">
        <div className="stack">
          {seasonOver ? <SeasonOver world={world} game={game} /> : <ThisWeek world={world} game={game} />}
          {last && (
            <section className="panel">
              <div className="panel-head">
                <h2>Week {last.week} result</h2>
                {last.client.result && (
                  <button className="linkish" onClick={() => go("tournament", last.client.record?.eventId)}>Full leaderboard →</button>
                )}
              </div>
              <p style={{ marginTop: 0 }}>{last.client.summary}</p>
              {last.client.result && <Leaderboard result={last.client.result} clientId={world.clientId} limit={5} />}
              {last.results
                .filter((r) => r.result !== last.client.result)
                .map((r) => (
                  <p className="secondary small" key={r.event.id}>
                    Elsewhere: {r.result.leaderboard[0]!.player.name} won {r.event.name}.{" "}
                    <button className="linkish" onClick={() => go("tournament", r.event.id)}>Leaderboard</button>
                  </p>
                ))}
            </section>
          )}
        </div>
        <div className="stack">
          <CardRace world={world} />
          <section className="panel">
            <div className="panel-head"><h2>News</h2></div>
            {world.news.length === 0 ? (
              <p className="empty">The season hasn't started yet.</p>
            ) : (
              <ul className="news">
                {world.news.slice(0, 10).map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function ThisWeek({ world, game }: { world: World; game: Game }) {
  const options = clientOptions(world);
  const remaining = SEASON_WEEKS - world.week + 1;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Week {world.week}: where does he play?</h2>
        <span className="muted small">{remaining} weeks left</span>
      </div>
      {options.map((o) => <EventCard key={o.event.id} option={o} onEnter={() => void game.play({ kind: "enter", eventId: o.event.id })} />)}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => void game.play({ kind: "rest" })}>Rest this week</button>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => void game.play({ kind: "auto" }, Math.min(4, remaining))} title="Your client picks his own schedule">
          Auto 4 weeks
        </button>
        <button className="btn" onClick={() => void game.play({ kind: "auto" }, remaining)} title="Your client picks his own schedule">
          Auto to season end
        </button>
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>Resting restores condition. On auto, your client picks his own schedule like the computer players do.</p>
    </section>
  );
}

function EventCard({ option: o, onEnter }: { option: EntryOption; onEnter: () => void }) {
  const e = o.event;
  const fit = fitWord(o.fit);
  const canEnter = o.access !== "not-invited";
  return (
    <article className="event-card">
      <div className="event-title">
        <span className={`badge${e.tier === "major" ? " badge-major" : ""}`}>{TIER_LABELS[e.tier]}</span>
        <h2>{e.name}</h2>
      </div>
      <div className="facts">
        <span>{o.course.name}</span>
        <span>{o.course.style[0]!.toUpperCase() + o.course.style.slice(1)}</span>
        <span>Par {coursePar(o.course)} · {courseYards(o.course).toLocaleString("en-US")} yds</span>
        <span>{o.course.grass} greens, stimp {o.course.greenSpeed}</span>
        <span>{REGION_NAMES[e.region]}</span>
        <span>Purse {millions(e.purse)}</span>
        <span>{e.cutTop ? `${e.fieldSize} players, cut top ${e.cutTop}` : `${e.fieldSize} players, no cut`}</span>
      </div>
      <div className="access">
        <span className="dot" style={{ background: ACCESS_TONE[o.access] }} aria-hidden />
        <span>{o.detail}</span>
      </div>
      <div className="access">
        <span className="dot" style={{ background: fit.tone === "good" ? "var(--good)" : fit.tone === "bad" ? "var(--serious)" : "var(--muted)" }} aria-hidden />
        <span>
          Course fit: <strong>{fit.label}</strong> ({signed(o.fit, 2)} strokes a round against his usual)
        </span>
      </div>
      <div>
        <button className="btn btn-primary" disabled={!canEnter} onClick={onEnter}>
          {o.access === "monday" || o.access === "alternate" ? "Try to qualify" : "Enter"}
        </button>
      </div>
    </article>
  );
}

function SeasonOver({ world, game }: { world: World; game: Game }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>Season {world.season} is over</h2></div>
      <p style={{ marginTop: 0 }}>The Tour Championship is done. Close the season to hand out cards and see how your client did.</p>
      <button className="btn btn-primary" onClick={() => void game.closeSeason()}>Close the season</button>
    </section>
  );
}

function CardRace({ world }: { world: World }) {
  const list = pointsList(world);
  const me = list.indexOf(world.clientId);
  const pts = (i: number) => (list[i] ? world.players[list[i]!]!.career.seasonPoints : 0);
  const mine = world.players[world.clientId]!.career.seasonPoints;
  const line = pts(FULL_CARD - 1);
  const gap = mine - line;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Card race</h2></div>
      <p style={{ marginTop: 0 }}>
        The top {FULL_CARD} on the points list after week 35 keep their card; 126-150 get conditional status.
      </p>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Position</span>
          <span className="stat-value">{me >= 0 ? `#${me + 1}` : "—"}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{FULL_CARD}th place</span>
          <span className="stat-value">{list.length >= FULL_CARD ? `${Math.round(line)} pts` : "—"}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{gap >= 0 ? "Cushion" : "Behind"}</span>
          {me >= 0 && list.length >= FULL_CARD ? (
            <span className={`stat-value ${gap >= 0 ? "good-text" : "bad-text"}`}>{Math.round(Math.abs(gap))} pts</span>
          ) : (
            <span className="stat-value">—</span>
          )}
        </div>
      </div>
    </section>
  );
}
