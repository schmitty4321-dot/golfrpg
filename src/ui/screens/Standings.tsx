import { Fragment, useState } from "react";
import { CONDITIONAL_CARD, DEV_EXEMPT_THROUGH, DEV_FINALS_POINTS, DEV_GRADUATES, DEV_PROMOTION_WINS, FULL_CARD, PRO_AGE, amateurRanking, devPointsList, schoolLabel, pointsList, worldRanking, STATUS_LABELS, type World } from "../../season";
import { money } from "../format";
import { Nation } from "../components/Flag";
import { PlayerName } from "../components/PlayerLink";

type View = "points" | "dev" | "amateurs" | "world" | "money";

export function Standings({ world }: { world: World }) {
  const [view, setView] = useState<View>("points");
  return (
    <main>
      <section className="panel">
        <div className="tabs" role="tablist" style={{ flexWrap: "wrap" }}>
          {(
            [
              ["points", "Points list"],
              ["dev", "Developmental tour"],
              ["amateurs", "Amateurs"],
              ["world", "World ranking"],
              ["money", "Money list"],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
        {view === "points" && <PointsTable world={world} />}
        {view === "dev" && <DevTable world={world} />}
        {view === "amateurs" && <AmateurTable world={world} />}
        {view === "world" && <WorldTable world={world} />}
        {view === "money" && <MoneyTable world={world} />}
      </section>
    </main>
  );
}

function PointsTable({ world }: { world: World }) {
  const list = pointsList(world);
  if (list.length === 0) return <p className="empty">No points yet this season.</p>;
  return (
    <div className="table-wrap">
      <p className="secondary" style={{ marginTop: 0 }}>Top {FULL_CARD} keep a full card; {FULL_CARD + 1}-{CONDITIONAL_CARD} get conditional status.</p>
      <table>
        <thead>
          <tr><th>#</th><th>Player</th><th>Status</th><th className="num">Events</th><th className="num">Wins</th><th className="num">Points</th><th className="num">Earnings</th></tr>
        </thead>
        <tbody>
          {list.map((id, i) => {
            const wp = world.players[id]!;
            return (
              <Fragment key={id}>
                {i === FULL_CARD && <tr className="divider"><td colSpan={7}>Full card line</td></tr>}
                {i === CONDITIONAL_CARD && <tr className="divider"><td colSpan={7}>Conditional status line</td></tr>}
                <tr className={world.clientIds.includes(id) ? "me" : ""}>
                  <td>{i + 1}</td>
                  <td><PlayerName id={id}>{wp.player.name}</PlayerName> <Nation nationality={wp.player.nationality} /></td>
                  <td className="secondary small">{STATUS_LABELS[wp.career.status]}</td>
                  <td className="num">{wp.career.seasonEvents}</td>
                  <td className="num">{wp.career.seasonWins || ""}</td>
                  <td className="num">{Math.round(wp.career.seasonPoints)}</td>
                  <td className="num">{money(wp.career.seasonEarnings)}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WorldTable({ world }: { world: World }) {
  const rows = worldRanking(world).slice(0, 200);
  return (
    <div className="table-wrap">
      <p className="secondary" style={{ marginTop: 0 }}>Points from the last two years, scaled by field strength and fading after 13 weeks, divided by events played (40-52).</p>
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Age</th><th className="num">Avg points</th><th className="num">Events</th><th className="num">Career wins</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const wp = world.players[r.id]!;
            return (
              <tr key={r.id} className={world.clientIds.includes(r.id) ? "me" : ""}>
                <td>{i + 1}</td>
                <td><PlayerName id={r.id}>{wp.player.name}</PlayerName> <Nation nationality={wp.player.nationality} /></td>
                <td>{wp.player.age}</td>
                <td className="num">{r.average.toFixed(2)}</td>
                <td className="num">{r.events}</td>
                <td className="num">{wp.career.careerWins || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MoneyTable({ world }: { world: World }) {
  const rows = Object.values(world.players)
    .filter((wp) => wp.career.seasonEarnings > 0)
    .sort((a, b) => b.career.seasonEarnings - a.career.seasonEarnings);
  if (rows.length === 0) return <p className="empty">No money won yet this season.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Player</th><th className="num">Events</th><th className="num">Wins</th><th className="num">Earnings</th></tr></thead>
        <tbody>
          {rows.map((wp, i) => (
            <tr key={wp.player.id} className={world.clientIds.includes(wp.player.id) ? "me" : ""}>
              <td>{i + 1}</td>
              <td><PlayerName id={wp.player.id}>{wp.player.name}</PlayerName></td>
              <td className="num">{wp.career.seasonEvents}</td>
              <td className="num">{wp.career.seasonWins || ""}</td>
              <td className="num">{money(wp.career.seasonEarnings)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DevTable({ world }: { world: World }) {
  const list = devPointsList(world);
  if (list.length === 0) return <p className="empty">No developmental tour points yet this season.</p>;
  const finals = world.schedule.filter((e) => e.devFinals).sort((a, b) => a.week - b.week);
  const promoted = Object.values(world.players).filter((wp) => wp.career.promotedSeason === world.season);
  return (
    <div className="table-wrap">
      <p className="secondary" style={{ marginTop: 0 }}>
        The top {DEV_GRADUATES} after the Finals earn main-tour cards; {DEV_GRADUATES + 1}–{DEV_EXEMPT_THROUGH} keep full status here next season. {DEV_PROMOTION_WINS} wins in a season earn a card on the spot.
        {finals.length > 0 && <> The Finals (weeks {finals[0]!.week}–{finals[finals.length - 1]!.week}) pay {DEV_FINALS_POINTS} points to the winner; the last two are for the top {finals[2]?.fieldSize ?? 100} and top {finals[3]?.fieldSize ?? 60}.</>}
        {" "}Everyone else can try Q-School.
      </p>
      {promoted.length > 0 && <p className="good-text small">Promoted this season: {promoted.map((wp, i) => <Fragment key={wp.player.id}>{i ? ", " : ""}<PlayerName id={wp.player.id}>{wp.player.name}</PlayerName></Fragment>)}.</p>}
      <table>
        <thead><tr><th>#</th><th>Player</th><th className="num">Age</th><th className="num">Wins</th><th className="num">Points</th><th className="num">Earnings</th></tr></thead>
        <tbody>
          {list.map((id, i) => {
            const wp = world.players[id]!;
            return (
              <Fragment key={id}>
                {i === DEV_GRADUATES && <tr className="divider"><td colSpan={6}>Card line: the top {DEV_GRADUATES} move up</td></tr>}
                {i === DEV_EXEMPT_THROUGH && <tr className="divider"><td colSpan={6}>Full status line: {DEV_GRADUATES + 1}–{DEV_EXEMPT_THROUGH} keep their place here</td></tr>}
                <tr className={world.clientIds.includes(id) ? "me" : ""}>
                  <td>{i + 1}</td>
                  <td>
                    <PlayerName id={id}>{wp.player.name}</PlayerName> <Nation nationality={wp.player.nationality} />
                    {wp.career.promotedSeason === world.season && <span className="badge" style={{ marginLeft: 6 }}>Promoted</span>}
                    {(wp.career.devExemptThrough ?? 0) >= world.season && <span className="muted small"> · exempt</span>}
                  </td>
                  <td className="num">{wp.career.seasonDevWins || ""}</td>
                  <td className="num">{Math.round(wp.career.devPoints)}</td>
                  <td className="num">{money(wp.career.seasonEarnings)}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AmateurTable({ world }: { world: World }) {
  const list = amateurRanking(world);
  return (
    <div className="table-wrap">
      <p className="secondary" style={{ marginTop: 0 }}>
        College and amateur golf. The season's No. 1 is invited to the next season's majors. Amateurs turn pro by {PRO_AGE}; scout them early.
      </p>
      <table>
        <thead><tr><th>#</th><th>Player</th><th className="num">Age</th><th>From</th><th>School</th><th>Represented</th></tr></thead>
        <tbody>
          {list.map((id, i) => {
            const wp = world.players[id]!;
            return (
              <tr key={id} className={world.clientIds.includes(id) ? "me" : ""}>
                <td>{i + 1}</td>
                <td><PlayerName id={id}>{wp.player.name}</PlayerName></td>
                <td className="num">{wp.player.age}</td>
                <td><Nation nationality={wp.player.nationality} /></td>
                <td className="small">{schoolLabel(world, wp) ?? ""}</td>
                <td className="small">{wp.client ? "Your client" : "Free"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
