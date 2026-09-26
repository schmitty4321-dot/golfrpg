/**
 * Runs many tournaments on every course and prints the numbers that should
 * look like real tour golf. Change the engine, run this, compare with TARGET.
 *
 *   npm run calibrate            (200 events per course)
 *   npm run calibrate -- 1000
 */
import {
  COURSES,
  coursePar,
  createRng,
  expectedStrokesGained,
  generateTourField,
  simulateTournament,
  totalSg,
} from "../src/engine";

const EVENTS = Number(process.argv[2] ?? 200);

/** Rough PGA Tour reference values. */
const TARGET = {
  scoringAvgVsPar: "about +0.0 to +0.8 (harder links in wind: +2)",
  roundSd: "2.7-3.1 strokes (one player, round to round)",
  winningToPar: "-12 to -22 (links in wind: -5 to -12)",
  birdiesPerRound: "3.3-4.2",
  bogeysPerRound: "2.3-3.0",
  doublesPerRound: "0.25-0.45",
  bestPlayerWinPct: "10-25% (a dominant No. 1)",
  top10WinShare: "35-55% of events",
  outside50WinShare: "15-30% of events",
};

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const f = (x: number, d = 2) => x.toFixed(d);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

const rng = createRng(20260926);
const field = generateTourField(rng, 156);

for (const course of COURSES) {
  const par = coursePar(course);
  // Rank the field by expected quality on this course.
  const expected = new Map(field.map((p) => [p.id, totalSg(expectedStrokesGained(p, course))]));
  const rankOf = new Map([...field].sort((a, b) => expected.get(b.id)! - expected.get(a.id)!).map((p, i) => [p.id, i + 1]));
  const best = [...rankOf.entries()].find(([, r]) => r === 1)![0];

  const vsPar: number[] = [];
  const winning: number[] = [];
  const cutLines: number[] = [];
  const perPlayerRounds = new Map<string, number[]>();
  let birdies = 0, bogeys = 0, doubles = 0, eagles = 0, rounds = 0, playoffs = 0;
  let bestWins = 0, top10Wins = 0, outside50Wins = 0;

  for (let i = 0; i < EVENTS; i++) {
    const t = simulateTournament({ name: `Cal ${i}`, course, field, purse: 9_000_000, seed: i * 7919 + 1, cutTop: 65 });
    const w = t.leaderboard[0]!;
    winning.push(w.toPar);
    if (t.cutLine !== null) cutLines.push(t.cutLine);
    if (t.playoff) playoffs++;
    const r = rankOf.get(w.player.id)!;
    if (w.player.id === best) bestWins++;
    if (r <= 10) top10Wins++;
    if (r > 50) outside50Wins++;
    for (const res of t.leaderboard) {
      res.rounds.forEach((strokes, ri) => {
        vsPar.push(strokes - par);
        rounds++;
        for (let h = 0; h < 18; h++) {
          const d = res.holes[ri]![h]! - course.holes[h]!.par;
          if (d <= -2) eagles++;
          else if (d === -1) birdies++;
          else if (d === 1) bogeys++;
          else if (d >= 2) doubles++;
        }
        if (ri < 2) {
          const list = perPlayerRounds.get(res.player.id) ?? [];
          list.push(strokes);
          perPlayerRounds.set(res.player.id, list);
        }
      });
    }
  }

  const playerSds = [...perPlayerRounds.values()].filter((x) => x.length > 10).map(sd);
  console.log(`\n=== ${course.name} (${course.style}, par ${par}) — ${EVENTS} events ===`);
  const rows: [string, string, string][] = [
    ["Scoring avg vs par", f(mean(vsPar)), TARGET.scoringAvgVsPar],
    ["Round SD (per player)", f(mean(playerSds)), TARGET.roundSd],
    ["Winning score to par", `${f(mean(winning), 1)} (range ${Math.min(...winning)} to ${Math.max(...winning)})`, TARGET.winningToPar],
    ["Cut line to par", cutLines.length ? f(mean(cutLines), 1) : "n/a", "about 0 to -3"],
    ["Birdies / round", f(birdies / rounds), TARGET.birdiesPerRound],
    ["Bogeys / round", f(bogeys / rounds), TARGET.bogeysPerRound],
    ["Doubles+ / round", f(doubles / rounds), TARGET.doublesPerRound],
    ["Eagles+ / round", f(eagles / rounds, 3), "0.05-0.15"],
    ["Best player win %", pct(bestWins / EVENTS), TARGET.bestPlayerWinPct],
    ["Winner ranked top 10", pct(top10Wins / EVENTS), TARGET.top10WinShare],
    ["Winner ranked >50", pct(outside50Wins / EVENTS), TARGET.outside50WinShare],
    ["Playoffs", pct(playoffs / EVENTS), "~10-15%"],
  ];
  for (const [k, v, t] of rows) console.log(`${k.padEnd(24)} ${v.padEnd(28)} target ${t}`);
}
