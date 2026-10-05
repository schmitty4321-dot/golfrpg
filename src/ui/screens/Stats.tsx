import { useMemo, useState } from "react";
import { feetInches } from "../../engine";
import { statsRows, type SeasonStats, type World } from "../../season";
import { PlayerName } from "../components/PlayerLink";
import { money } from "../format";
import { Nation } from "../components/Flag";

type Group = "results" | "sg" | "tee" | "approach" | "around" | "putting" | "scoring";

interface Column {
  key: string;
  label: string;
  /** Short header for the table. */
  head: string;
  group: Group;
  value: (s: SeasonStats) => number | null;
  format: (v: number) => string;
  /** Which way is better; sorting starts from the best. */
  better: "high" | "low";
}

const per = (x: number, n: number) => (n > 0 ? x / n : null);
const pct = (x: number, n: number) => (n > 0 ? (100 * x) / n : null);
const pctText = (v: number) => `${v.toFixed(1)}%`;
const sgText = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
const one = (v: number) => v.toFixed(1);
const two = (v: number) => v.toFixed(2);
const whole = (v: number) => `${Math.round(v)}`;

export const STAT_COLUMNS: Column[] = [
  { key: "events", label: "Events played", head: "Events", group: "results", value: (s) => s.events, format: whole, better: "high" },
  { key: "rounds", label: "Rounds played", head: "Rds", group: "results", value: (s) => s.rounds, format: whole, better: "high" },
  { key: "wins", label: "Wins", head: "Wins", group: "results", value: (s) => s.wins, format: whole, better: "high" },
  { key: "top10s", label: "Top 10s", head: "Top 10", group: "results", value: (s) => s.top10s, format: whole, better: "high" },
  { key: "cuts", label: "Cuts made (%)", head: "Cuts", group: "results", value: (s) => pct(s.cuts, s.events), format: (v) => `${Math.round(v)}%`, better: "high" },
  { key: "earnings", label: "Earnings", head: "Earnings", group: "results", value: (s) => s.earnings, format: (v) => money(v), better: "high" },
  { key: "points", label: "Season points", head: "Points", group: "results", value: (s) => s.points, format: whole, better: "high" },
  { key: "scoring", label: "Scoring average", head: "Avg", group: "results", value: (s) => per(s.strokes, s.rounds), format: two, better: "low" },

  { key: "sgTotal", label: "Strokes gained: total (per round)", head: "SG total", group: "sg", value: (s) => per(s.sg.offTheTee + s.sg.approach + s.sg.aroundTheGreen + s.sg.putting, s.rounds), format: sgText, better: "high" },
  { key: "sgOtt", label: "Strokes gained: off the tee", head: "Off tee", group: "sg", value: (s) => per(s.sg.offTheTee, s.rounds), format: sgText, better: "high" },
  { key: "sgApp", label: "Strokes gained: approach", head: "Approach", group: "sg", value: (s) => per(s.sg.approach, s.rounds), format: sgText, better: "high" },
  { key: "sgArg", label: "Strokes gained: around the green", head: "Around", group: "sg", value: (s) => per(s.sg.aroundTheGreen, s.rounds), format: sgText, better: "high" },
  { key: "sgPutt", label: "Strokes gained: putting", head: "Putting", group: "sg", value: (s) => per(s.sg.putting, s.rounds), format: sgText, better: "high" },

  { key: "dd", label: "Driving distance", head: "Distance", group: "tee", value: (s) => per(s.shots.driveYards, s.shots.drives), format: (v) => `${v.toFixed(1)}`, better: "high" },
  { key: "da", label: "Driving accuracy", head: "Fairways", group: "tee", value: (s) => pct(s.shots.fairwaysHit, s.shots.fairwayAttempts), format: pctText, better: "high" },
  { key: "left", label: "Left rough tendency", head: "Miss left", group: "tee", value: (s) => pct(s.shots.missLeft, s.shots.fairwayAttempts), format: pctText, better: "low" },
  { key: "right", label: "Right rough tendency", head: "Miss right", group: "tee", value: (s) => pct(s.shots.missRight, s.shots.fairwayAttempts), format: pctText, better: "low" },

  { key: "gir", label: "Greens in regulation", head: "GIR", group: "approach", value: (s) => pct(s.shots.gir, s.shots.holes), format: pctText, better: "high" },
  { key: "fromFairway", label: "Greens hit from the fairway", head: "From fwy", group: "approach", value: (s) => pct(s.shots.girFromFairway, s.shots.approachesFromFairway), format: pctText, better: "high" },
  { key: "fromRough", label: "Greens hit from the rough", head: "From rough", group: "approach", value: (s) => pct(s.shots.girFromRough, s.shots.approachesFromRough), format: pctText, better: "high" },
  { key: "prox", label: "Proximity to hole", head: "Proximity", group: "approach", value: (s) => per(s.shots.proximityFeet, s.shots.proximityCount), format: feetInches, better: "low" },
  { key: "goForIt", label: "Going for it (par 5s)", head: "Go for it", group: "approach", value: (s) => pct(s.shots.goForItSuccesses, s.shots.goForItAttempts), format: pctText, better: "high" },

  { key: "scrambling", label: "Scrambling", head: "Scrambling", group: "around", value: (s) => pct(s.shots.scrambles, s.shots.scrambleAttempts), format: pctText, better: "high" },
  { key: "sand", label: "Sand saves", head: "Sand saves", group: "around", value: (s) => pct(s.shots.sandSaves, s.shots.sandAttempts), format: pctText, better: "high" },

  { key: "putts", label: "Putts per round", head: "Putts/rd", group: "putting", value: (s) => per(s.shots.putts, s.shots.holes / 18), format: two, better: "low" },
  { key: "puttsGir", label: "Putts per green in regulation", head: "Putts/GIR", group: "putting", value: (s) => per(s.shots.puttsOnGir, s.shots.gir), format: (v) => v.toFixed(3), better: "low" },
  { key: "one", label: "One-putts per round", head: "1-putts", group: "putting", value: (s) => per(s.shots.onePutts, s.shots.holes / 18), format: two, better: "high" },
  { key: "three", label: "Three-putts per round", head: "3-putts", group: "putting", value: (s) => per(s.shots.threePutts, s.shots.holes / 18), format: two, better: "low" },
  { key: "firstPutt", label: "Average first-putt distance", head: "1st putt", group: "putting", value: (s) => per(s.shots.firstPuttFeet, s.shots.puttedHoles), format: (v) => `${one(v)} ft`, better: "low" },
  { key: "made", label: "Average distance of putts made", head: "Made dist", group: "putting", value: (s) => per(s.shots.madeFeet, s.shots.madeCount), format: (v) => `${one(v)} ft`, better: "high" },
  { key: "longest", label: "Longest putt made", head: "Longest", group: "putting", value: (s) => (s.shots.madeCount ? s.shots.longestMade : null), format: (v) => `${Math.round(v)} ft`, better: "high" },

  { key: "birdies", label: "Birdies or better per round", head: "Birdies/rd", group: "scoring", value: (s) => per(s.shots.birdies + s.shots.eagles, s.shots.holes / 18), format: two, better: "high" },
  { key: "eagles", label: "Eagles", head: "Eagles", group: "scoring", value: (s) => s.shots.eagles, format: whole, better: "high" },
  { key: "pars", label: "Pars per round", head: "Pars/rd", group: "scoring", value: (s) => per(s.shots.pars, s.shots.holes / 18), format: two, better: "high" },
  { key: "bogeys", label: "Bogeys per round", head: "Bogeys/rd", group: "scoring", value: (s) => per(s.shots.bogeys, s.shots.holes / 18), format: two, better: "low" },
  { key: "doubles", label: "Doubles or worse per round", head: "Doubles/rd", group: "scoring", value: (s) => per(s.shots.doublesOrWorse, s.shots.holes / 18), format: two, better: "low" },
  { key: "penalties", label: "Penalty strokes per round", head: "Penalties", group: "scoring", value: (s) => per(s.shots.penalties, s.shots.holes / 18), format: two, better: "low" },
];

