import { projectAlong, sideOf, type HoleLayout, type HoleTrace, type Lie, type Pt, type Shot } from "../engine";
import generatedArt from "./illustratedArt.generated.json";

export interface ArtMatrix {
  x: [number, number, number];
  y: [number, number, number];
}

export interface ArtEntry {
  image: string;
  width: number;
  height: number;
  matrix: ArtMatrix;
  /** The visible playing line through the illustration, keyed by fraction of hole yardage. */
  route?: (Pt & { at: number })[];
  /**
   * A coarse terrain map of the painting (scripts/art/lieMask.py), run-length
   * encoded over cells: f mown grass, s sand, w water, r everything else.
   * The replay puts each ball on the terrain its lie says it found.
   */
  mask?: { cell: number; cols: number; rows: number; rle: string };
  /** Pixel-space landing points for hazards that the illustration depicts differently from the source map. */
  targets?: Partial<Record<Extract<Lie, "water" | "ob" | "bunker" | "green" | "holed">, Pt[]>>;
  meta?: {
    number?: number;
    par?: number;
    yards?: number;
    tourAverage?: number;
    difficulty?: number;
    course?: string;
    /** The hole's name, when the course names its holes. */
    name?: string;
    /** The artwork carries its own title and hole card, so the replay doesn't add another. */
    framed?: boolean;
  };
}

export interface IllustratedShotPath {
  shot: Shot;
  start: Pt;
  end: Pt;
}

export interface CalibrationAnchor {
  world: Pt;
  pixel: Pt;
}

export const ILLUSTRATED_ART = generatedArt as unknown as Record<string, ArtEntry>;

export function illustratedArtFor(courseId: string, hole: number): ArtEntry | undefined {
  return ILLUSTRATED_ART[`${courseId}:${hole}`];
}

export function artForTrace(trace: HoleTrace): ArtEntry | undefined {
  const real = trace.layout.real;
  return real ? illustratedArtFor(real.courseId, real.hole) : undefined;
}

export function projectArtPoint(matrix: ArtMatrix, point: Pt): Pt {
  const [xx, xy, xo] = matrix.x;
  const [yx, yy, yo] = matrix.y;
  return { x: xx * point.x + xy * point.y + xo, y: yx * point.x + yy * point.y + yo };
}

function pointOnRoute(route: NonNullable<ArtEntry["route"]>, progress: number): Pt {
  const p = Math.max(0, Math.min(1, progress));
  const after = route.findIndex((point) => point.at >= p);
  if (after <= 0) return route[0]!;
  if (after < 0) return route[route.length - 1]!;
  const a = route[after - 1]!;
  const b = route[after]!;
  const t = (p - a.at) / Math.max(0.0001, b.at - a.at);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** How far off the centre line a point is, in yards (+ right, - left, looking down the hole). */
function lateralYards(path: Pt[], p: Pt): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)));
    best = Math.min(best, Math.hypot(p.x - (a.x + (b.x - a.x) * t), p.y - (a.y + (b.y - a.y) * t)));
  }
  return best === Infinity ? 0 : best * sideOf(path, p);
}

/** How many pixels of the painted route a yard of the hole covers. */
function pixelsPerYard(art: ArtEntry, layout: HoleLayout): number {
  const route = art.route ?? [];
  let length = 0;
  for (let i = 1; i < route.length; i++) length += Math.hypot(route[i]!.x - route[i - 1]!.x, route[i]!.y - route[i - 1]!.y);
  return length / Math.max(1, layout.yards);
}

/**
 * A ball on the green, placed by how far it finished from the flag (a chip to
 * two feet sits by the flag, a long lag well short of it), on the side it
 * came in from, and on the putting surface the painting shows.
 */
