import { useState } from "react";
import { CircleDot, Trophy } from "lucide-react";
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
  worldRanking,
  yearOf,
  type RyderCupResult,
  type Team,
  type World,
} from "../../season";
import { PlayerName } from "../components/PlayerLink";

const teamName = (t: Team) => (t === "USA" ? "United States" : "Europe");

/** One match: both sides, the winner in bold, and the margin. */
function MatchLine({ m, names, mine, sideNames }: { m: MatchResult; names: (id: string) => string; mine: (id: string) => boolean; sideNames?: [string, string] }) {
  const side = (ids: string[], won: boolean) => (
    <span style={{ fontWeight: won ? 700 : 400 }}>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && " / "}
          {mine(id) ? <mark><PlayerName id={id}>{names(id)}</PlayerName></mark> : <PlayerName id={id}>{names(id)}</PlayerName>}
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
                    <td><PlayerName id={r.id}>{r.name}</PlayerName>{pos <= AUTOMATIC ? <span className="badge badge-accent" style={{ marginLeft: 6 }}>In</span> : null}</td>
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
          <strong>Captain's picks if the team were named today:</strong> {picks.map((id, i) => <span key={id}>{i ? ", " : ""}<PlayerName id={id}>{world.players[id]?.player.name ?? id}</PlayerName></span>)}.
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
                    {mine(id) ? <mark><PlayerName id={id}>{names(id)}</PlayerName></mark> : <PlayerName id={id}>{names(id)}</PlayerName>} <span className="muted">{r.teams[t].picks.includes(id) ? "(pick) " : ""}{rec.w}-{rec.l}-{rec.h}</span>
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
  const lb = world.lastBracket?.season === world.season && world.lastBracket.eventId === event?.id ? world.lastBracket : undefined;
  const mine = (id: string) => world.clientIds.includes(id);
  const projected = worldRanking(world)
    .filter((r) => world.players[r.id]?.career.status !== "amateur")
    .slice(0, 64)
    .map((r, i) => ({ id: r.id, seed: i + 1 }));
  const projectedGroups = Array.from({ length: 16 }, (_, group) => [0, 1, 2, 3].map((band) => projected[band * 16 + group]).filter(Boolean));

  if (!lb && event && world.week < event.week) {
    return (
      <main>
        <section className="panel mp-hero">
          <div>
            <span className="mp-kicker">Week {event.week} · Field projection</span>
            <h2>{event.name}</h2>
            <p>The current top 64, arranged into their expected four-player ranking bands. The official draw may move players within each band.</p>
          </div>
          <div className="mp-countdown"><strong>{event.week - world.week}</strong><span>weeks to the draw</span></div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Projected groups</h2><span className="muted small">Updated from this week's world ranking</span></div>
          <div className="mp-projected-groups">
            {projectedGroups.map((group, gi) => (
              <article className="mp-projected-group" key={gi}>
                <header><span>Group {gi + 1}</span><small>4 ranking bands</small></header>
                {group.map((entry, pi) => {
                  const player = world.players[entry!.id]!.player;
                  return <div className={mine(entry!.id) ? "mp-projected-player mp-mine" : "mp-projected-player"} key={entry!.id}>
                    <span className="mp-seed">{entry!.seed}</span>
                    <PlayerName id={entry!.id}>{player.name}</PlayerName>
                    <span className="mp-pot">Pot {pi + 1}</span>
                  </div>;
                })}
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (!lb) {
    const firstRound = projectedGroups.map((g) => g[0]).filter(Boolean);
    const groupOrder = [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10];
    const roundOf16 = Array.from({ length: 8 }, (_, i) => ({ a: firstRound[groupOrder[i * 2]!], b: firstRound[groupOrder[i * 2 + 1]!], margin: "Projected group winners" }));
    return (
      <main>
        <section className="panel mp-hero">
          <div><span className="mp-kicker">Week {event?.week ?? world.week} · Championship week</span><h2>{event?.name ?? "Match Play Championship"}</h2><p>The bracket is ready. Group winners feed into Saturday's round of 16; later rounds fill as matches are played.</p></div>
          <div className="mp-countdown mp-live"><CircleDot size={22} /><span>Draw week</span></div>
        </section>
        <BroadcastBracket
          rounds={[{ name: "Round of 16", matches: roundOf16 }, { name: "Quarter-finals", matches: Array.from({ length: 4 }, () => ({ margin: "TBD" })) }, { name: "Semi-finals", matches: Array.from({ length: 2 }, () => ({ margin: "TBD" })) }, { name: "Final", matches: [{ margin: "TBD" }] }]}
          world={world}
          mine={mine}
          title="Championship bracket"
        />
      </main>
    );
  }
  const b = lb.bracket;
  const names = (id: string) => lb.names[id] ?? world.players[id]?.player.name ?? id;
  const label = (id: string) => <><PlayerName id={id}>{names(id)}</PlayerName>{b.seeds[id] && b.seeds[id] < 9999 ? ` (${b.seeds[id]})` : ""}</>;
  const winnerOf = (m: MatchResult) => m.winner === "a" ? m.a[0] : m.winner === "b" ? m.b[0] : undefined;
  const rounds = b.knockout.map((round) => ({ name: round.name, matches: round.matches.map((m) => ({ a: m.a[0], b: m.b[0], winner: winnerOf(m), margin: m.b.length ? m.margin : "Bye", seeds: b.seeds })) }));
  return (
    <main>
      <section className="panel mp-hero">
        <div><span className="mp-kicker">Season {lb.season} · Week {lb.week}</span><h2>{lb.name}</h2><p>{lb.venue} · Seeds are world rankings at the draw.</p></div>
        <div className="mp-countdown mp-complete"><Trophy size={24} /><span>Champion crowned</span></div>
      </section>
      <BroadcastBracket rounds={rounds} world={world} mine={mine} title="Knockout stage" consolation={b.consolation ? { a: b.consolation.a[0], b: b.consolation.b[0], winner: winnerOf(b.consolation), margin: b.consolation.margin, seeds: b.seeds } : undefined} names={names} />

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

type BroadcastMatch = { a?: string; b?: string; winner?: string; margin: string; seeds?: Record<string, number> };
type BroadcastRound = { name: string; matches: BroadcastMatch[] };

function BroadcastBracket({ rounds, world, mine, title, consolation, names }: { rounds: BroadcastRound[]; world: World; mine: (id: string) => boolean; title: string; consolation?: BroadcastMatch; names?: (id: string) => string }) {
  const playerName = (id: string) => names?.(id) ?? world.players[id]?.player.name ?? id;
  const entrant = (id: string | undefined, match: BroadcastMatch, slot: "a" | "b") => {
    if (!id) return <div className="mp-entrant mp-tbd"><span className="mp-seed">—</span><span>{slot === "b" && match.a ? "Opponent TBD" : "TBD"}</span></div>;
    const rank = match.seeds?.[id];
    return <div className={`mp-entrant${match.winner === id ? " mp-win" : ""}${mine(id) ? " mp-mine" : ""}`}>
      <span className="mp-seed">{rank && rank < 9999 ? rank : "•"}</span><PlayerName id={id}>{playerName(id)}</PlayerName>{match.winner === id && <span className="mp-winner-tick">✓</span>}
    </div>;
  };
  const final = rounds.at(-1)?.matches[0];
  const champion = final?.winner;
  return <section className="panel mp-knockout-panel">
    <div className="panel-head"><h2>{title}</h2><span className="muted small">Follow the gold rails to the championship match</span></div>
    <div className="mp-bracket-scroll">
      <div className="mp-bracket-board" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(205px, 1fr)) 190px` }}>
        {rounds.map((round, ri) => <div className="mp-col" key={round.name}>
          <div className="mp-round-head"><span>0{ri + 1}</span><strong>{round.name}</strong></div>
          <div className="mp-round">
            {round.matches.map((match, mi) => <div className="mp-match-wrap" key={mi}>
              <article className="mp-match">{entrant(match.a, match, "a")}{entrant(match.b, match, "b")}<footer>{match.margin}</footer></article>
            </div>)}
          </div>
        </div>)}
        <aside className="mp-champion-card">
          <Trophy size={38} strokeWidth={1.5} />
          <span>Champion</span>
          <strong>{champion ? playerName(champion) : "To be decided"}</strong>
          {champion && <small>Last player standing</small>}
        </aside>
      </div>
    </div>
    {consolation && <div className="mp-third-place"><span>Third-place match</span><div>{entrant(consolation.a, consolation, "a")}{entrant(consolation.b, consolation, "b")}</div><strong>{consolation.margin}</strong></div>}
  </section>;
}
