/**
 * The realism report: plays a world forward and compares it with real golf
 * (mostly Data Golf). Career and rookie-outcome lines need 12+ seasons.
 *   npm run realism -- [seasons] [seed]
 */
import { createWorld } from "../src/season";
import { compareToAnchors, measureRealism } from "../src/season/realism";

const seasons = Number(process.argv[2] ?? 15);
const seed = Number(process.argv[3] ?? 5);
const started = Date.now();
const world = createWorld({ seed, scenario: "rookie" });
const metrics = measureRealism(world, seasons);
const rows = compareToAnchors(metrics);

const fmt = (v: number | null, unit: string) => (v === null ? "  (needs a longer run)" : `${v >= 0 && unit !== "%" && unit !== "strokes" ? "+" : ""}${v.toFixed(unit === "%" ? 0 : 2)}${unit === "%" ? "%" : ""}`);
console.log(`Realism report: seed ${seed}, ${seasons} seasons (${Math.round((Date.now() - started) / 1000)}s)\n`);
console.log(`${"".padEnd(2)}${"Measure".padEnd(52)}${"Sim".padStart(12)}${"Real".padStart(10)}  Unit`);
for (const r of rows) {
  const mark = r.close === null ? "··" : r.close ? "ok" : "!!";
  console.log(`${mark} ${r.label.padEnd(51)}${fmt(r.sim, r.unit).padStart(12)}${fmt(r.real, r.unit).padStart(10)}  ${r.unit}`);
}
console.log("\nNo firm real anchor yet:");
for (const [k, v] of Object.entries(metrics.info)) console.log(`   ${k.padEnd(50)}${v.toFixed(2).padStart(12)}`);
const off = rows.filter((r) => r.close === false);
console.log(`\n${rows.filter((r) => r.close).length} close, ${off.length} off, ${rows.filter((r) => r.close === null).length} not measured.`);
console.log("\nSources:");
for (const s of [...new Set(rows.map((r) => r.source))]) console.log(`   - ${s}`);
