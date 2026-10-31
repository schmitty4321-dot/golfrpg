import { useId } from "react";
import type { HoleTrace, Pt } from "../../engine";
import type { HoleMap } from "../holeMaps";
import { holeProjection, projectedFlight } from "../holeProjection";

/** Geometry-led diorama. No painted targets, lie snapping, or decorative hazards. */
export function ProjectedHole({ trace, step, map }: { trace: HoleTrace; step: number; map: HoleMap | null }) {
  const id = useId().replace(/:/g, "");
  const project = holeProjection(trace.layout);
  const points = (poly: number[][]) => poly.map(([x, y]) => { const p = project({ x: x!, y: y! }); return `${p.x},${p.y}`; }).join(" ");
  const line = (poly: Pt[]) => poly.map(p => { const q = project(p); return `${q.x},${q.y}`; }).join(" ");
  const pin = project(trace.layout.pin);
  const shots = trace.shots.slice(0, step);
  const shapes = (polys: number[][][], fill: string, stroke: string) => polys.map((poly, i) => <polygon key={i} points={points(poly)} fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />);
  return <figure className="projected-hole">
    <svg viewBox="0 0 1200 620" role="img" aria-label={`Illustrated 3D hole ${trace.layout.real?.hole}, par ${trace.layout.par}. ${shots.map(s => s.text).join(" ")}`}>
      <defs>
        <linearGradient id={`${id}grass`} x2="0" y2="1"><stop stopColor="#7bb85c"/><stop offset="1" stopColor="#326840"/></linearGradient>
        <pattern id={`${id}mow`} width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><rect width="30" height="30" fill="#82bd57"/><rect width="15" height="30" fill="#93c96a"/></pattern>
        <mask id={`${id}clip`} maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="620"><polyline points={line(trace.layout.path)} fill="none" stroke="white" strokeWidth="190" strokeLinecap="round" strokeLinejoin="round"/></mask>
      </defs>
      <polyline points={line(trace.layout.path)} transform="translate(0 18)" fill="none" stroke="#5c4930" strokeWidth="194" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={line(trace.layout.path)} fill="none" stroke={`url(#${id}grass)`} strokeWidth="190" strokeLinecap="round" strokeLinejoin="round"/>
      {map ? <g mask={`url(#${id}clip)`}>
        {shapes(map.rough, "#437b41", "#437b41")}
        {shapes(map.wood, "#28583b", "#20472f")}
        {shapes(map.water, "#479eae", "#28697c")}
        {shapes(map.fairway, `url(#${id}mow)`, "#679c49")}
        {shapes(map.tee, "#b1d781", "#74994e")}
        {shapes(map.green, "#b5dc80", "#83b95c")}
        {shapes(map.bunker, "#f2dfb0", "#ba9d6c")}
        {map.path.map((poly, i) => <polyline key={i} points={points(poly)} stroke="#c1bc9b" strokeWidth="3" fill="none"/>)}
        {map.tree.map(([x,y], i) => { const p = project({ x: x!, y: y! }); return <g key={i}><ellipse cx={p.x+6} cy={p.y+4} rx="10" ry="5" fill="#163b2d" opacity=".3"/><path d={`M${p.x} ${p.y}v-16`} stroke="#735c3e" strokeWidth="3"/><ellipse cx={p.x} cy={p.y-17} rx="9" ry="12" fill="#285c3a"/><ellipse cx={p.x-3} cy={p.y-21} rx="5" ry="7" fill="#57874a"/></g>; })}
      </g> : <text x="80" y="60" fill="currentColor">Loading mapped course outlines…</text>}
      <ellipse cx={pin.x} cy={pin.y} rx="4" ry="2" fill="#183a2a"/>
      <path d={`M${pin.x} ${pin.y}v-30`} stroke="white" strokeWidth="2"/>
      <path d={`M${pin.x} ${pin.y-30}l18 5 -18 6Z`} fill="#d65539"/>
      {shots.map((shot,i) => {
        const a = project(shot.from), b = project(shot.to);
        const flight = Array.from({ length: 41 }, (_, j) => { const p = projectedFlight(shot, project, j/40); return `${j ? "L" : "M"}${p.x},${p.y}`; }).join(" ");
        return <g key={`${step}-${i}`}>
          <path d={`M${a.x},${a.y}L${b.x},${b.y}`} stroke="#173c2d" opacity=".4" strokeWidth="3" strokeDasharray="5 5"/>
          <path d={flight} fill="none" stroke={shot.kind === "penalty" ? "#e99073" : "#fff4bf"} strokeWidth="3" strokeDasharray={shot.kind === "penalty" ? "5 5" : undefined} pathLength="1" className={i === shots.length-1 ? "projected-flight" : undefined}/>
          <circle cx={b.x} cy={b.y} r="4" fill="white" stroke="#244c35"/>
        </g>;
      })}
      <text x="40" y="575" fill="#244c35" fontSize="18">Waialae · Hole 1</text>
      <text x="40" y="600" fill="#365a44" fontSize="14">Mapped outlines · illustrative height and lighting</text>
    </svg>
    <figcaption>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>. Flat terrain; flight height is illustrative.</figcaption>
  </figure>;
}
