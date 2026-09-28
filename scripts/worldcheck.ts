/**
 * Plays many seasons and prints how the tour's strength, age and pathways
 * move, to check that development, ageing and promotion keep the world stable.
 * Also prints the main tour's scoring, so drift that would upset the course
 * calibration shows up: average winning score, and the field's average to par
 * per round. Try a few seeds; one can look stable by luck.
 *   npm run worldcheck -- [seasons] [seed]
 */
import { createWorld, seasonWeeks, finishSeason, overall, playWeek } from "../src/season";

const seasons = Number(process.argv[2] ?? 12);
const seed = Number(process.argv[3] ?? 5);
const w = createWorld({ seed, scenario: "rookie" });
console.log(`Seed ${seed}`);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0).toFixed(2);
console.log("Season  Exempt  Top-10  Age    Pros  Amateurs  Dev field  Grads  Injured/wk  Win    Rd/par  ms");
for (let s = 0; s < seasons; s++) {
  const t = Date.now();
  const ps = Object.values(w.players);
  const pros = ps.filter((p) => p.career.status !== "amateur");
  const exempt = pros.filter((p) => p.career.status === "exempt").map((p) => overall(p.player));
  const top = pros.map((p) => overall(p.player)).sort((a, b) => b - a).slice(0, 10);
  let injured = 0;
  const devFields: number[] = [];
  const winning: number[] = [];
  let parStrokes = 0;
  let parRounds = 0;
  while (w.week <= seasonWeeks(w)) {
    const r = playWeek(w);
    for (const x of r.results) {
      if (x.event.tier === "dev") {
        devFields.push(x.field.field.length);
        continue;
      }
      const board = x.result.leaderboard;
      winning.push(board[0]!.toPar);
      for (const e of board) {
        parStrokes += e.toPar;
        parRounds += e.rounds.length;
      }
    }
    injured += Object.values(w.players).filter((p) => p.injury).length;
  }
  finishSeason(w);
  const rec = w.history.seasons.find((x) => x.season === w.season - 1)!;
  console.log(
    `${String(w.season - 1).padEnd(8)}${avg(exempt).padEnd(8)}${avg(top).padEnd(8)}${avg(pros.map((p) => p.player.age)).padEnd(7)}${String(pros.length).padEnd(6)}${String(ps.length - pros.length).padEnd(10)}${avg(devFields).padEnd(11)}${String(rec.graduates.length).padEnd(7)}${(injured / seasonWeeks(w)).toFixed(1).padEnd(12)}${avg(winning).padEnd(7)}${(parStrokes / Math.max(1, parRounds)).toFixed(2).padEnd(8)}${Date.now() - t}`,
  );
}
const r = w.history.records;
console.log("\nRecords:", Object.entries(r).map(([k, v]) => `${k}=${v ? `${v.value} (${v.name}, S${v.season})` : "-"}`).join("; "));
console.log("Hall of Fame:", w.history.hallOfFame.map((h) => `${h.name} ${h.wins}W/${h.majors}M`).join(", ") || "none yet");
