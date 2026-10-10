/**
 * Plays ten seasons and reports how amateur stars rise and fall, and how the
 * players who turned pro did on tour, grouped by the stars they had when they
 * turned pro.
 *   npx tsx scripts/audit/tenSeasons.ts [seed] [seasons]
 */
import { createWorld, finishSeason, playWeek, seasonWeeks, stars, type World } from "../../src/season";

const seed = Number(process.argv[2] ?? 5);
const seasons = Number(process.argv[3] ?? 10);
const world: World = createWorld({ seed, scenario: "rookie", style: "realistic" });

const amateurIds = () => Object.values(world.players).filter((wp) => wp.career.status === "amateur").map((wp) => wp.player.id);
let last = new Map<string, number>();
const rose = new Map<number, number>();
const fell = new Map<number, number>();
let moves = 0;

for (let s = 0; s < seasons; s++) {
  while (world.week <= seasonWeeks(world)) {
    playWeek(world);
    for (const id of amateurIds()) {
      const now = stars(world, id);
      const before = last.get(id);
      if (before !== undefined && now !== before) {
        moves++;
        if (now > before) rose.set(before, (rose.get(before) ?? 0) + 1);
        else fell.set(before, (fell.get(before) ?? 0) + 1);
      }
      last.set(id, now);
    }
  }
  finishSeason(world);
  last = new Map(amateurIds().map((id) => [id, stars(world, id)]));
}

console.log(`Seed ${seed}, ${seasons} seasons.\n`);

console.log("Amateur star changes, all seasons:");
console.log(`  total changes: ${moves}`);
for (const k of [5, 4, 3, 2, 1]) console.log(`  from ${k}★: up ${rose.get(k) ?? 0}, down ${fell.get(k) ?? 0}`);

const proPlayers = Object.values(world.players).filter((wp) => wp.career.proEntry);
console.log(`\nPlayers who turned pro in these seasons: ${proPlayers.length}\n`);
console.log("Stars when they turned pro | players | tour wins | tour money | avg money per player");
for (const k of [5, 4, 3, 2, 1]) {
  const group = proPlayers.filter((wp) => wp.career.proEntry!.stars === k);
  const wins = group.reduce((s, wp) => s + wp.career.careerWins, 0);
  const money = group.reduce((s, wp) => s + wp.career.careerEarnings, 0);
  const avg = group.length ? Math.round(money / group.length) : 0;
  console.log(`  ${k}★ | ${group.length} | ${wins} | $${money.toLocaleString("en-US")} | $${avg.toLocaleString("en-US")}`);
}

// Tour events (not developmental) played, per pro season, by star level at entry.
console.log("\nTour events per pro-season, by stars at entry:");
console.log("Stars | players | tour events | pro-seasons | events per pro-season | total events per player");
for (const k of [5, 4, 3, 2, 1]) {
  const group = proPlayers.filter((wp) => wp.career.proEntry!.stars === k);
  const events = group.reduce((s, wp) => s + wp.career.results.filter((r) => r.tier !== "dev").length, 0);
  const seasonsAsPro = group.reduce((s, wp) => s + Math.max(1, world.season - wp.career.proEntry!.season), 0);
  const perSeason = seasonsAsPro ? (events / seasonsAsPro).toFixed(1) : "-";
  const perPlayer = group.length ? (events / group.length).toFixed(1) : "-";
  console.log(`  ${k}★ | ${group.length} | ${events} | ${seasonsAsPro} | ${perSeason} | ${perPlayer}`);
}
