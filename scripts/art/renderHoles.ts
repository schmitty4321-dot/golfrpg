// Renders one or more holes from a real course as illustrated SVG + Blender scene JSON.
// Examples:
//   npx tsx scripts/art/renderHoles.ts . waialae 1
//   npx tsx scripts/art/renderHoles.ts . waialae 1-18
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { holeArtSvg, holeScene, type HoleOutlines, type HoleSummary } from "../../src/ui/holeArt";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT = process.argv[2] ?? ".";
const COURSE = process.argv[3] ?? "waialae";
const RANGE = process.argv[4] ?? "1";

const parseRange = (value: string): number[] => {
  const match = value.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) throw new Error(`Invalid hole range "${value}". Use e.g. 1 or 1-18.`);
  const first = Number(match[1]);
  const last = Number(match[2] ?? match[1]);
  if (first < 1 || last < first || last > 18) throw new Error(`Invalid hole range "${value}".`);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
};

const OUT = join(ROOT, COURSE);
const outlines = JSON.parse(readFileSync(join(REPO, "public", "holes", `${COURSE}.json`), "utf8")).holes as Record<string, HoleOutlines>;
const summary = JSON.parse(readFileSync(join(REPO, "src", "engine", "realHoles.json"), "utf8"))[COURSE] as Record<string, HoleSummary>;
const courses = JSON.parse(readFileSync(join(REPO, "src", "engine", "realCourses.json"), "utf8")) as { id: string; name: string; holes: number[][] }[];
const course = courses.find((candidate) => candidate.id === COURSE);
if (!course) throw new Error(`Unknown course "${COURSE}".`);
if (!summary) throw new Error(`No real-hole summary for "${COURSE}".`);

// Stroke index: hardest to easiest by the real field's average against par.
const order = course.holes.map((hole, index) => ({ index, over: hole[6]! - hole[0]! })).sort((a, b) => b.over - a.over);
const strokeIndex = new Map(order.map((entry, rank) => [entry.index, rank + 1]));

mkdirSync(OUT, { recursive: true });
for (const number of parseRange(RANGE)) {
  const hole = course.holes[number - 1];
  if (!hole) throw new Error(`Course "${COURSE}" has no hole ${number}.`);
  if (!outlines[String(number)] || !summary[String(number)]) throw new Error(`Missing real geometry for ${COURSE} hole ${number}.`);

  const input = {
    number,
    par: hole[0]!,
    yards: hole[1]!,
    fairwayWidth: hole[2]!,
    tourAverage: hole[6],
    difficulty: strokeIndex.get(number - 1),
    courseName: course.name,
    outlines: outlines[String(number)],
    summary: summary[String(number)],
  };
  const meta = { number, par: hole[0], yards: hole[1], tourAverage: hole[6], difficulty: strokeIndex.get(number - 1), course: course.name };
  const scene = { ...holeScene(input), paths: outlines[String(number)]!.path };
  writeFileSync(join(OUT, `hole-${String(number).padStart(2, "0")}.json`), JSON.stringify({ meta, scene }));
  writeFileSync(join(OUT, `hole-${String(number).padStart(2, "0")}.svg`), holeArtSvg(input));
}
console.log(`wrote ${COURSE} hole(s) ${RANGE} to ${OUT}`);
