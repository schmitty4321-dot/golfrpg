import { useState } from "react";
import type { RecordEntry, World } from "../../season";
import { money, toPar } from "../format";
import { Nation } from "../components/Flag";
import { PlayerName } from "../components/PlayerLink";

type View = "seasons" | "majors" | "records" | "hall";

export function HistoryScreen({ world }: { world: World }) {
  const [view, setView] = useState<View>("seasons");
  return (
    <main>
      <section className="panel">
        <div className="tabs" role="tablist" style={{ flexWrap: "wrap" }}>
          {(
            [
              ["seasons", "Season by season"],
              ["majors", "Major champions"],
              ["records", "Record book"],
              ["hall", "Hall of Fame"],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
        {view === "seasons" && <Seasons world={world} />}
        {view === "majors" && <Majors world={world} />}
        {view === "records" && <RecordBook world={world} />}
        {view === "hall" && <Hall world={world} />}
      </section>
    </main>
  );
}

const done = (world: World) => world.history.seasons.filter((s) => s.pointsChampion).sort((a, b) => b.season - a.season);

function Seasons({ world }: { world: World }) {
  const seasons = done(world);
  if (seasons.length === 0) return <p className="empty">History starts when your first season is complete.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Season</th><th>Points champion</th><th>Money leader</th><th>Dev tour champion</th><th>Amateur champion</th><th>Q-School medallist</th><th className="num">Cards earned</th></tr></thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.season}>
              <td>{s.season === 0 ? "0 (before you)" : s.season}</td>
              <td>{s.pointsChampion ? <><PlayerName id={s.pointsChampion.playerId}>{s.pointsChampion.name}</PlayerName> ({s.pointsChampion.wins} wins)</> : "–"}</td>
              <td>{s.moneyLeader ? <><PlayerName id={s.moneyLeader.playerId}>{s.moneyLeader.name}</PlayerName>, {money(s.moneyLeader.earnings)}</> : "–"}</td>
              <td>{s.devChampion ? <PlayerName id={s.devChampion.playerId}>{s.devChampion.name}</PlayerName> : "–"}</td>
              <td>{s.amateurChampion ? <PlayerName id={s.amateurChampion.playerId}>{s.amateurChampion.name}</PlayerName> : "–"}</td>
              <td>{s.qSchool[0] ? <><PlayerName id={s.qSchool[0].playerId}>{s.qSchool[0].name}</PlayerName> ({toPar(s.qSchool[0].toPar)})</> : "–"}</td>
              <td className="num" title={s.graduates.map((g) => `${g.name} (${g.via === "dev" ? "dev tour" : "Q-School"})`).join(", ")}>{s.graduates.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Majors({ world }: { world: World }) {
  const majors = world.schedule.filter((e) => e.tier === "major");
  const seasons = world.history.seasons.filter((s) => s.winners.some((w) => w.tier === "major")).sort((a, b) => b.season - a.season);
  if (seasons.length === 0) return <p className="empty">No majors played yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Season</th>{majors.map((m) => <th key={m.id}>{m.name.replace(/^The /, "")}</th>)}</tr></thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.season}>
              <td>{s.season}</td>
              {majors.map((m, k) => {
                // The k-th major of that season, so older calendars line up too.
                const w = s.winners.filter((x) => x.tier === "major")[k];
                return <td key={m.id} className={w && world.clientIds.includes(w.playerId) ? "good-text" : ""}>{w ? <><PlayerName id={w.playerId}>{w.name}</PlayerName> ({toPar(w.toPar)})</> : "–"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Your clients' wins are highlighted.</p>
    </div>
  );
}

function RecordBook({ world }: { world: World }) {
  const r = world.history.records;
  const rows: [string, RecordEntry | null, (v: number) => string][] = [
    ["Lowest round", r.lowestRound, (v) => `${v}`],
    ["Lowest 72 holes", r.lowest72, toPar],
    ["Biggest winning margin", r.biggestMargin, (v) => `${v} stroke${v === 1 ? "" : "s"}`],
    ["Most wins in a season", r.mostWinsSeason, (v) => `${v}`],
    ["Youngest winner", r.youngestWinner, (v) => `${v} years old`],
    ["Oldest winner", r.oldestWinner, (v) => `${v} years old`],
  ];
  return (
    <table>
      <thead><tr><th>Record</th><th>Mark</th><th>Holder</th><th>Where</th><th className="num">Season</th></tr></thead>
      <tbody>
        {rows.map(([label, e, fmt]) => (
          <tr key={label}>
            <td>{label}</td>
            <td><strong>{e ? fmt(e.value) : "–"}</strong></td>
            <td>{e ? <PlayerName id={e.playerId}>{e.name}</PlayerName> : "–"}</td>
            <td className="secondary">{e?.event ?? ""}</td>
            <td className="num">{e?.season ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Hall({ world }: { world: World }) {
  const hof = [...world.history.hallOfFame].sort((a, b) => b.inducted - a.inducted);
  // Active players closing in on election.
  const contenders = Object.values(world.players)
    .map((wp) => ({ wp, score: wp.career.careerWins + wp.career.careerMajors * 3 + wp.career.pointsTitles * 3 }))
    .filter((x) => x.score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  return (
    <div className="grid-2">
      <div>
        <h3 style={{ marginBottom: 8 }}>Members</h3>
        {hof.length === 0 ? (
          <p className="empty">Nobody yet. Greats are elected when they retire, on wins, majors and points titles.</p>
        ) : (
          <table>
            <thead><tr><th>Player</th><th className="num">Wins</th><th className="num">Majors</th><th className="num">Titles</th><th className="num">Inducted</th></tr></thead>
            <tbody>
              {hof.map((h) => (
                <tr key={h.playerId}><td><PlayerName id={h.playerId}>{h.name}</PlayerName> <Nation nationality={h.nationality} /></td><td className="num">{h.wins}</td><td className="num">{h.majors}</td><td className="num">{h.pointsTitles}</td><td className="num">S{h.inducted}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <h3 style={{ marginBottom: 8 }}>Active players on course for it</h3>
        <table>
          <thead><tr><th>Player</th><th className="num">Age</th><th className="num">Wins</th><th className="num">Majors</th></tr></thead>
          <tbody>
            {contenders.map(({ wp }) => (
              <tr key={wp.player.id} className={world.clientIds.includes(wp.player.id) ? "me" : ""}>
                <td><PlayerName id={wp.player.id}>{wp.player.name}</PlayerName></td><td className="num">{wp.player.age}</td><td className="num">{wp.career.careerWins}</td><td className="num">{wp.career.careerMajors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
