// Re-spaces each hole's painted route so that every yard covers the same number of pixels.
// The route's `at` values (0 at the tee, 1 at the green) are recomputed from the pixel length of the
// painted points. Calibration (calibrateIllustration.ts) rebuilds the matrix and meta but drops the route,
// so run this after calibrating a course.
//   node scripts/art/respaceRoutes.mjs <course>
import { readFileSync, writeFileSync } from "node:fs";

const course = process.argv[2];
if (!course) throw new Error("Usage: node scripts/art/respaceRoutes.mjs <course>");
const registryPath = "src/ui/illustratedArt.generated.json";
const registry = JSON.parse(readFileSync(registryPath, "utf8"));

let holes = 0;
for (const [key, entry] of Object.entries(registry)) {
  if (!key.startsWith(`${course}:`) || !entry.route || entry.route.length < 3) continue;
  const route = entry.route;
  const along = [0];
  for (let i = 1; i < route.length; i++) {
    along.push(along[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y));
  }
  const total = along[along.length - 1];
  route.forEach((point, i) => {
    point.at = Number((along[i] / total).toFixed(4));
  });
  holes++;
}
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`re-spaced ${holes} holes for ${course}`);
