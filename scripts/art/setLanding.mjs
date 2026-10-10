// Moves a hole's landing point (route point 1) to a pixel position in its picture, then re-spaces the course's routes.
//   node scripts/art/setLanding.mjs <course> <hole> <x> <y>
import { readFileSync, writeFileSync } from "node:fs";

const [course, hole, xText, yText] = process.argv.slice(2);
const registryPath = "src/ui/illustratedArt.generated.json";
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const entry = registry[`${course}:${Number(hole)}`];
if (!entry?.route || entry.route.length < 3) throw new Error(`No route for ${course}:${hole}`);
entry.route[1].x = Number(xText);
entry.route[1].y = Number(yText);
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`set ${course}:${hole} landing to (${xText}, ${yText})`);
