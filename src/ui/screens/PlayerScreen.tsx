import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS } from "../../engine";
import { STATUS_LABELS, type World } from "../../season";
import { formWord, money, signed, toPar } from "../format";

const GROUP_LABELS: Record<keyof typeof ATTRIBUTE_GROUPS, string> = {
  longGame: "Long game",
  approach: "Approach",
  shortGame: "Short game",
  putting: "Putting",
  mental: "Mental",
  physical: "Physical",
};

export function PlayerScreen({ world }: { world: World }) {
  const wp = world.players[world.clientId]!;
  const p = wp.player;
  const c = wp.career;
  const season = c.results.filter((r) => r.season === world.season);
  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1 style={{ fontSize: 22 }}>{p.name}</h1>
            <div className="secondary small">{p.age} · {p.nationality} · {STATUS_LABELS[c.status]}</div>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat"><span className="stat-label">Career wins</span><span className="stat-value">{c.careerWins}</span></div>
          <div className="stat"><span className="stat-label">Career earnings</span><span className="stat-value">{money(c.careerEarnings)}</span></div>
          <div className="stat"><span className="stat-label">Form</span><span className="stat-value">{formWord(p.form)}</span></div>
          <div className="stat"><span className="stat-label">Condition</span><span className="stat-value">{Math.round(p.condition)}%</span></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Attributes</h2>
          <span className="muted small">1-20 · 12 is a tour average · Injury proneness: lower is better</span>
        </div>
        <div className="attr-groups">
          {(Object.keys(ATTRIBUTE_GROUPS) as (keyof typeof ATTRIBUTE_GROUPS)[]).map((g) => (
            <div key={g}>
              <h3 style={{ marginBottom: 6 }}>{GROUP_LABELS[g]}</h3>
              {ATTRIBUTE_GROUPS[g].map((k) => (
                <div className="attr" key={k}>
                  <span>{ATTRIBUTE_LABELS[k]}</span>
                  <span className="attr-bar" aria-hidden><span style={{ width: `${(p.attributes[k] / 20) * 100}%` }} /></span>
                  <span className="attr-val">{p.attributes[k]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="muted small">Hidden traits (wind tolerance, grass preference, comfort on each style of course) show up only in results. Scouting comes later.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Season {world.season} results</h2></div>
        {season.length === 0 ? (
          <p className="empty">No starts yet this season.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Week</th><th>Event</th><th>Pos</th><th className="num">Score</th><th className="num">Earnings</th><th className="num">Points</th><th className="num">SG / round</th></tr></thead>
              <tbody>
                {season.map((r) => (
                  <tr key={r.eventId}>
                    <td>{r.week}</td>
                    <td>{r.eventName}{r.via === "monday" ? <span className="muted small"> · Monday qualifier</span> : null}</td>
                    <td>{r.label}</td>
                    <td className="num">{toPar(r.toPar)}</td>
                    <td className="num">{r.earnings ? money(r.earnings) : "–"}</td>
                    <td className="num">{Math.round(r.seasonPoints)}</td>
                    <td className={`num ${r.sgPerRound >= 0 ? "good-text" : "bad-text"}`}>{signed(r.sgPerRound, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
