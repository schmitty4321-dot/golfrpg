/**
 * Simulates one tournament and prints the leaderboard, the winner's card and
 * a strokes-gained breakdown.   npm run demo -- [seed] [courseId]
 */
import { COURSES, coursePar, createRng, generateTourField, getCourse, simulateTournament } from "../src/engine";

const seed = Number(process.argv[2] ?? Date.now() % 100000);
const course = process.argv[3] ? getCourse(process.argv[3]) : COURSES[seed % COURSES.length]!;
const field = generateTourField(createRng(seed + 1), 156);
const t = simulateTournament({ name: `${course.name} Championship`, course, field, purse: 9_000_000, seed, cutTop: 65 });

const toPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const sg = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1);

console.log(`\n${t.name} — ${course.name} (${course.style}, par ${coursePar(course)})  seed ${seed}`);
t.weather.forEach((w, i) =>
  console.log(`  R${i + 1}: wind AM ${w.windMph.AM.toFixed(0)} mph / PM ${w.windMph.PM.toFixed(0)} mph${w.rain ? ", rain" : ""}`),
);
console.log(`  Cut: ${t.cutLine === null ? "none" : toPar(t.cutLine)}${t.playoff ? `   Playoff: ${t.playoff.holesPlayed} hole(s)` : ""}\n`);

console.log("Pos   Player                             To par  Rounds            Earnings      SG: OTT  APP  ARG  PUTT");
for (const r of t.leaderboard.slice(0, 15)) {
  console.log(
    `${r.positionLabel.padEnd(5)} ${`${r.player.name} (${r.player.nationality})`.padEnd(34)} ${toPar(r.toPar).padStart(6)}  ${r.rounds.join("-").padEnd(16)}  ${money(r.earnings).padStart(11)}   ` +
      `${sg(r.sg.offTheTee).padStart(5)}${sg(r.sg.approach).padStart(5)}${sg(r.sg.aroundTheGreen).padStart(5)}${sg(r.sg.putting).padStart(6)}`,
  );
}

const w = t.leaderboard[0]!;
console.log(`\nWinner's final round: ${w.player.name}`);
console.log("Hole  " + course.holes.map((h) => String(h.number).padStart(3)).join(""));
console.log("Par   " + course.holes.map((h) => String(h.par).padStart(3)).join(""));
console.log("Score " + w.holes[3]!.map((s) => String(s).padStart(3)).join(""));
