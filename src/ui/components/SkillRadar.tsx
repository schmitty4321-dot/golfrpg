import type { AttributeKey } from "../../engine";
import { GROUP_LABELS, groupAverages, type StatView } from "./StatBoxes";

const SIZE = { w: 300, h: 290 };
const CX = 150;
const CY = 145;
/** Radius of a 20 rating; 0 sits at the centre. */
const R = 92;
const LABEL_R = R + 22;
const RINGS = [5, 10, 15, 20];
/** A tour-average professional, drawn as a dashed ring. */
const TOUR_AVERAGE = 12;

const angle = (i: number, n: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
const point = (i: number, n: number, rating: number): [number, number] => {
  const r = (Math.max(0, Math.min(20, rating)) / 20) * R;
  return [CX + r * Math.cos(angle(i, n)), CY + r * Math.sin(angle(i, n))];
};
const polygon = (values: number[]) => values.map((v, i) => point(i, values.length, v).map((x) => x.toFixed(1)).join(",")).join(" ");

/**
 * The six skill groups at a glance: his current shape in green and, when his
 * ceiling is known, the shape he could grow into in gold. The numbers are the
 * same group averages the skill boxes show.
 */
export function SkillRadar({ view }: { view: (k: AttributeKey) => StatView }) {
  const groups = groupAverages(view);
  const n = groups.length;
  const current = groups.map((g) => g.current);
  const potential = groups.every((g) => g.potential !== undefined) ? groups.map((g) => g.potential!) : null;
  const label = groups
    .map((g) => `${GROUP_LABELS[g.group]} ${g.current.toFixed(1)}${g.potential !== undefined ? `, could reach ${g.potential.toFixed(1)}` : ""}`)
    .join("; ");

  return (
    <svg className="skill-radar" viewBox={`0 0 ${SIZE.w} ${SIZE.h}`} role="img" aria-label={`Skill radar: ${label}`}>
      {RINGS.map((v) => (
        <polygon key={v} points={polygon(Array(n).fill(v))} className="radar-ring" />
      ))}
      <polygon points={polygon(Array(n).fill(TOUR_AVERAGE))} className="radar-ring radar-average" />
      {groups.map((_, i) => {
        const [x, y] = point(i, n, 20);
        return <line key={i} x1={CX} y1={CY} x2={x.toFixed(1)} y2={y.toFixed(1)} className="radar-ring" />;
      })}
      {potential && <polygon points={polygon(potential)} className="radar-pot" />}
      <polygon points={polygon(current)} className="radar-cur" />
      {current.map((v, i) => {
        const [x, y] = point(i, n, v);
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" className="radar-dot" />;
      })}
      {groups.map((g, i) => {
        const x = CX + LABEL_R * Math.cos(angle(i, n));
        const y = CY + LABEL_R * Math.sin(angle(i, n));
        return (
          <text key={g.group} x={x.toFixed(1)} y={(y - 3).toFixed(1)} textAnchor="middle" className="radar-label">
            {GROUP_LABELS[g.group]}
            <tspan x={x.toFixed(1)} dy="14" className="radar-value">
              {g.current.toFixed(1)}
              {g.potential !== undefined && <tspan className="radar-pot-text"> → {g.potential.toFixed(1)}</tspan>}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
