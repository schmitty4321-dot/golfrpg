/**
 * Shot sim for the practice swing: each club, shape and flight, 50 tee shots on Waialae's 18 holes,
 * a third with perfect timing, a third late, a third early. Prints carry, sideways miss and lies.
 *   npx tsx scripts/audit/shotSim.ts
 */
import { writeFileSync } from "node:fs";
import { REAL_COURSES } from "../../src/engine/realCourses";
import { createRng } from "../../src/engine/rng";
import { generatePlayer } from "../../src/engine/players";
import { clubCarry, playPracticeShot, startPracticeHole, type PracticeShot } from "../../src/engine/practiceHole";
import { sweetSpotMs, type SwingClub, type SwingShot } from "../../src/engine/swing";

const course = REAL_COURSES.find((c) => c.id === "waialae")!;
const player = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });
const SHAPES: { label: string; shape: number }[] = [{ label: "Straight", shape: 0 }, { label: "Draw", shape: -1 }, { label: "Fade", shape: 1 }];
// The engine has no separate high flight: high is modelled as a normal shot. Low is a punch, flop a wedge flop.
const FLIGHTS: { label: string; shot: SwingShot; clubs: SwingClub[] }[] = [
  { label: "Normal", shot: "normal", clubs: ["driver", "iron", "wedge"] },
  { label: "Low (punch)", shot: "punch", clubs: ["driver", "iron", "wedge"] },
  { label: "High flop", shot: "flop", clubs: ["wedge"] },
];
const CLUBS: SwingClub[] = ["driver", "iron", "wedge"];
const FACTOR: Record<SwingShot, number> = { normal: 1, punch: 0.8, flop: 0.5, splash: 0.32 };
const TIMING = ["perfect", "late", "early"] as const;

const rows: string[] = [];
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
rows.push("| Club | Shape | Flight | Timing | Shots | Avg carry (yd) | Avg miss (yd, + right) | Fairway | Rough | Bunker | Water | Avg quality |");
rows.push("|---|---|---|---|---|---|---|---|---|---|---|---|");

for (const club of CLUBS) for (const sh of SHAPES) for (const fl of FLIGHTS) {
  if (!fl.clubs.includes(club)) continue;
  for (const tm of TIMING) {
    const carries: number[] = [], misses: number[] = [], quals: number[] = [];
    const lies = { fairway: 0, rough: 0, bunker: 0, water: 0 };
    for (let i = 0; i < 50 / 3; i++) {
      // Spread the sample over the 18 holes; each hole's pin round varies with i.
      const hole = course.holes[(i * 3 + TIMING.indexOf(tm)) % course.holes.length]!;
      const start = startPracticeHole(course, hole, i % 4);
      const pin = start.layout.pin, tee = start.ball;
      const toPin = Math.hypot(pin.x - tee.x, pin.y - tee.y);
      const fwd = { x: (pin.x - tee.x) / toPin, y: (pin.y - tee.y) / toPin };
      const right = { x: fwd.y, y: -fwd.x };
      const window = sweetSpotMs(player, club, "fairway", { shot: fl.shot, shape: sh.shape, strength: 0.5 });
      const timingMs = tm === "perfect" ? 0 : tm === "late" ? window * 1.5 : -window * 1.5;
      // Perfect power: the power that carries the ball to the pin with this club, flight and lie factor.
      const power = Math.min(110, (toPin / (clubCarry(player, club) * FACTOR[fl.shot])) * 100);
      const shot: PracticeShot = { club, power, timingMs, aim: 0, shot: fl.shot, shape: sh.shape, strength: 0.5 };
      const after = playPracticeShot(start, player, shot);
      const st = after.strokes[0]!;
      carries.push(st.yards);
      misses.push((st.to.x - tee.x) * right.x + (st.to.y - tee.y) * right.y);
      quals.push(st.quality);
      if (st.lieAfter === "water") lies.water++;
      else if (st.lieAfter === "bunker") lies.bunker++;
      else if (st.lieAfter === "rough") lies.rough++;
      else lies.fairway++;
    }
    const n = 50 / 3;
    rows.push(`| ${club} | ${sh.label} | ${fl.label} | ${tm} | ${n.toFixed(0)} | ${avg(carries).toFixed(0)} | ${avg(misses).toFixed(1)} | ${lies.fairway} | ${lies.rough} | ${lies.bunker} | ${lies.water} | ${avg(quals).toFixed(2)} |`);
  }
}
const out = `# Shot sim: club, shape and flight on Waialae\n\n50 tee shots per combination spread over the 18 holes (about 17 per timing group: perfect, late by 1.5 × sweet spot, early by 1.5 × sweet spot). Power is the perfect power for the hole distance.\n\n${rows.join("\n")}\n`;
writeFileSync("audit-reports/practice-shot-sim.md", out);
console.log(out);
