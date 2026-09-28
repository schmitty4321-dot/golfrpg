import type { Course, TournamentResult } from "../engine";

/**
 * Course setup: as the tour gets stronger, tours lengthen courses, grow the
 * rough and tuck the pins. Each winter the game compares the season's scoring
 * on the real courses with the real field averages there and moves every
 * course's setup by the difference, so the courses keep playing to their real
 * averages however good the players become. It applies to everyone in the
 * field alike, so nobody's standing against the field changes.
 */

/** The setup lives on the world; the rest of these only need these two fields. */
interface SetupState {
  courseSetup?: number;
  setupTally?: { strokes: number; rounds: number };
}

/** Largest change in one winter, strokes per round: a guard against a freak season. */
const MAX_STEP = 0.5;

/** The course as it plays this season: the setup is spread evenly over its holes. */
export function asSetUp(world: SetupState, course: Course): Course {
  const setup = world.courseSetup ?? 0;
  return setup ? { ...course, setup } : course;
}

/** A course with a real field average on every hole, so its scoring can be compared with the real thing. */
const realAverage = (course: Course): number | null =>
  course.holes.every((h) => h.tourAverage !== undefined) ? course.holes.reduce((s, h) => s + h.tourAverage!, 0) : null;

/** Adds an event's rounds to the season's tally against the real averages (main-tour events on real courses). */
export function tallyRealScoring(world: SetupState, course: Course, result: TournamentResult): void {
  const real = realAverage(course);
  if (real === null) return;
  const tally = (world.setupTally ??= { strokes: 0, rounds: 0 });
  for (const e of result.leaderboard) {
    for (const strokes of e.rounds) {
      tally.strokes += strokes - real;
      tally.rounds++;
    }
  }
}

/** How far the season played from the real averages, strokes per round (negative: easier than real). */
export function seasonVsReal(world: SetupState): number | null {
  const t = world.setupTally;
  return t && t.rounds > 0 ? t.strokes / t.rounds : null;
}

/**
 * The winter's change: move the setup by however far this season played from
 * the real averages, then start a new tally. Returns the setup before and after.
 */
export function nextCourseSetup(world: SetupState): { from: number; to: number } {
  const from = world.courseSetup ?? 0;
  const vs = seasonVsReal(world);
  const step = vs === null ? 0 : Math.max(-MAX_STEP, Math.min(MAX_STEP, -vs));
  const to = Math.round((from + step) * 100) / 100;
  world.courseSetup = to;
  world.setupTally = { strokes: 0, rounds: 0 };
  return { from, to };
}

/** The season review's line about the change, or null when it's too small to mention. */
export function setupNews(change: { from: number; to: number }): string | null {
  const d = change.to - change.from;
  if (Math.abs(d) < 0.05) return null;
  const shots = Math.abs(d).toFixed(1);
  return d > 0
    ? `Courses will be set up ${shots} shots a round tougher next season, to keep pace with a stronger tour.`
    : `Courses will be set up ${shots} shots a round easier next season, as the tour's standard has dipped.`;
}
