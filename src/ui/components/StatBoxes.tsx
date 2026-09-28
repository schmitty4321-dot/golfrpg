import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, type AttributeKey } from "../../engine";

export const GROUP_LABELS: Record<keyof typeof ATTRIBUTE_GROUPS, string> = {
  longGame: "Long game",
  approach: "Approach",
  shortGame: "Short game",
  putting: "Putting",
  mental: "Mental",
  physical: "Physical",
};

/** What is known about one attribute: exact, or a scouted range. */
export interface StatView {
  low: number;
  high: number;
  value: number;
  /** How far it could grow, when there is an estimate. */
  potential?: number;
  /** Change this season (clients only). */
  change?: number;
}

const pct = (v: number) => `${(Math.max(0, Math.min(20, v)) / 20) * 100}%`;
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export type Group = keyof typeof ATTRIBUTE_GROUPS;

/** Each group's average: current, and how far it could grow when that's known. Shared by the boxes and the radar. */
export function groupAverages(view: (k: AttributeKey) => StatView): { group: Group; current: number; potential?: number }[] {
  return (Object.keys(ATTRIBUTE_GROUPS) as Group[]).map((group) => {
    const vs = ATTRIBUTE_GROUPS[group].map((k) => view(k));
    const hasPot = vs.every((v) => v.potential !== undefined);
    return { group, current: avg(vs.map((v) => v.value)), ...(hasPot ? { potential: avg(vs.map((v) => v.potential!)) } : {}) };
  });
}

/**
 * Attributes as one box per group. Each bar is two colours: current skill,
 * and (behind it, lighter) how far he could grow.
 */
export function StatBoxes({ view }: { view: (k: AttributeKey) => StatView }) {
  return (
    <div className="stat-boxes">
      {groupAverages(view).map(({ group: g, current, potential }) => {
        const rows = ATTRIBUTE_GROUPS[g].map((k) => ({ k, v: view(k) }));
        return (
          <section className="stat-box" key={g}>
            <div className="stat-box-head">
              <h3>{GROUP_LABELS[g]}</h3>
              <span className="stat-box-avg">
                {current.toFixed(1)}
                {potential !== undefined && <span className="pot-text"> → {potential.toFixed(1)}</span>}
              </span>
            </div>
            <div className="stat-box-rows">
              {rows.map(({ k, v }) => {
                const exact = v.low === v.high;
                return (
                  <div className="stat-line" key={k}>
                    <span className="stat-line-name" title={ATTRIBUTE_LABELS[k]}>
                      {ATTRIBUTE_LABELS[k]}
                      {v.change ? <span className={`small ${v.change > 0 ? "good-text" : "bad-text"}`} title="Change this season"> {v.change > 0 ? "▲" : "▼"}</span> : null}
                    </span>
                    <span className="stat-line-val" title={exact ? undefined : `Somewhere between ${v.low} and ${v.high}`}>{exact ? v.value : `${v.low}-${v.high}`}</span>
                    <span className="stat-line-pot pot-text" title="How far he could grow">{v.potential !== undefined && v.potential > v.value ? v.potential : ""}</span>
                    <span className="stat-bar" aria-hidden>
                      {v.potential !== undefined && <span className="stat-bar-pot" style={{ width: pct(v.potential) }} />}
                      {!exact && <span className="stat-bar-range" style={{ width: pct(v.high) }} />}
                      <span className="stat-bar-cur" style={{ width: pct(exact ? v.value : v.low) }} />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** The legend for the two bar colours. */
export function StatLegend({ potential }: { potential: boolean }) {
  return (
    <span className="stat-legend small">
      <span><i className="sw sw-cur" /> Current</span>
      {potential && <span><i className="sw sw-pot" /> Potential</span>}
    </span>
  );
}