function onGreen(art: ArtEntry, flag: Pt, shot: Shot, layout: HoleLayout, from: Pt): Pt {
  const yards = Math.hypot(shot.to.x - layout.pin.x, shot.to.y - layout.pin.y);
  const px = Math.min(70, yards * pixelsPerYard(art, layout));
  const dx = from.x - flag.x;
  const dy = from.y - flag.y;
  const t = terrainOf(art);
  const at = (scale: number, turn: number): Pt => {
    const a = Math.atan2(dy, dx) + (turn * Math.PI) / 180;
    return { x: flag.x + Math.cos(a) * px * scale, y: flag.y + Math.sin(a) * px * scale };
  };
  if (!t) return at(1, 0);
  // On the putting surface, well clear of its edge and the bunkers: the same distance first,
  // swinging round the flag, and only then closer to it.
  const onSurface = (p: Pt) => {
    const cx = Math.floor(p.x / t.cell);
    const cy = Math.floor(p.y / t.cell);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (t.kind[y * t.cols + x] !== 1) return false;
    return true;
  };
  for (const scale of [1, 0.8, 0.6, 0.4, 0.25]) {
    for (const turn of [0, 25, -25, 50, -50, 80, -80, 120, -120, 180]) {
      const p = at(scale, turn);
      if (onSurface(p)) return p;
    }
  }
  return at(0.15, 0);
}

function projectShotPoint(art: ArtEntry, point: Pt, layout?: HoleLayout): Pt {
  if (!art.route?.length || !layout) return projectArtPoint(art.matrix, point);
  const progress = projectAlong(layout.path, point) / layout.yards;
  const on = pointOnRoute(art.route, progress);
  // Off the centre line: the same miss, scaled to the painting, square to the line of play.
  const a = pointOnRoute(art.route, Math.max(0, progress - 0.02));
  const b = pointOnRoute(art.route, Math.min(1, progress + 0.02));
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return on;
  const perYard = pixelsPerYard(art, layout);
  // The paintings look down the hole at an angle, so a sideways yard covers less of the picture than a yard
  // along the line, and a big miss sideways shouldn't drag the ball back toward the tee.
  const off = Math.max(-45, Math.min(45, lateralYards(layout.path, point) * perYard * 0.5));
  // Screen y runs down, so the right-hand side of the line of play is (-dy, dx).
  return { x: on.x + (-(b.y - a.y) / len) * off, y: on.y + ((b.x - a.x) / len) * off };
}

// ---------------------------------------------------------------- terrain

interface Terrain {
  cell: number;
  cols: number;
  rows: number;
  /** 0 other, 1 mown grass, 2 sand, 3 water. */
  kind: Uint8Array;
  /** Cells to the nearest mown grass (capped). */
  toGrass: Uint8Array;
}

const terrains = new WeakMap<ArtEntry, Terrain | null>();
const KIND: Record<string, number> = { r: 0, f: 1, s: 2, w: 3 };

function terrainOf(art: ArtEntry): Terrain | null {
  if (terrains.has(art)) return terrains.get(art)!;
  const m = art.mask;
  let t: Terrain | null = null;
  if (m) {
    const kind = new Uint8Array(m.cols * m.rows);
    let i = 0;
    for (const [, l, n] of m.rle.matchAll(/([fswr])(\d+)/g)) {
      kind.fill(KIND[l!]!, i, i + Number(n));
      i += Number(n);
    }
    // Specks of blue (a shadow, a flower) aren't a lake: water needs a dozen cells together.
    const seen = new Uint8Array(kind.length);
    for (let j = 0; j < kind.length; j++) {
      if (kind[j] !== 3 || seen[j]) continue;
      const patch = [j];
      seen[j] = 1;
      for (let q = 0; q < patch.length; q++) {
        const c = patch[q]!;
        const x = c % m.cols;
        for (const n of [c - m.cols, c + m.cols, x > 0 ? c - 1 : -1, x < m.cols - 1 ? c + 1 : -1]) {
          if (n >= 0 && n < kind.length && kind[n] === 3 && !seen[n]) {
            seen[n] = 1;
            patch.push(n);
          }
        }
      }
      if (patch.length < 12) for (const c of patch) kind[c] = 0;
    }
    // Distance to mown grass, breadth first from every grass cell.
    const toGrass = new Uint8Array(kind.length).fill(255);
    const queue: number[] = [];
    kind.forEach((k, j) => {
      if (k === 1) {
        toGrass[j] = 0;
        queue.push(j);
      }
    });
    for (let q = 0; q < queue.length; q++) {
      const j = queue[q]!;
      const d = toGrass[j]!;
      if (d >= 20) continue;
      const x = j % m.cols;
      for (const n of [j - m.cols, j + m.cols, x > 0 ? j - 1 : -1, x < m.cols - 1 ? j + 1 : -1]) {
        if (n >= 0 && n < kind.length && toGrass[n]! > d + 1) {
          toGrass[n] = d + 1;
          queue.push(n);
        }
      }
    }
    t = { cell: m.cell, cols: m.cols, rows: m.rows, kind, toGrass };
  }
  terrains.set(art, t);
  return t;
}

