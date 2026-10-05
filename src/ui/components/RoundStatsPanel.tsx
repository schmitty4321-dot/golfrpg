import { Fragment, useMemo, useState } from "react";
import { STAT_DEFS, eventStats, feetInches, rankStats, type PlayerEventResult, type RoundStats, type StatDef, type TournamentResult } from "../../engine";
import { ordinal } from "../../season";
import { PlayerName } from "./PlayerLink";

/** A field average in the stat's own unit, without the "(x/y)" counts. */
function formatAverage(def: StatDef, v: number): string {
  if (["da", "left", "right", "gir", "fromFairway", "fromRough", "goForIt", "scrambling", "sand"].includes(def.key)) return `${v.toFixed(1)}%`;
  if (def.key === "dd") return `${v.toFixed(1)} yds`;
  if (def.key === "prox") return feetInches(v);
  if (["firstPutt", "made", "longest"].includes(def.key)) return `${v.toFixed(1)} ft`;
  if (def.key === "score") return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
  if (def.key === "puttsGir") return v.toFixed(3);
  return v.toFixed(2);
}

const GROUPS = ["Scoring", "Off the tee", "Approach", "Around the green", "Putting"] as const;

/**
 * Tour-style stats for one player: this round (with his rank in the field
 * and the field average) and the event so far.
 */
export function RoundStatsPanel({ result, row, round, field }: { result: TournamentResult; row: PlayerEventResult; round: number; field: Map<string, RoundStats> }) {
  const [open, setOpen] = useState(false);
  const mine = field.get(row.player.id);
  const soFar = useMemo(() => eventStats(result, row, round - 1), [result, row, round]);
  if (!mine) return null;
  const ranked = rankStats(mine, [...field.values()]);
  const total = rankStats(soFar, []);
  const headline = ["dd", "da", "gir", "scrambling", "putts"];
  const rows = open ? ranked : ranked.filter((r) => headline.includes(r.def.key));
  return (
    <div style={{ marginTop: 12 }}>
      <div className="panel-head" style={{ marginBottom: 6 }}>
        <h3>Round {round} stats</h3>
        <button className="linkish small" onClick={() => setOpen(!open)}>{open ? "Key stats only" : "All stats"}</button>
      </div>
      <div className="table-wrap">
        <table className="stats-table">
          <thead>
            <tr><th>Stat</th><th className="num">R{round}</th><th className="num">Rank</th><th className="num">Field avg</th>{round > 1 && <th className="num">Event</th>}</tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => {
              const inGroup = rows.filter((r) => r.def.group === g);
              if (inGroup.length === 0) return null;
              return (
                <Fragment key={g}>
                  {open && <tr className="divider"><td colSpan={round > 1 ? 5 : 4}>{g}</td></tr>}
                  {inGroup.map((r) => {
                    const top = r.rank !== null && r.rank <= Math.max(3, Math.round(r.fieldSize * 0.1));
                    const bottom = r.rank !== null && r.rank > r.fieldSize * 0.9;
                    const ev = total.find((x) => x.def.key === r.def.key)!;
                    return (
                      <tr key={r.def.key}>
                        <td>{r.def.label}</td>
                        <td className="num"><strong>{r.text}</strong></td>
                        <td className={`num small ${top ? "good-text" : bottom ? "bad-text" : "secondary"}`}>
                          {r.rank === null ? "–" : `${r.tied ? "T" : ""}${ordinal(String(r.rank))}`}
                        </td>
                        <td className="num small secondary">{r.fieldAverage === null ? "–" : formatAverage(r.def, r.fieldAverage)}</td>
                        {round > 1 && <td className="num small">{ev.text}</td>}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ margin: "6px 0 0" }}>
        Rank among the {field.size} players who played round {round}. Stats are counted from the same shots the replays show.
      </p>
    </div>
  );
}

/** The round's leaders in a few headline stats. */
export function RoundLeaders({ result, field, clientIds }: { result: TournamentResult; field: Map<string, RoundStats>; clientIds: string[] }) {
  const name = (id: string) => result.leaderboard.find((r) => r.player.id === id)!.player.name;
  const boards = ["dd", "da", "gir", "prox", "putts", "scrambling"].map((key) => {
    const def = STAT_DEFS.find((d) => d.key === key)!;
    const list = [...field.entries()]
      .map(([id, s]) => ({ id, s, v: def.value(s) }))
      .filter((x): x is { id: string; s: RoundStats; v: number } => x.v !== null)
      .sort((a, b) => (def.better === "low" ? a.v - b.v : b.v - a.v))
      .slice(0, 3);
    return { def, list };
  });
  return (
    <div className="leaders-grid">
      {boards.map(({ def, list }) => (
        <div key={def.key}>
          <h3 style={{ marginBottom: 4 }}>{def.label}</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }} className="small">
            {list.map((x) => (
              <li key={x.id} className={clientIds.includes(x.id) ? "good-text" : ""}>
                <PlayerName id={x.id}>{name(x.id)}</PlayerName> <span className="secondary">{def.format(x.v, x.s)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
