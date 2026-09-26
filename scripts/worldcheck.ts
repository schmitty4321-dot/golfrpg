/**
 * Plays many seasons and prints how the tour's strength and age move, to
 * check that development and ageing keep the world stable.
 *   npm run worldcheck -- [seasons]
 */
import { SEASON_WEEKS, createWorld, finishSeason, overall, playWeek } from "../src/season";

const seasons = Number(process.argv[2] ?? 12);
const w = createWorld({ seed: 5, scenario: "rookie" });
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
console.log("Season  Exempt avg  Top-10 avg  Mean age  Oldest  Injured/wk");
for (let s = 0; s < seasons; s++) {
  const ps = Object.values(w.players);
  const exempt = ps.filter((p) => p.career.status === "exempt").map((p) => overall(p.player));
  const top = ps.map((p) => overall(p.player)).sort((a, b) => b - a).slice(0, 10);
  const ages = ps.map((p) => p.player.age);
  let injured = 0;
  while (w.week <= SEASON_WEEKS) {
    playWeek(w);
    injured += Object.values(w.players).filter((p) => p.injury).length;
  }
  console.log(
    `${String(w.season).padEnd(8)}${avg(exempt).padEnd(12)}${avg(top).padEnd(12)}${avg(ages).padEnd(10)}${String(Math.max(...ages)).padEnd(8)}${(injured / SEASON_WEEKS).toFixed(1)}`,
  );
  finishSeason(w);
}
