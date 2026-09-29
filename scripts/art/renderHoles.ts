// Renders one or more holes from a real course as illustrated SVG + Blender scene JSON.
// Examples:
//   npx tsx scripts/art/renderHoles.ts . waialae 1
//   npx tsx scripts/art/renderHoles.ts . waialae 1-18
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { holeArtSvg, holeScene, type HoleOutlines, type HoleSummary } from "../../src/ui/holeArt";

const REPO = process.cwd();
const ROOT = process.argv[2] ?? ".";
const COURSE = process.argv[3] ?? "waialae";
const RANGE = process.argv[4] ?? "1";

const parseRange = (value: string): number[] => {
  const m = value.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error(`Invalid hole range "${value}". Use e.g. 1 or 1-18.`);
  const a = Number(m[1]);
  const b = Number(m[2] ?? m[1]);
  if (a < 1 || b < a || b > 18) throw new Error(`Invalid hole range "${value}".`);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
};

const OUT = join(ROOT, COURSE);
const outlines = JSON.parse(readFileSync(join(REPO, "public", "holes", `${COURSE}.json`), "utf8")).holes as Record<string, HoleOutlines>;
const summary = JSON.parse(readFileSync(join(REPO, "src", "engine", "realHoles.json"), "utf8"))[COURSE] as Record<string, HoleSummary>;
const courses = JSON.parse(readFileSync(join(REPO, "src", "engine", "realCourses.json"), "utf8")) as { id: string; name: string; holes: number[][] }[];
const course = courses.find((c) => c.id === COURSE);
if (!course) throw new Error(`Unknown course "${COURSE}".`);
if (!summary) throw new Error(`No real-hole summary for "${COURSE}".`);

const order = course.holes.map((h, i) => ({ i, over: h[6]! - h[0]! })).sort((a, b) => b.over - a.over);
const index = new Map(order.map((x, rank) => [x.i, rank + 1]));

mkdirSync(OUT, { recursive: true });
for (const n of parseRange(RANGE)) {
  const h = course.holes[n - 1];
  if (!h) throw new Error(`Course "${COURSE}" has no hole ${n}.`);
  const input = {
    number: n,
    par: h[0]!,
    yards: h[1]!,
    fairwayWidth: h[2]!,
    tourAverage: h[6],
    difficulty: index.get(n - 1),
    courseName: course.name,
    outlines: outlines[String(n)],
    summary: summary[String(n)],
  };
  const meta = { number: n, par: h[0], yards: h[1], tourAverage: h[6], difficulty: index.get(n - 1), course: course.name };
  writeFileSync(join(OUT, `hole-${String(n).padStart(2, "0")}.json`), JSON.stringify({ meta, scene: holeScene(input) }));
  writeFileSync(join(OUT, `hole-${String(n).padStart(2, "0")}.svg`), holeArtSvg(input));
}
console.log(`wrote ${COURSE} hole(s) ${RANGE} to ${OUT}`);