const GROUPS: { id: Group | "all"; label: string }[] = [
  { id: "results", label: "Results" },
  { id: "sg", label: "Strokes gained" },
  { id: "tee", label: "Off the tee" },
  { id: "approach", label: "Approach" },
  { id: "around", label: "Around the green" },
  { id: "putting", label: "Putting" },
  { id: "scoring", label: "Scoring" },
  { id: "all", label: "All" },
];

export function Stats({ world }: { world: World }) {
  const [which, setWhich] = useState<"this" | "last">("this");
  const [group, setGroup] = useState<Group | "all">("results");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "scoring", dir: "asc" });
  const [qualified, setQualified] = useState(true);
  const [clientsOnly, setClientsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(100);

  const all = useMemo(() => statsRows(world, which), [world, which]);
  // Like the tour's stats pages: to be ranked, a player needs a fair share of the rounds.
  const maxRounds = Math.max(0, ...all.map((r) => r.stats.rounds));
  const minRounds = Math.max(1, Math.round(maxRounds * 0.4));
  const columns = group === "all" ? STAT_COLUMNS : STAT_COLUMNS.filter((c) => c.group === group);
  const sortCol = STAT_COLUMNS.find((c) => c.key === sort.key) ?? STAT_COLUMNS[0]!;

  const q = search.trim().toLowerCase();
  const rows = all
    .filter((r) => !qualified || r.stats.rounds >= minRounds)
    .filter((r) => !clientsOnly || world.clientIds.includes(r.id))
    .filter((r) => !q || world.players[r.id]!.player.name.toLowerCase().includes(q))
    .map((r) => ({ ...r, v: sortCol.value(r.stats) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === null ? (b.v === null ? 0 : 1) : -1;
      return sort.dir === "asc" ? a.v - b.v : b.v - a.v;
    });

  const clickHead = (c: Column) =>
    setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: c.better === "high" ? "desc" : "asc" }));
  const lastSeason = world.season - 1;
  // Switching groups sorts by the group's headline stat unless the current sort is still on show.
  const pickGroup = (g: Group | "all") => {
    setGroup(g);
    const cols = g === "all" ? STAT_COLUMNS : STAT_COLUMNS.filter((c) => c.group === g);
    if (!cols.some((c) => c.key === sort.key)) {
      const first = cols.find((c) => c.key !== "events" && c.key !== "rounds") ?? cols[0]!;
      setSort({ key: first.key, dir: first.better === "high" ? "desc" : "asc" });
    }
  };

  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1 style={{ fontSize: 22 }}>Player stats</h1>
            <span className="secondary small">Main-tour events · {which === "this" ? `season ${world.season}` : `season ${lastSeason}`} · click a column to sort</span>
          </div>
          <div className="btn-row">
            <div className="tabs" role="tablist" style={{ margin: 0 }}>
              <button role="tab" aria-selected={which === "this"} onClick={() => setWhich("this")}>This season</button>
              <button role="tab" aria-selected={which === "last"} onClick={() => setWhich("last")}>Last season</button>
            </div>
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label="Stat groups" style={{ flexWrap: "wrap" }}>
          {GROUPS.map((g) => (
            <button key={g.id} role="tab" aria-selected={group === g.id} onClick={() => pickGroup(g.id)}>{g.label}</button>
          ))}
        </div>
        <div className="stats-filters">
          <input type="search" placeholder="Find a player" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find a player" />
          <label><input type="checkbox" checked={qualified} onChange={(e) => setQualified(e.target.checked)} /> Qualified only ({minRounds}+ rounds)</label>
          <label><input type="checkbox" checked={clientsOnly} onChange={(e) => setClientsOnly(e.target.checked)} /> Your clients</label>
          <span className="secondary small">Sorted by {sortCol.label.toLowerCase()}</span>
        </div>
        {rows.length === 0 ? (
          <p className="empty">{all.length === 0 ? (which === "this" ? "No main-tour events played yet this season." : "No stats from last season.") : "No players match."}</p>
        ) : (
          <div className="table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Player</th>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`num sortable${c.key === sort.key ? " sorted" : ""}`}
                      aria-sort={c.key === sort.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      title={c.label}
                    >
                      <button onClick={() => clickHead(c)}>
                        {c.head}
                        <span aria-hidden className="sort-arrow">{c.key === sort.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, show).map((r, i) => {
                  const wp = world.players[r.id]!;
                  return (
                    <tr key={r.id} className={world.clientIds.includes(r.id) ? "me" : ""}>
                      <td className="num muted">{i + 1}</td>
                      <td className="nowrap">
                        <PlayerName id={r.id}>{wp.player.name}</PlayerName> <Nation nationality={wp.player.nationality} />
                      </td>
                      {columns.map((c) => {
                        const v = c.value(r.stats);
                        return <td key={c.key} className={`num${c.key === sort.key ? " sorted" : ""}`}>{v === null ? "–" : c.format(v)}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > show && <button className="linkish" style={{ marginTop: 8 }} onClick={() => setShow(show + 100)}>Show 100 more ({rows.length - show} left)</button>}
        <p className="muted small" style={{ marginBottom: 0 }}>
          Strokes gained are per round against the field that week. Shot stats come from the same replays as the round stats and shot tracer. Developmental tour events aren't counted.
        </p>
      </section>
    </main>
  );
}