/** Whether a cell suits a lie: the fairway on mown grass, the rough just off it, a bunker on sand beside the grass, and so on. */
function suits(t: Terrain, j: number, lie: Lie): boolean {
  const k = t.kind[j]!;
  const g = t.toGrass[j]!;
  // A ball in the rough or the trees never sits on the edge of a lake.
  const wet = () => [j - t.cols, j + t.cols, j - 1, j + 1].some((n) => t.kind[n] === 3 || t.kind[n] === 2);
  // Well inside a patch of its own kind (all eight neighbours match), so the ball isn't on an edge.
  const deep = () => {
    for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) if (t.kind[j + dy * t.cols + dx] !== k) return false;
    return true;
  };
  switch (lie) {
    case "fairway":
      return k === 1 && deep();
    case "rough":
      return k === 0 && g >= 1 && g <= 2 && !wet();
    case "trees":
      return k === 0 && g >= 3 && g <= 7 && !wet();
    case "ob":
      return k === 0 && g >= 6 && g <= 14;
    case "bunker":
      // In the sand, not on its lip: most of the neighbouring cells are sand too.
      return k === 2 && g <= 4 && deep();
    case "water":
      return k === 3 && deep();
    default:
      return false;
  }
}

const KIND_OF: Partial<Record<Lie, number>> = { fairway: 1, bunker: 2, water: 3 };
const TERRAIN_LIES = new Set<Lie>(["fairway", "rough", "trees", "ob", "bunker", "water"]);
/** How far (in cells) a ball is moved to find its terrain before the replay gives up and leaves it be (water anywhere in the picture will do). */
const SEARCH = 32;
const WATER_SEARCH = 90;

/** The nearest point to `from` on the terrain a lie needs, or null when there's none close by. */
export function placeOnTerrain(art: ArtEntry, from: Pt, lie: Lie): Pt | null {
  const found = searchTerrain(art, from, lie);
  // Nothing deep enough nearby: the edge of the right terrain will do before giving up.
  if (!found && (lie === "bunker" || lie === "fairway" || lie === "water")) return searchTerrain(art, from, lie, true);
  return found;
}

function searchTerrain(art: ArtEntry, from: Pt, lie: Lie, anySand = false): Pt | null {
  const t = terrainOf(art);
  if (!t || !TERRAIN_LIES.has(lie)) return null;
  const cx = Math.floor(from.x / t.cell);
  const cy = Math.floor(from.y / t.cell);
  let best: { j: number; d: number } | null = null;
  const limit = lie === "water" ? WATER_SEARCH : SEARCH;
  for (let r = 0; r <= limit; r++) {
    if (best && best.d <= r) break;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= t.cols || y >= t.rows) continue;
        const j = y * t.cols + x;
        // The looser pass still wants sand that borders the grass (a beach or a desert wash isn't a bunker).
        if (!(anySand ? t.kind[j] === KIND_OF[lie] && (lie !== "bunker" || t.toGrass[j]! <= 2) : suits(t, j, lie))) continue;
        const d = Math.hypot(dx, dy);
        if (!best || d < best.d) best = { j, d };
      }
    }
  }
  if (!best) return null;
  return { x: (best.j % t.cols) * t.cell + t.cell / 2, y: Math.floor(best.j / t.cols) * t.cell + t.cell / 2 };
}

function nearest(points: Pt[], target: Pt): Pt {
  return points.reduce((best, point) =>
    Math.hypot(point.x - target.x, point.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y) ? point : best);
}

