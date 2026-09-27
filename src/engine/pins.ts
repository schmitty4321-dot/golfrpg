/**
 * Pin positions: four per hole, one for each round, spread around the green.
 * How tucked a pin is (how close to the edge) changes how the hole plays, but
 * each hole's four pins average out, so a hole over a whole event still plays
 * to its calibrated average. Weekend pins tend to be the hard ones.
 */
import { createRng } from "./rng";
import { traceSeed } from "./tracer";
import type { Course, Hole } from "./types";

export interface PinSpot {
  /** Direction from the middle of the green, radians. */
  ang: number;
  /** Distance from the middle, as a share of the green's radius. */
  off: number;
  /** 0 (middle of the green) to 1 (tucked by the edge). */
  tuck: number;
}

const MIN_OFF = 0.25;
const MAX_OFF = 0.68;
const tuckOf = (off: number) => (off - MIN_OFF) / (MAX_OFF - MIN_OFF);

const cache = new Map<string, PinSpot[]>();

/** The four pins of a hole, by 0-based round. */
export function pinSpots(course: Course, hole: Hole): PinSpot[] {
  const key = `${course.id}/${hole.number}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = createRng(traceSeed(course.id, hole.number, "pins"));
  const start = rng.next() * Math.PI * 2;
  // A quarter-turn apart, in a random order, so no two rounds share a spot.
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  // How far from the middle each day: usually easiest on Thursday, hardest on Sunday.
  const offs = [0, 1, 2, 3].map(() => MIN_OFF + rng.next() * (MAX_OFF - MIN_OFF)).sort((a, b) => a - b);
  if (rng.next() < 0.65) {
    for (let i = 3; i > 0; i--) {
      const j = rng.int(0, i);
      [offs[i], offs[j]] = [offs[j]!, offs[i]!];
    }
  }
  const spots = [0, 1, 2, 3].map((r) => ({ ang: start + (order[r]! * Math.PI) / 2 + rng.normal(0, 0.25), off: offs[r]!, tuck: tuckOf(offs[r]!) }));
  cache.set(key, spots);
  return spots;
}

/** The pin for a 0-based round (a playoff uses Sunday's). */
export const pinSpot = (course: Course, hole: Hole, round: number): PinSpot => pinSpots(course, hole)[Math.max(0, Math.min(3, round))]!;

/** How tucked the pin is on this hole today, 0-1. */
export const pinTuck = (course: Course, hole: Hole, round: number): number => pinSpot(course, hole, round).tuck;

/** Words for how tucked a pin is. */
export function tuckWord(tuck: number): string {
  return tuck >= 0.7 ? "tucked" : tuck <= 0.3 ? "accessible" : "";
}

/**
 * What today's pin does to the hole: strokes added (tucked pins play harder,
 * accessible ones easier) and a multiplier on big numbers. Guarded greens feel
 * it more. Both average out over the hole's four pins.
 */
export function pinEffect(course: Course, hole: Hole, round: number): { mean: number; blowup: number } {
  const spots = pinSpots(course, hole);
  const avg = spots.reduce((s, p) => s + p.tuck, 0) / spots.length;
  const d = pinSpot(course, hole, round).tuck - avg;
  const guard = 0.5 + hole.hazard + hole.bunkers * 0.1;
  return { mean: 0.14 * d * guard, blowup: Math.max(0.5, 1 + 0.5 * d * guard) };
}
