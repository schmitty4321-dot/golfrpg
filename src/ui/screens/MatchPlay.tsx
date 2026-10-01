import { useState } from "react";
import type { MatchResult } from "../../engine";
import {
  AUTOMATIC,
  TEAMS,
  ensureRyderCup,
  halfPoints,
  hostOf,
  isRyderCupSeason,
  nextRyderCupSeason,
  playerRecord,
  ryderCupWeek,
  ryderStandings,
  scoreLine,
  selectTeam,
  venueFor,
  yearOf,
  type RyderCupResult,
  type Team,
  type World,
} from "../../season";

const teamName = (t: Team) => (t === "USA" ? "United States" : "Europe");

/** One match: both sides, the winner in bold, and the margin. */
function MatchLine({ m, names, mine, sideNames }: { m: MatchResult; names: (id: string) => string; mine: (id: string) => boolean; sideNames?: [string, string] }) {
  const side = (ids: string[], won: boolean) => (
    <span style={{ fontWeight: won ? 700 : 400 }}>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && " / "}
          {mine(id) ? <mark>{names(id)}</mark> : names(id)}
        </span>
      ))}
    </span>
  );
  if (m.b.length === 0) return <span>{side(m.a, true)} <span className="muted">(bye)</span></span>;
  const who = m.winner === "a" ? sideNames?.[0] : m.winner === "b" ? sideNames?.[1] : undefined;
  return (
    <span>
      {side(m.a, m.winner === "a")} <span className="muted">v</span> {side(m.b, m.winner === "b")}{" "}
      <span className="small muted">{m.winner === null ? "halved" : `${who ? `${who} ` : ""}${m.margin}`}</span>
    </span>
  );
}

// ------------------------------------------------------------------ Ryder Cup

