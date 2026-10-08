/**
 * Practice: a practice round at the week's event (a boost to his familiarity
 * with the course that counts straight away), or a practice trip to any
 * course, which takes his week instead of an event and costs travel and fees.
 */
import { clamp, familiarityAfter, hasTrait } from "../engine";
import { familiarityWith } from "./familiarity";
import type { Region, World, WorldPlayer } from "./types";

export const PRACTICE_ROUND_FEE = 2_500;
export const PRACTICE_ROUND_FATIGUE = 3;
export const PRACTICE_TRIP_FEE = 4_000;
/** A trip week recovers this much less than a week off. */
export const PRACTICE_TRIP_FATIGUE = 10;
const TRAVEL: Record<Region, number> = { NA: 5_000, EU: 9_000, ASIA: 10_000, AUS: 10_000 };

/** His familiarity after a practice round there (worth two tournament rounds). */
export function afterPracticeRound(wp: WorldPlayer, courseId: string): number {
  return familiarityAfter(familiarityWith(wp, courseId), 3, 99, false, hasTrait(wp.player, "course-horse"));
}

/** His familiarity after a practice trip (a few days on the course: three rounds' worth). */
export function afterPracticeTrip(wp: WorldPlayer, courseId: string): number {
  return familiarityAfter(familiarityWith(wp, courseId), 3, 99, false, hasTrait(wp.player, "course-horse"));
}

/** Where a course is, from the schedule (tour courses outside it count as North America). */
export function courseRegion(world: World, courseId: string): Region {
  return world.schedule.find((e) => e.courseId === courseId)?.region ?? "NA";
}

/** What a practice trip to a course costs him. */
export const practiceTripCost = (world: World, courseId: string): number => TRAVEL[courseRegion(world, courseId)] + PRACTICE_TRIP_FEE;

/** A practice round before this week's event: familiarity up, a little tired, a fee. */
export function takePracticeRound(wp: WorldPlayer, courseId: string): void {
  (wp.career.familiarity ??= {})[courseId] = afterPracticeRound(wp, courseId);
  wp.player.condition = clamp(wp.player.condition - PRACTICE_ROUND_FATIGUE, 0, 100);
  if (wp.client) wp.client.finances.travel += PRACTICE_ROUND_FEE;
}

/** A week's practice trip (instead of a week's rest): familiarity up, less recovery, travel and fees. */
export function takePracticeTrip(world: World, wp: WorldPlayer, courseId: string): void {
  (wp.career.familiarity ??= {})[courseId] = afterPracticeTrip(wp, courseId);
  wp.player.condition = clamp(wp.player.condition - PRACTICE_TRIP_FATIGUE, 0, 100);
  if (wp.client) wp.client.finances.travel += practiceTripCost(world, courseId);
}

/** Tour courses a client can take a practice trip to, the next ones on the schedule first. */
export function practiceCourses(world: World): { courseId: string; name: string; next: string | null }[] {
  const seen = new Map<string, { courseId: string; name: string; next: string | null }>();
  const upcoming = [...world.schedule].filter((e) => e.tier !== "dev").sort((a, b) => ((a.week - world.week + 100) % 100) - ((b.week - world.week + 100) % 100));
  for (const e of upcoming) {
    if (seen.has(e.courseId)) continue;
    const course = world.courses.find((c) => c.id === e.courseId);
    seen.set(e.courseId, { courseId: e.courseId, name: course?.name ?? e.courseId, next: e.week > world.week ? `${e.name}, week ${e.week}` : null });
  }
  return [...seen.values()];
}
