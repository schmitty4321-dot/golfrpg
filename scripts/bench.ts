/**
 * Speed check: builds a world, plays one season and prints the times plus a
 * fingerprint of the saved world. A speed-only change must leave the
 * fingerprint the same. Bundle it first so it runs like the game build:
 *   npx esbuild scripts/bench.ts --bundle --platform=node --format=esm --outfile=bench.mjs && node bench.mjs
 */
import { createHash } from "node:crypto";
import { createWorld, finishSeason, playWeek, seasonWeeks } from "../src/season";
import { serializeWorld } from "../src/season/save";
const t0 = Date.now();
const w = createWorld({ seed: 5, scenario: "agency" });
const t1 = Date.now();
while (w.week <= seasonWeeks(w)) playWeek(w);
const t2 = Date.now();
finishSeason(w);
const t3 = Date.now();
console.log(`createWorld (incl. warm-up season) ${t1 - t0}ms, one season ${t2 - t1}ms, finishSeason ${t3 - t2}ms`);
console.log("fingerprint", createHash("sha1").update(serializeWorld(w)).digest("hex"));
const t4 = Date.now();
const json = serializeWorld(w);
const t5 = Date.now();
console.log(`serialize ${t5 - t4}ms, ${(json.length / 1e6).toFixed(2)} MB`);