export function RyderCupScreen({ world }: { world: World }) {
  const state = ensureRyderCup(world);
  const cupSeason = nextRyderCupSeason(world.season);
  const played = state.history.find((r) => r.season === cupSeason);
  const venue = venueFor(world, cupSeason);
  const mine = (id: string) => world.clientIds.includes(id);
  const last = state.history.at(-1);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <h2>Ryder Cup {yearOf(cupSeason)}</h2>
          <span className="muted small">Holders: {teamName(state.holder)}</span>
        </div>
        <p style={{ marginTop: 0 }}>
          {played
            ? `Played at ${played.venue}: ${scoreLine(played)}.`
            : `${venue.name}, hosted by ${teamName(hostOf(cupSeason))}, in week ${ryderCupWeek(world)} ${cupSeason === world.season ? "this season" : "next season"} (the week after the TOUR Championship).`}{" "}
          Twelve a side: the top {AUTOMATIC} on each points list qualify and the captains pick six more. Four foursomes and four four-balls on Friday and on Saturday, twelve singles on Sunday;
          14½ of the 28 points wins it, and the holders keep it on 14.
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>
          US points follow the 2027 system: fixed points by finishing place (a major win 3,000, THE PLAYERS 2,850, signature and playoff events 2,250, other events 1,500, down to 70th; a missed cut 5-10),
          from the season's first event to the BMW Championship of the Ryder Cup year. Europe's list runs from the previous TOUR Championship, with events worth 5,000 (majors), 3,000, 2,000 and 1,000 (opposite-field) to the winner.
        </p>
      </section>

      {!played && (
        <div className="grid-2 even">
          {TEAMS.map((t) => (
            <StandingsTable key={t} world={world} team={t} cupSeason={cupSeason} mine={mine} />
          ))}
        </div>
      )}

      {last && <RyderResult r={last} world={world} mine={mine} />}

      {state.history.length > 1 && (
        <section className="panel">
          <div className="panel-head"><h2>Past Ryder Cups</h2></div>
          <ul>
            {[...state.history].reverse().slice(1).map((r) => (
              <li key={r.season}>
                <button className="linkish" onClick={() => setOpen(open === r.season ? null : r.season)}>
                  {r.year} at {r.venue}: {scoreLine(r)} ({teamName(r.winner)} {r.retained ? "retain" : "win"})
                </button>
                {open === r.season && <RyderResult r={r} world={world} mine={mine} compact />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function StandingsTable({ world, team, cupSeason, mine }: { world: World; team: Team; cupSeason: number; mine: (id: string) => boolean }) {
  const rows = ryderStandings(world, team, cupSeason);
  const picks = isRyderCupSeason(world.season) && rows.length ? selectTeam(world, team).picks : [];
  const shown = rows.slice(0, 20);
  const clientsBelow = rows.slice(20).filter((r) => mine(r.id));
  return (
    <section className="panel">
      <div className="panel-head"><h2>{teamName(team)} points</h2><span className="muted small">{rows.length} players on the list</span></div>
      {rows.length === 0 ? (
        <p className="empty">No points yet: the list opens {team === "USA" ? "with the first event of the Ryder Cup year" : "after this season's TOUR Championship"}.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th className="num">#</th><th>Player</th><th className="num">Points</th><th className="num">Events</th><th className="num">World</th></tr></thead>
            <tbody>
              {[...shown, ...clientsBelow].map((r) => {
                const pos = rows.indexOf(r) + 1;
                return (
                  <tr key={r.id} className={mine(r.id) ? "row-current" : undefined} style={pos === AUTOMATIC ? { borderBottom: "2px solid var(--accent)" } : undefined}>
                    <td className="num">{pos}</td>
                    <td>{r.name}{pos <= AUTOMATIC ? <span className="badge badge-accent" style={{ marginLeft: 6 }}>In</span> : null}</td>
                    <td className="num">{Math.round(r.points).toLocaleString("en-US")}</td>
                    <td className="num">{r.events}</td>
                    <td className="num">{r.rank ? `#${r.rank}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {picks.length > 0 && (
        <p className="small" style={{ marginBottom: 0 }}>
          <strong>Captain's picks if the team were named today:</strong> {picks.map((id) => world.players[id]?.player.name ?? id).join(", ")}.
        </p>
      )}
    </section>
  );
}

function RyderResult({ r, world, mine, compact }: { r: RyderCupResult; world: World; mine: (id: string) => boolean; compact?: boolean }) {
  const names = (id: string) => r.names[id] ?? world.players[id]?.player.name ?? id;
  // The running score after each session.
  const running: string[] = [];
  let us = 0;
  let eu = 0;
  for (const s of r.sessions) {
    for (const m of s.matches) {
      if (m.winner === "a") us += 1;
      else if (m.winner === "b") eu += 1;
      else {
        us += 0.5;
        eu += 0.5;
      }
    }
    running.push(`USA ${halfPoints(us)} – ${halfPoints(eu)} Europe`);
  }
  return (
    <section className={compact ? undefined : "panel"}>
      {!compact && (
        <div className="panel-head">
          <h2>{r.year} Ryder Cup, {r.venue}</h2>
          <span className="small"><strong>{scoreLine(r)}</strong> · {teamName(r.winner)} {r.retained ? "retain the Cup" : "win"}</span>
        </div>
      )}
      <div className="grid-2 even">
        {TEAMS.map((t) => (
          <div key={t}>
            <div className="mp-label">{teamName(t)}</div>
            <ul className="small" style={{ marginTop: 4 }}>
              {[...r.teams[t].automatic, ...r.teams[t].picks].map((id) => {
                const rec = playerRecord(r, id);
                return (
                  <li key={id}>
                    {mine(id) ? <mark>{names(id)}</mark> : names(id)} <span className="muted">{r.teams[t].picks.includes(id) ? "(pick) " : ""}{rec.w}-{rec.l}-{rec.h}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {r.sessions.map((s, i) => (
        <div key={s.name} style={{ marginTop: 12 }}>
          <div className="mp-label">{s.name} <span className="muted">· {running[i]}</span></div>
          <ol className="small" style={{ marginTop: 4 }}>
            {s.matches.map((m, k) => (
              <li key={k}><MatchLine m={m} names={names} mine={mine} sideNames={["USA", "Europe"]} /></li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

// ------------------------------------------------------------------ Match Play Championship

export function MatchPlayScreen({ world }: { world: World }) {
  const event = world.schedule.find((e) => e.format === "matchplay");
  const lb = world.lastBracket;
  const mine = (id: string) => world.clientIds.includes(id);
  if (!lb) {
    return (
      <main>
        <section className="panel">
          <div className="panel-head"><h2>{event?.name ?? "Match Play Championship"}</h2></div>
          <p style={{ margin: 0 }}>
            {event ? `Week ${event.week}. ` : ""}The world's top 64 are drawn into 16 groups of four and play three round-robin matches; the group winners go into a knockout bracket, with sudden death for
            matches level after 18. The draw and the bracket appear here once it has been played.
          </p>
        </section>
      </main>
    );
  }
  const b = lb.bracket;
  const names = (id: string) => lb.names[id] ?? world.players[id]?.player.name ?? id;
  const label = (id: string) => `${names(id)}${b.seeds[id] && b.seeds[id] < 9999 ? ` (${b.seeds[id]})` : ""}`;
  const cell = (m: MatchResult, id: string | undefined, k: 0 | 1) =>
    id ? (
      <div key={k} className={`${m.winner === (k === 0 ? "a" : "b") ? "mp-win" : ""}${mine(id) ? " mp-mine" : ""}`}>{label(id)}</div>
    ) : (
      <div key={k} className="muted">bye</div>
    );
  return (
    <main>
      <section className="panel">
        <div className="panel-head"><h2>{lb.name}</h2><span className="muted small">Season {lb.season}, week {lb.week} · {lb.venue}</span></div>
        <p className="muted small" style={{ margin: 0 }}>Seeds are world rankings at the draw. Bold: the winner of each match.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Knockout</h2></div>
        <div className="mp-bracket">
          {b.knockout.map((round) => (
            <div key={round.name} className="mp-col">
              <div className="mp-label">{round.name}</div>
              <div className="mp-round">
                {round.matches.map((m, i) => (
                  <div key={i} className="mp-match">
                    {cell(m, m.a[0], 0)}
                    {cell(m, m.b[0], 1)}
                    <div className="small muted">{m.b.length ? m.margin : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {b.consolation && (
            <div className="mp-col">
              <div className="mp-label">Third place</div>
              <div className="mp-match">
                {cell(b.consolation, b.consolation.a[0], 0)}
                {cell(b.consolation, b.consolation.b[0], 1)}
                <div className="small muted">{b.consolation.margin}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Groups</h2><span className="muted small">A win is a point, a half half a point; a tie at the top goes to sudden death</span></div>
        <div className="mp-groups">
          {b.groups.map((g, gi) => (
            <div key={gi} className="mp-group">
              <div className="mp-label">Group {gi + 1}</div>
              <table className="small">
                <tbody>
                  {g.standings.map((s, i) => (
                    <tr key={s.id} className={mine(s.id) ? "row-current" : undefined}>
                      <td style={{ fontWeight: i === 0 ? 700 : 400 }}>{label(s.id)}</td>
                      <td className="num">{halfPoints(s.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details className="small">
                <summary>Matches</summary>
                <ul style={{ paddingLeft: 16 }}>
                  {g.matches.map((m, i) => (
                    <li key={i}><MatchLine m={m} names={names} mine={mine} /></li>
                  ))}
                  {g.playoff.map((m, i) => (
                    <li key={`p${i}`}>Playoff: <MatchLine m={m} names={names} mine={mine} /></li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
