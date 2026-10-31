import type { HoleLayout, Pt, Shot } from "../engine";

/** Orthographic camera: world yards and flight height share one transform. */
export function holeProjection(layout: HoleLayout) {
  const { minX, maxX, minY, maxY } = layout.bounds;
  const raw = (p: Pt, height = 0): Pt => ({ x: p.y * 1.65 + p.x * 1.2, y: p.x * .62 - p.y * .55 - height * 1.5 });
  const corners = [raw({ x: minX, y: minY }), raw({ x: minX, y: maxY }), raw({ x: maxX, y: minY }), raw({ x: maxX, y: maxY })];
  const left = Math.min(...corners.map(p => p.x));
  const top = Math.min(...corners.map(p => p.y));
  const scale = Math.min(1040 / (Math.max(...corners.map(p => p.x)) - left), 410 / (Math.max(...corners.map(p => p.y)) - top));
  return (p: Pt, height = 0): Pt => {
    const q = raw(p, height);
    return { x: 80 + (q.x - left) * scale, y: 110 + (q.y - top) * scale };
  };
}

export function projectedFlight(shot: Shot, project: ReturnType<typeof holeProjection>, t: number): Pt {
  const height = shot.kind === "putt" || shot.kind === "penalty" ? 0 : Math.min(38, shot.yards * .14) * 4 * t * (1 - t);
  return project({ x: shot.from.x + (shot.to.x - shot.from.x) * t, y: shot.from.y + (shot.to.y - shot.from.y) * t }, height);
}
