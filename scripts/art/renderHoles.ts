// Renders Augusta National's front nine as illustrated hole maps (SVG) for review.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { holeArtSvg, holeScene, type HoleOutlines, type HoleSummary } from "../../src/ui/holeArt";

const REPO = "C:/Users/suzry/golfrpg";
const OUT = join(process.argv[2] ?? ".", "augusta");
const COURSE = "augusta-national";

const outlines = JSON.parse(readFileSync(`${REPO}/public/holes/${COURSE}.json`, "utf8")).holes as Record<string, HoleOutlines>;
const summary = JSON.parse(readFileSync(`${REPO}/src/engine/realHoles.json`, "utf8"))[COURSE] as Record<string, HoleSummary>;
const course = (JSON.parse(readFileSync(`${REPO}/src/engine/realCourses.json`, "utf8")) as { id: string; name: string; holes: number[][] }[]).find((c) => c.id === COURSE)!;

// Stroke index: hardest to easiest by the real field's average against par.
const order = course.holes.map((h, i) => ({ i, over: h[6]! - h[0]! })).sort((a, b) => b.over - a.over);
const index = new Map(order.map((x, rank) => [x.i, rank + 1]));

mkdirSync(OUT, { recursive: true });
for (let n = 1; n <= 9; n++) {
  const h = course.holes[n - 1]!;
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
  const svg = holeArtSvg(input);
  writeFileSync(join(OUT, `hole-${String(n).padStart(2, "0")}.json`), JSON.stringify({ meta: { number: n, par: h[0], yards: h[1], tourAverage: h[6], difficulty: index.get(n - 1), course: course.name }, scene: holeScene(input) }));
  writeFileSync(join(OUT, `hole-${String(n).padStart(2, "0")}.svg`), svg);
}
console.log("wrote", OUT);