/**
 * Builds a continuous replay path. Hazard landings can snap to calibrated
 * artwork targets, while the following penalty/drop stroke begins at that
 * same visible point so the picture matches the written play-by-play.
 */
export function illustratedShotPaths(art: ArtEntry, shots: Shot[], layout?: HoleLayout): IllustratedShotPath[] {
  let previousEnd: Pt | undefined;
  return shots.map((shot) => {
    const start = previousEnd ?? projectShotPoint(art, shot.from, layout);
    const projectedEnd = projectShotPoint(art, shot.to, layout);
    const targetLie = shot.lie === "holed" && !art.targets?.holed && art.targets?.green ? "green" : shot.lie;
    const targets = shot.kind === "penalty" ? undefined : art.targets?.[targetLie as "water" | "ob" | "bunker" | "green" | "holed"];
    // Hand-placed greens, holes and out of bounds come first; otherwise the ball goes on the terrain
    // the painting shows for its lie (the nearest patch), then any hand-placed spot, then where it fell.
    const handFirst = targetLie === "green" || targetLie === "holed" || targetLie === "ob";
    // A penalty drop goes on the dry ground its lie names, never back into the hazard.
    const onTerrain = handFirst && targets?.length ? null : placeOnTerrain(art, projectedEnd, shot.lie);
    // Water or out of bounds the painting doesn't show: off into the trees rather than onto the fairway.
    const offCourse = !onTerrain && !targets?.length && shot.kind !== "penalty" && (shot.lie === "water" || shot.lie === "ob") ? placeOnTerrain(art, projectedEnd, "trees") : null;
    // On the green with a painted flag: by the distance left to the hole.
    const flag = art.targets?.holed?.[0];
    const green = layout && flag && shot.kind !== "penalty" && shot.lie === "green" ? onGreen(art, flag, shot, layout, start) : null;
    // A hand-placed spot only stands in when it's near where the ball went: a fairway bunker the
    // painting doesn't show goes to the edge of the fairway, not to a greenside bunker 250 yards on.
    const handNear = targets?.filter((p) => handFirst || Math.hypot(p.x - projectedEnd.x, p.y - projectedEnd.y) < 260) ?? [];
    const edge = !onTerrain && !handNear.length && shot.lie === "bunker" ? placeOnTerrain(art, projectedEnd, "rough") : null;
    const end = green ?? onTerrain ?? offCourse ?? edge ?? (handNear.length ? nearest(handNear, projectedEnd) : projectedEnd);
    previousEnd = end;
    return { shot, start, end };
  });
}

function solve(values: [number, number, number], anchors: CalibrationAnchor[]): [number, number, number] {
  const rows = anchors.map((anchor, index) => [anchor.world.x, anchor.world.y, 1, values[index]!]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(rows[row]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!];
    const pivotRow = rows[column]!;
    const divisor = pivotRow[column]!;
    if (Math.abs(divisor) < 1e-9) throw new Error("Calibration points are collinear");
    for (let item = column; item < 4; item++) pivotRow[item] = pivotRow[item]! / divisor;
    for (let row = 0; row < 3; row++) {
      if (row === column) continue;
      const target = rows[row]!;
      const factor = target[column]!;
      for (let item = column; item < 4; item++) target[item] = target[item]! - factor * pivotRow[item]!;
    }
  }
  return rows.map((row) => Number(row[3]!.toFixed(6))) as [number, number, number];
}

export function solveArtMatrix(anchors: CalibrationAnchor[]): ArtMatrix {
  if (anchors.length !== 3) throw new Error("Exactly three calibration anchors are required");
  return {
    x: solve(anchors.map((anchor) => anchor.pixel.x) as [number, number, number], anchors),
    y: solve(anchors.map((anchor) => anchor.pixel.y) as [number, number, number], anchors),
  };
}

export function pointInsideArt(art: Pick<ArtEntry, "width" | "height" | "matrix">, point: Pt, margin = 0): boolean {
  const pixel = projectArtPoint(art.matrix, point);
  return pixel.x >= margin && pixel.x <= art.width - margin && pixel.y >= margin && pixel.y <= art.height - margin;
}
