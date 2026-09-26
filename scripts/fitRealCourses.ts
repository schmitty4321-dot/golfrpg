/**
 * Tunes each real hole so a tour field plays it to its real scoring average:
 * simulates events on the course, compares each hole with the PGA TOUR's
 * average, and stores the difference as the hole's `adjust`. Rerun after any
 * change to the scoring model.
 *
 *   npx tsx scripts/fitRealCourses.ts        (40 events per course, 3 passes)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRng, generateTourField, REAL_COURSES, simulateTournament, type Course } from "../src/engine";

const FILE = new URL("../src/engine/realCourses.json", import.meta.url);
const EVENTS = Number(process.argv[2] ?? 40);
const PASSES = 3;

type RawHole = [number, number, number, number, number, number, number | null, number];
const raw = JSON.parse(readFileSync(FILE, "utf8")) as { id: string; holes: RawHole[] | null }[];

function simulatedAverages(course: Course): number[] {
  const sums = course.holes.map(() => 0);
  let rounds = 0;
  for (let e = 0; e < EVENTS; e++) {
    const field = generateTourField(createRng(1000 + e), 144);
    const t = simulateTournament({ name: `fit-${course.id}-${e}`, course, field, purse: 1, seed: 5000 + e });
    for (const row of t.leaderboard) {
      for (const round of row.holes) {
        round.forEach((s, i) => (sums[i]! += s));
        rounds++;
      }
    }
  }
  return sums.map((s) => s / rounds);
}

for (const rc of raw) {
  const holes = rc.holes;
  if (!holes || holes.every((h) => h[6] === null)) continue;
  for (let pass = 0; pass < PASSES; pass++) {
    const base = REAL_COURSES.find((c) => c.id === rc.id)!;
    const course: Course = { ...base, holes: base.holes.map((h, i) => ({ ...h, adjust: holes[i]![7] })) };
    const sim = simulatedAverages(course);
    holes.forEach((h, i) => {
      if (h[6] !== null) h[7] = Math.round((h[7] + (h[6] - sim[i]!)) * 1000) / 1000;
    });
    if (pass === PASSES - 1) {
      const real = holes.reduce((s, h) => s + (h[6] ?? 0), 0);
      console.log(`${rc.id.padEnd(28)} real ${real.toFixed(2)}  simulated ${sim.reduce((s, x) => s + x, 0).toFixed(2)}`);
    }
  }
}
writeFileSync(FILE, JSON.stringify(raw));
