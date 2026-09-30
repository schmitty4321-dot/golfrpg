import type { HoleTrace, Lie, Pt, Shot } from "../engine";
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
  /** Pixel-space landing points for hazards that the illustration depicts differently from the source map. */
  targets?: Partial<Record<Extract<Lie, "water" | "ob" | "bunker" | "green" | "holed">, Pt[]>>;
  meta?: {
    number?: number;
    par?: number;
    yards?: number;
    tourAverage?: number;
    difficulty?: number;
    course?: string;
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

function nearest(points: Pt[], target: Pt): Pt {
  return points.reduce((best, point) =>
    Math.hypot(point.x - target.x, point.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y) ? point : best);
}

/**
 * Builds a continuous replay path. Hazard landings can snap to calibrated
 * artwork targets, while the following penalty/drop stroke begins at that
 * same visible point so the picture matches the written play-by-play.
 */
export function illustratedShotPaths(art: ArtEntry, shots: Shot[]): IllustratedShotPath[] {
  let previousEnd: Pt | undefined;
  return shots.map((shot) => {
    const start = previousEnd ?? projectArtPoint(art.matrix, shot.from);
    const projectedEnd = projectArtPoint(art.matrix, shot.to);
    const targetLie = shot.lie === "holed" && !art.targets?.holed && art.targets?.green ? "green" : shot.lie;
    const targets = shot.kind === "penalty" ? undefined : art.targets?.[targetLie as "water" | "ob" | "bunker" | "green" | "holed"];
    const end = targets?.length ? nearest(targets, projectedEnd) : projectedEnd;
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
