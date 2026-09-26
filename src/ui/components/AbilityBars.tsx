import { Stars } from "./Stars";
import { ceilingStars } from "../../season";

const SCALE = 20;
const TOUR_AVERAGE = 12;

/**
 * Current ability and potential on the attribute scale (1-20). Potential is
 * his coaches' estimate, so it's shown as a lighter extension of the current bar.
 */
export function AbilityBars({ current, potential, note }: { current: number; potential: number; note?: string }) {
  const pc = (v: number) => `${(Math.min(SCALE, Math.max(0, v)) / SCALE) * 100}%`;
  const room = potential - current;
  return (
    <div className="ability">
      <div className="ability-row">
        <span className="ability-label">Current ability</span>
        <span className="ability-bar" role="img" aria-label={`Current ability ${current.toFixed(1)} of ${SCALE}`}>
          <span className="ability-now" style={{ width: pc(current) }} />
          <span className="ability-avg" style={{ left: pc(TOUR_AVERAGE) }} title="Tour average" />
        </span>
        <span className="ability-val">{current.toFixed(1)}</span>
        <Stars value={ceilingStars(current)} />
      </div>
      <div className="ability-row">
        <span className="ability-label">Potential</span>
        <span className="ability-bar" role="img" aria-label={`Potential about ${potential.toFixed(1)} of ${SCALE}`}>
          <span className="ability-pot" style={{ width: pc(potential) }} />
          <span className="ability-now" style={{ width: pc(current) }} />
          <span className="ability-avg" style={{ left: pc(TOUR_AVERAGE) }} title="Tour average" />
        </span>
        <span className="ability-val">~{potential.toFixed(1)}</span>
        <Stars value={ceilingStars(potential)} />
      </div>
      <p className="muted small" style={{ margin: "6px 0 0" }}>
        Overall level of his golf attributes, 1-20 (the tick is a tour average, 12).{" "}
        {room < 0.3 ? "He's at or near his ceiling." : `Room to grow: about ${room.toFixed(1)}.`} {note}
      </p>
    </div>
  );
}
