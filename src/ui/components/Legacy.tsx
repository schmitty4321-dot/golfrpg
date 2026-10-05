import { alumni, eras, legacyScore, type World } from "../../season";
import { PlayerName } from "./PlayerLink";

const STATUS = { elsewhere: "Still playing", retired: "Retired", coaching: "Coaching (on your coach market)" } as const;

/** The agency's legacy: its score, its Hall of Fame, its eras and everyone who ever played for it. */
export function LegacyPanel({ world }: { world: World }) {
  const list = alumni(world);
  const hall = list.filter((a) => a.hallOfFame);
  const ages = eras(world);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Legacy</h2>
        <span className="small">Legacy score <strong>{legacyScore(world)}</strong></span>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Wins, majors, points titles, Ryder Cup places and Hall of Famers, past and present. Former clients who retire come back as coaches at a friend's rate, and now and then send you a prospect from home.
      </p>
      {hall.length > 0 && (
        <>
          <div className="mp-label">{world.agency.name} Hall of Fame</div>
          <div className="achievement-grid" style={{ margin: "6px 0 12px" }}>
            {hall.map((a) => (
              <div key={a.id} className="achievement unlocked">
                <div className="achievement-icon" aria-hidden>🏆</div>
                <div>
                  <strong><PlayerName id={a.id}>{a.name}</PlayerName></strong>
                  <div className="small">{a.wins} win{a.wins === 1 ? "" : "s"}{a.majors ? `, ${a.majors} major${a.majors === 1 ? "" : "s"}` : ""} with you</div>
                  <div className="small muted">Seasons {a.signed}-{a.left} · best world ranking #{a.bestRank}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {ages.length > 0 && (
        <>
          <div className="mp-label">Eras</div>
          <ul className="small" style={{ marginTop: 4 }}>
            {ages.map((e) => (
              <li key={e.from}>Seasons {e.from}-{e.to}: <strong>the {e.name.split(" ").at(-1)} years</strong> ({e.name}, {e.wins} win{e.wins === 1 ? "" : "s"})</li>
            ))}
          </ul>
        </>
      )}
      {list.length === 0 ? (
        <p className="empty" style={{ marginBottom: 0 }}>No former clients yet. Everyone who leaves your books is remembered here.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Former client</th><th className="num">Seasons</th><th className="num">Wins</th><th className="num">Majors</th><th className="num">Best rank</th><th>Now</th></tr></thead>
            <tbody>
              {[...list].reverse().map((a) => (
                <tr key={a.id}>
                  <td><PlayerName id={a.id}>{a.name}</PlayerName>{a.hallOfFame ? " 🏆" : ""}</td>
                  <td className="num">{a.signed}-{a.left}</td>
                  <td className="num">{a.wins}</td>
                  <td className="num">{a.majors}</td>
                  <td className="num">{a.bestRank < 999 ? `#${a.bestRank}` : "—"}</td>
                  <td className="small">{STATUS[a.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
