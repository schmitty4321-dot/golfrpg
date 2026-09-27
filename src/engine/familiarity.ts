/**
 * Course familiarity: 0-100 per course, earned by playing it and playing it
 * well. On the course it is local knowledge (better reads and approaches, knowing
 * where to miss, having seen the pins) measured against the field that week, so
 * a field of veterans still plays a course to its real scoring average.
 */

export const FAMILIARITY_LEVELS: [number, string][] = [
  [90, "Owns the place"],
  [70, "Course expert"],
  [40, "Comfortable"],
  [15, "Knows it"],
  [0, "Unfamiliar"],
];

export function familiarityLabel(v: number): string {
  return FAMILIARITY_LEVELS.find(([min]) => v >= min)![1];
}

/**
 * Familiarity after an event: 3 a round played, plus the best of 6 for a top
 * 10, 12 for a top 5 or 20 for a win. Gains shrink as he nears 100; a Course
 * Horse learns twice as fast.
 */
export function familiarityAfter(current: number, rounds: number, position: number, madeCut: boolean, fast = false): number {
  const finish = !madeCut ? 0 : position === 1 ? 20 : position <= 5 ? 12 : position <= 10 ? 6 : 0;
  const gain = (3 * rounds + finish) * (1 - current / 150) * (fast ? 2 : 1);
  return Math.min(100, Math.round((current + gain) * 10) / 10);
}

/** Familiarity lost for each season he stays away from a course. */
export const FAMILIARITY_FADE = 3;

export interface FamiliarityInfo {
  /** His familiarity with this course. */
  familiarity: number;
  /** The field's average this week. */
  fieldFamiliarity: number;
  /** He has never played it. */
  debut: boolean;
}

/** A round's local knowledge, as strokes gained (positive helps) and strokes (positive hurts). */
export function familiarityRound(f: FamiliarityInfo | undefined, round: number): { approach: number; putting: number; strokes: number } {
  if (!f) return { approach: 0, putting: 0, strokes: 0 };
  const rel = (f.familiarity - f.fieldFamiliarity) / 100;
  // Up to a quarter of a stroke at 100 against a field of strangers: mostly on the greens.
  return { approach: 0.1 * rel, putting: 0.15 * rel, strokes: f.debut && round === 1 ? 0.15 : 0 };
}

/**
 * Hole-level local knowledge: he knows where to miss (fewer big numbers on
 * holes with trouble), and has seen these pins before (a tucked pin costs him
 * less). `pin` is the day's pin effect before familiarity.
 */
export function familiarityHole(f: FamiliarityInfo | undefined, hazard: number, pin: { mean: number; blowup: number }): { mean: number; blowup: number } {
  if (!f) return pin;
  const rel = (f.familiarity - f.fieldFamiliarity) / 100;
  const seen = 1 - 0.5 * (f.familiarity / 100);
  const mean = pin.mean > 0 ? pin.mean * seen : pin.mean;
  let blowup = pin.blowup > 1 ? 1 + (pin.blowup - 1) * seen : pin.blowup;
  if (hazard >= 0.3) blowup *= Math.max(0.6, 1 - 0.25 * rel);
  return { mean, blowup };
}
