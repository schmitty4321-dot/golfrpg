/**
 * Balance check for archetypes and traits: for every regular season (40+
 * main-tour rounds), a player's strokes gained per round against what his
 * overall rating predicts (a line fitted on everyone). A group that beats
 * its rating is strong for its rating; one that falls short is weak. Traits
 * are judged net of the player's archetype, which they often travel with.
 *   npx tsx scripts/balance.ts [seasons] [seeds]
 */
import { ARCHETYPES, TRAIT_BY_ID, traitsOf } from "../src/engine";
import { createWorld, finishSeason, overall, playWeek, seasonWeeks } from "../src/season";

const seasons = Number(process.argv[2] ?? 5);
const seeds = (process.argv[3] ?? "5,42").split(",").map(Number);

interface Row {
  sg: number;
  lv: number;
  arch: string;
  traits: readonly string[];
  wins: number;
  events: number;
  resid: number;
  net: number;
}

const rows: Row[] = [];
for (const seed of seeds) {
  const w = createWorld({ seed, scenario: "rookie" });
  for (let s = 0; s < seasons; s++) {
    const level = new Map(Object.values(w.players).map((p) => [p.player.id, overall(p.player)]));
    while (w.week <= seasonWeeks(w)) playWeek(w);
    for (const wp of Object.values(w.players)) {
      const st = wp.career.stats;
      if (!st || st.season !== w.season || st.rounds < 40) continue;
      const sg = (st.sg.offTheTee + st.sg.approach + st.sg.aroundTheGreen + st.sg.putting) / st.rounds;
      const lv = (level.get(wp.player.id)! + overall(wp.player)) / 2;
      rows.push({ sg, lv, arch: wp.player.archetype ?? "none", traits: traitsOf(wp.player), wins: st.wins, events: st.events, resid: 0, net: 0 });
    }
    finishSeason(w);
  }
}

// What the rating predicts: strokes gained against the field = a + b x level.
const mx = rows.reduce((t, r) => t + r.lv, 0) / rows.length;
const my = rows.reduce((t, r) => t + r.sg, 0) / rows.length;
const b = rows.reduce((t, r) => t + (r.lv - mx) * (r.sg - my), 0) / rows.reduce((t, r) => t + (r.lv - mx) ** 2, 0);
for (const r of rows) r.resid = r.sg - (my + b * (r.lv - mx));
const group = <K>(key: (r: Row) => K[]) => {
  const m = new Map<K, Row[]>();
  for (const r of rows) for (const k of key(r)) (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  return m;
};
const byArch = group((r) => [r.arch]);
const archMean = new Map([...byArch].map(([a, rs]) => [a, rs.reduce((t, r) => t + r.resid, 0) / rs.length]));
for (const r of rows) r.net = r.resid - (archMean.get(r.arch) ?? 0);
const byTrait = group((r) => [...r.traits]);

const summary = (rs: Row[], field: "resid" | "net") => {
  const n = rs.length;
  const m = rs.reduce((t, r) => t + r[field], 0) / n;
  const sd = Math.sqrt(rs.reduce((t, r) => t + (r[field] - m) ** 2, 0) / Math.max(1, n - 1));
  const events = rs.reduce((t, r) => t + r.events, 0);
  return { n, m, se: sd / Math.sqrt(n), winRate: events ? (100 * rs.reduce((t, r) => t + r.wins, 0)) / events : 0 };
};
const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);
const flag = (s: { m: number; se: number }) => (Math.abs(s.m) > 2 * s.se && Math.abs(s.m) >= 0.1 ? (s.m > 0 ? "  STRONG" : "  WEAK") : "");

console.log(`Balance: ${seeds.length} worlds x ${seasons} seasons, ${rows.length} player-seasons. Fitted ${b.toFixed(2)} strokes a round per point of rating.`);
console.log("Strokes a round against what the rating predicts (± two standard errors).\n");
console.log("ARCHETYPES");
for (const [id, rs] of [...byArch].sort((x, y) => summary(y[1], "resid").m - summary(x[1], "resid").m)) {
  const s = summary(rs, "resid");
  console.log(`  ${(ARCHETYPES[id as keyof typeof ARCHETYPES]?.name ?? id).padEnd(20)} n=${String(s.n).padStart(4)}  ${fmt(s.m)} ±${(2 * s.se).toFixed(2)}  wins/100 starts ${s.winRate.toFixed(1)}${flag(s)}`);
}
console.log("\nTRAITS (n >= 25), net of archetype");
for (const [id, rs] of [...byTrait].filter(([, r]) => r.length >= 25).sort((x, y) => summary(y[1], "net").m - summary(x[1], "net").m)) {
  const s = summary(rs, "net");
  console.log(`  ${(TRAIT_BY_ID.get(id)?.name ?? id).padEnd(26)} n=${String(s.n).padStart(4)}  ${fmt(s.m)} ±${(2 * s.se).toFixed(2)}${flag(s)}`);
}
