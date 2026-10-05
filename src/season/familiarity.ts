/**
 * The season's side of course familiarity: kept per player and course,
 * built up after every event, fading a little for courses he stays away from.
 */
import { FAMILIARITY_FADE, createRng, familiarityAfter, hasTrait, traceSeed } from "../engine";
import type { EventRecord, TourEvent, World, WorldPlayer } from "./types";

/** His familiarity with a course (0 if he has never played it). */
export const familiarityWith = (wp: WorldPlayer, courseId: string): number => wp.career.familiarity?.[courseId] ?? 0;

/** Whether he has ever played the course. */
export const hasPlayed = (wp: WorldPlayer, courseId: string): boolean => wp.career.familiarity?.[courseId] !== undefined;

/** After an event: every round he played there, and how well he finished, add to it. */
export function recordFamiliarity(wp: WorldPlayer, courseId: string, rounds: number, position: number, madeCut: boolean, pace = 1): void {
  const fam = (wp.career.familiarity ??= {});
  const before = fam[courseId] ?? 0;
  const after = familiarityAfter(before, rounds, position, madeCut, hasTrait(wp.player, "course-horse"));
  // An analyst who knows the courses (course fit) speeds the learning up.
  fam[courseId] = after > before ? before + (after - before) * pace : after;
}

/** Season end: courses he didn't play this season fade a little. */
export function fadeFamiliarity(world: World): void {
  const courseOf = new Map(world.schedule.map((e) => [e.id, e.courseId]));
  for (const wp of Object.values(world.players)) {
    const fam = wp.career.familiarity;
    if (!fam) continue;
    const played = new Set(wp.career.results.filter((r) => r.season === world.season).map((r) => courseOf.get(r.eventId)));
    for (const id of Object.keys(fam)) if (!played.has(id)) fam[id] = Math.max(0, Math.round((fam[id]! - FAMILIARITY_FADE) * 10) / 10);
  }
}

/**
 * The years a player has already spent on tour before the game starts: a
 * veteran has seen most of these courses. Each tour course he has probably
 * visited about half his seasons, a better player finishing higher.
 */
function seedFromCareer(world: World, wp: WorldPlayer): void {
  const status = wp.career.status;
  if (status === "amateur") return;
  const years = Math.max(0, Math.min(18, wp.player.age - 22)) * (status === "none" ? 0.3 : 1);
  if (years < 1) return;
  const fam = (wp.career.familiarity ??= {});
  const courses = new Set(world.schedule.filter((e) => e.tier !== "dev").map((e) => e.courseId));
  const good = wp.career.careerTop10s / Math.max(1, wp.career.careerEvents);
  for (const course of courses) {
    const rng = createRng(traceSeed(wp.player.id, course, "familiarity"));
    for (let y = 0; y < years; y++) {
      if (rng.next() > 0.5) continue;
      const cut = rng.next() < 0.55 + good;
      const pos = rng.next() < good ? 1 + Math.floor(rng.next() * 10) : 40;
      fam[course] = familiarityAfter(fam[course] ?? 0, cut ? 4 : 2, pos, cut, hasTrait(wp.player, "course-horse"));
    }
  }
}

/**
 * Players without familiarity yet (a new world, or a save from before it
 * existed) start with what their years on tour and recorded results earned
 * (rounds are estimated: four for a made cut, two for a missed one).
 */
export function ensureFamiliarity(world: World): void {
  const courseOf = new Map(world.schedule.map((e) => [e.id, e.courseId]));
  for (const wp of Object.values(world.players)) {
    if (wp.career.familiarity) continue;
    wp.career.familiarity = {};
    seedFromCareer(world, wp);
    const byTime = [...wp.career.results].sort((a: EventRecord, b: EventRecord) => a.season - b.season || a.week - b.week);
    for (const r of byTime) {
      const course = courseOf.get(r.eventId);
      if (course) recordFamiliarity(wp, course, r.madeCut ? 4 : 2, r.position, r.madeCut);
    }
  }
}

/** Familiarity fields for a player's event context. */
export function familiarityContext(wp: WorldPlayer, event: TourEvent): { familiarity: number; debut: boolean } {
  return { familiarity: familiarityWith(wp, event.courseId), debut: !hasPlayed(wp, event.courseId) };
}

/**
 * Leaderboard tags for a course: "Course expert" (familiarity 70+) and
 * "Debut" (his first event there, and nothing much known before it).
 */
export function familiarityTags(world: World, courseId: string, playerIds: string[]): Record<string, string> {
  const courseOf = new Map(world.schedule.map((e) => [e.id, e.courseId]));
  const out: Record<string, string> = {};
  for (const id of playerIds) {
    const wp = world.players[id];
    if (!wp) continue;
    const f = familiarityWith(wp, courseId);
    if (f >= 70) out[id] = "Course expert";
    else if (f < 25 && wp.career.results.filter((r) => courseOf.get(r.eventId) === courseId).length <= 1) out[id] = "Debut";
  }
  return out;
}

/** His best-known courses, most familiar first. */
export function familiarCourses(wp: WorldPlayer): { courseId: string; familiarity: number }[] {
  return Object.entries(wp.career.familiarity ?? {})
    .map(([courseId, familiarity]) => ({ courseId, familiarity }))
    .sort((a, b) => b.familiarity - a.familiarity);
}
