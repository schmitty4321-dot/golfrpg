import type { StrokesGained } from "../../engine";
import { signed } from "../format";

const ROWS: { key: keyof StrokesGained; label: string }[] = [
  { key: "offTheTee", label: "Off the tee" },
  { key: "approach", label: "Approach" },
  { key: "aroundTheGreen", label: "Around the green" },
  { key: "putting", label: "Putting" },
];

/**
 * Strokes gained per round against the field, as bars either side of zero:
 * blue for gained, red for lost. Values are printed, so colour is never the
 * only cue.
 */
export function SgChart({ sg, rounds }: { sg: StrokesGained; rounds: number }) {
  const per = ROWS.map((r) => ({ ...r, value: sg[r.key] / Math.max(1, rounds) }));
  const total = per.reduce((s, r) => s + r.value, 0);
  const scale = Math.max(1, ...per.map((r) => Math.abs(r.value)), Math.abs(total) / 2);
  const bar = (v: number, label: string) => (
    <div className="sg-track" title={`${label}: ${signed(v, 2)} strokes per round vs the field`}>
      <span className={`sg-bar ${v >= 0 ? "pos" : "neg"}`} style={{ width: `${(Math.abs(v) / scale) * 50}%` }} />
    </div>
  );
  return (
    <div className="sg-chart" role="table" aria-label="Strokes gained per round against the field">
      {per.map((r) => (
        <div className="sg-row" role="row" key={r.key}>
          <span role="cell" className="secondary">{r.label}</span>
          {bar(r.value, r.label)}
          <span role="cell" className="num">{signed(r.value, 2)}</span>
        </div>
      ))}
      <div className="sg-row" role="row" style={{ fontWeight: 650 }}>
        <span role="cell">Total</span>
        {bar(total / 2, "Total (half scale)")}
        <span role="cell" className="num">{signed(total, 2)}</span>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Strokes per round against the field average. The total bar is drawn at half scale.</p>
    </div>
  );
}
