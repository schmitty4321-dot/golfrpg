import { SG_LABELS, careerLines, rollingSg, tourPercentiles, type World, type WorldPlayer } from "../../season";
import { signed } from "../format";

/**
 * Data Golf-style charts for any player's Stats tab: where he ranks on tour
 * in each part of the game, a rolling strokes-gained line, and his career
 * season by season. Strokes gained are per round against the field; 0 is a
 * tour-average round.
 */

const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};

export function SgPercentiles({ world, id }: { world: World; id: string }) {
  const p = tourPercentiles(world, id);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Skill breakdown</h2>
        {p && <span className="muted small">Season {p.season} · vs {p.pool} tour players · per round</span>}
      </div>
      {!p ? (
        <p className="empty">Ranked once he has played a few main-tour events.</p>
      ) : (
        <div className="pct-rows">
          {p.rows.map((r) => (
            <div key={r.category} className={`pct-row${r.category === "total" ? " pct-total" : ""}`}>
              <span className="pct-label">{SG_LABELS[r.category]}</span>
              <span className="pct-track" role="img" aria-label={`${SG_LABELS[r.category]}: ${ordinal(Math.round(r.percentile))} percentile, ${r.rank} of ${p.pool}`}>
                <span className={`pct-fill ${r.percentile >= 50 ? "pct-good" : "pct-bad"}`} style={{ width: `${Math.max(2, r.percentile)}%` }} />
                <span className="pct-median" />
              </span>
              <span className="pct-value">{signed(r.perRound, 2)}</span>
              <span className="pct-rank muted small">{ordinal(Math.round(r.percentile))} pct · #{r.rank}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const W = 640;
const H = 220;
const PAD = { l: 36, r: 12, t: 12, b: 26 };

/** A y scale that always shows the tour-average line and a little room around the data. */
function yScale(values: number[], min = -3, max = 3) {
  const lo = Math.min(min, ...values.map((v) => Math.floor(v)));
  const hi = Math.max(max, ...values.map((v) => Math.ceil(v)));
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks: number[] = [];
  const step = hi - lo > 8 ? 2 : 1;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return { y, ticks };
}

const clampSg = (v: number) => Math.max(-8, Math.min(8, v));

export function RollingSgChart({ wp, window = 8 }: { wp: WorldPlayer; window?: number }) {
  const pts = rollingSg(wp, window);
  if (pts.length < 2) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>Rolling strokes gained</h2></div>
        <p className="empty">The line starts after his second event.</p>
      </section>
    );
  }
  const { y, ticks } = yScale(pts.flatMap((p) => [p.sg, p.rolling]).map(clampSg));
  const x = (i: number) => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rolling).toFixed(1)}`).join("");
  const seasonStarts = pts.map((p, i) => ({ p, i })).filter(({ p, i }) => i === 0 || pts[i - 1]!.season !== p.season);
  const last = pts[pts.length - 1]!;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Rolling strokes gained</h2>
        <span className="muted small">{window}-event average, per round · now {signed(last.rolling, 2)}</span>
      </div>
      <svg className="sg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rolling strokes gained over ${pts.length} events, now ${signed(last.rolling, 2)} per round`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? "chart-zero" : "chart-grid"} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{t > 0 ? `+${t}` : t}</text>
          </g>
        ))}
        {seasonStarts.map(({ p, i }) => (
          <g key={p.season}>
            {i > 0 && <line x1={x(i - 0.5)} x2={x(i - 0.5)} y1={PAD.t} y2={H - PAD.b} className="chart-season" />}
            <text x={x(i) + 2} y={H - 8} className="chart-axis">Season {p.season}</text>
          </g>
        ))}
        {pts.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(clampSg(p.sg))} r="3" className={p.dev ? "chart-dot chart-dot-dev" : "chart-dot"}>
            <title>{`${p.eventName} (season ${p.season}, week ${p.week}): ${signed(p.sg, 2)} per round`}</title>
          </circle>
        ))}
        <path d={line} className="chart-line" />
      </svg>
      <p className="muted small chart-note">Dots are single events (hollow: developmental tour); the line is his form. 0 is a tour-average round.</p>
    </section>
  );
}

export function CareerEvolution({ world, wp }: { world: World; wp: WorldPlayer }) {
  const lines = careerLines(world, wp);
  if (!lines.length) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>Career</h2></div>
        <p className="empty">His career line starts with his first season as a pro.</p>
      </section>
    );
  }
  const { y, ticks } = yScale(lines.map((l) => l.sgPerRound ?? 0), -2, 2);
  const slot = (W - PAD.l - PAD.r) / Math.max(lines.length, 6);
  const bar = Math.min(36, slot * 0.6);
  const cx = (i: number) => PAD.l + slot * (i + 0.5);
  const summary = lines.map((l) => `season ${l.season} ${l.sgPerRound === null ? "no main-tour rounds" : signed(l.sgPerRound, 2)}`).join(", ");
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Career</h2>
        <span className="muted small">Main-tour strokes gained per round, by season</span>
      </div>
      <svg className="sg-chart" viewBox={`0 0 ${W} ${H + 34}`} role="img" aria-label={`Career by season: ${summary}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? "chart-zero" : "chart-grid"} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{t > 0 ? `+${t}` : t}</text>
          </g>
        ))}
        {lines.map((l, i) => {
          const v = l.sgPerRound;
          return (
            <g key={l.season}>
              {v === null ? (
                <text x={cx(i)} y={y(0) - 4} textAnchor="middle" className="chart-axis">—</text>
              ) : (
                <rect x={cx(i) - bar / 2} y={Math.min(y(0), y(v))} width={bar} height={Math.max(1, Math.abs(y(v) - y(0)))} rx="2" className={`${v >= 0 ? "chart-bar-pos" : "chart-bar-neg"}${l.current ? " chart-bar-current" : ""}`}>
                  <title>{`Season ${l.season} (age ${l.age}${l.current ? ", in progress" : ""}): ${signed(v, 2)} per round over ${l.rounds} rounds`}</title>
                </rect>
              )}
              <text x={cx(i)} y={H - 8} textAnchor="middle" className="chart-axis">S{l.season}</text>
              <text x={cx(i)} y={H + 6} textAnchor="middle" className="chart-axis">age {l.age}</text>
              <text x={cx(i)} y={H + 20} textAnchor="middle" className="chart-axis chart-strong">
                {l.wins ? `${l.wins}W` : l.top10s ? `${l.top10s}×T10` : l.pointsRank ? `#${l.pointsRank}` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Season</th><th className="num">Age</th><th className="num">Level</th><th className="num">Events</th><th className="num">SG/rd</th><th className="num">Wins</th><th className="num">Top 10s</th><th className="num">Points</th></tr>
          </thead>
          <tbody>
            {[...lines].reverse().map((l) => (
              <tr key={l.season}>
                <td>{l.season}{l.current ? " (now)" : ""}</td>
                <td className="num">{l.age}</td>
                <td className="num">{l.overall.toFixed(1)}</td>
                <td className="num">{l.events}</td>
                <td className="num">{l.sgPerRound === null ? "—" : signed(l.sgPerRound, 2)}</td>
                <td className="num">{l.wins}{l.majors ? ` (${l.majors} major${l.majors > 1 ? "s" : ""})` : ""}</td>
                <td className="num">{l.top10s}</td>
                <td className="num">{l.pointsRank ? `#${l.pointsRank}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
