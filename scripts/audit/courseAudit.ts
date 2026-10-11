/**
 * Course audit: plays each hole of a real course many times through the tracer
 * and checks the result against the course's map and picture.
 *   npm run audit:course -- <course-id> [rounds] [--write]
 *   npm run audit:course -- all 50
 * Reports per hole: which hole questions can be asked, whether each one's
 * geometry is there, the median tee-shot distance against the picture's landing
 * point, and whether water, bunker and green lies match the map.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REAL_COURSES } from "../../src/engine/realCourses";
import { decisionsFor, holeFindings, type CallKind } from "../../src/engine/calls";
import { realHoleOf, traceHole, type HoleTrace } from "../../src/engine/tracer";
import { generatePlayer } from "../../src/engine/players";
import { createRng } from "../../src/engine/rng";
import type { Course, Player } from "../../src/engine/types";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const write = process.argv.includes("--write");
// --anchors adds the landing-spot table: the world anchors and calibrate command for each hole.
const anchors = process.argv.includes("--anchors");
const target = args[0] ?? "all";
const rounds = Number(args[1] ?? 50);

const art = JSON.parse(readFileSync(resolve("src/ui/illustratedArt.generated.json"), "utf8")) as Record<
  string,
  { displayOnly?: boolean; route?: { at: number }[] }
>;

// Questions that depend on a specific hole's geometry, and the rule each needs.
const GEOMETRY_KINDS: CallKind[] = ["dogleg", "bunkerCarry", "carry", "approach"];

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)]!);
};

function auditCourse(course: Course, n: number) {
  const rng = createRng(course.id.length * 104729 + 7);
  const situation = { round: 1, index: 0, behind: 0, cutMargin: null, wind: 0, rain: false, lastOverPar: 0, condition: 100 };
  const lines: string[] = [];
  const holeReports: string[] = [];
  const artEntry = (num: number) => art[`${course.id}:${num}`];

  lines.push(`# ${course.name} (${course.id}) audit, ${n} rounds per hole`);
  lines.push("");
  lines.push("| Hole | Par | Yds | Questions asked (rounds) | Tee median | Picture landing | Water lies | Bunker lies | OB lies | Green hits | Flags |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");

  for (const hole of course.holes) {
    const found = holeFindings(course, hole);
    const flags: string[] = [];
    const asked = new Map<string, number>();
    const teeYards: number[] = [];
    let waterLies = 0, bunkerLies = 0, obLies = 0, greenHits = 0;

    for (let r = 0; r < n; r++) {
      const player: Player = generatePlayer(rng, { tier: "tour" });
      const sit = { ...situation, index: hole.number - 1 };
      for (const d of decisionsFor(hole, course, player, sit)) asked.set(d.kind, (asked.get(d.kind) ?? 0) + 1);
      const over = Math.floor(rng.next() * 4) - 1; // -1..+2 from par
      const trace: HoleTrace = traceHole({ course, hole, score: hole.par + over, player, seed: rng.int(1, 1e9), round: r % 4 });
      const layout = trace.layout;
      for (const s of trace.shots) {
        if (s.kind === "tee") teeYards.push(s.yards);
        if (s.lie === "water") waterLies++;
        if (s.lie === "bunker") bunkerLies++;
        if (s.lie === "ob") obLies++;
        if (s.lie === "green" || s.lie === "holed") greenHits++;
      }
      if (waterLies && layout.water.length === 0) flags.push("water lie on a dry hole");
      if (bunkerLies && layout.bunkers.length === 0) flags.push("bunker lie with no bunkers");
    }
    // Geometry for each question that was asked.
    for (const kind of asked.keys()) {
      if (!GEOMETRY_KINDS.includes(kind as CallKind)) continue;
      if (kind === "dogleg" && !(found.dogleg >= 25)) flags.push("dogleg asked, map bend < 25°");
      if (kind === "bunkerCarry" && found.bunkersAtDrive < 1) flags.push("bunker carry asked, no bunker at drive");
      if (kind === "carry" && !found.water) flags.push("water-short asked, no water on map");
      if (kind === "approach" && found.known && !found.guardedGreen) flags.push("guarded green asked, no bunker by green");
    }
    if (!found.known) flags.push("no real map: questions use stat rules only");

    // Tee shot against the picture's landing point.
    const entry = artEntry(hole.number);
    const landingFrac = entry?.route && entry.route.length >= 3 ? entry.route[1]!.at : null;
    const pictureLanding = entry?.displayOnly ? "display only" : landingFrac !== null ? Math.round(landingFrac * hole.yards) : "none";
    const tee = median(teeYards);
    if (hole.par > 3 && typeof pictureLanding === "number" && tee !== null && Math.abs(tee - pictureLanding) > 25) {
      flags.push(`tee ${tee} yds vs picture landing ${pictureLanding} yds`);
    }

    const qs = [...asked.entries()].map(([k, c]) => `${k} ${c}`).join(", ") || "none";
    lines.push(`| ${hole.number} | ${hole.par} | ${hole.yards} | ${qs} | ${tee ?? "-"} | ${pictureLanding} | ${waterLies} | ${bunkerLies} | ${obLies} | ${greenHits} | ${flags.join("; ") || "ok"} |`);
    holeReports.push(`${hole.number}: ${flags.join("; ") || "ok"}`);
  }
  const problems = holeReports.filter((h) => !h.endsWith(": ok")).length;
  lines.push("");
  lines.push(`${problems} of ${course.holes.length} holes have something to check.`);
  if (anchors) lines.push(anchorSection(course));
  return lines.join("\n");
}

/**
 * The landing-spot step from the other courses, as data: each hole's tee, a landing point
 * on its real line of play (about 270 yards on a par 4, 290 on a par 5, the front of the green
 * on a par 3), and the green. Read those three points off the picture in pixels, then run the
 * calibrate command below. Then respace the route (scripts/art/respaceRoutes.mjs) and
 * remove displayOnly so the tracer draws the hole.
 */
function anchorSection(course: Course): string {
  const out = ["", "## Landing anchors (world yards from the real map)", "", "| Hole | Par | Tee | Landing | Green | Calibrate command (replace the pixel values) |", "|---|---|---|---|---|---|"];
  for (const hole of course.holes) {
    const real = realHoleOf(course.id, hole.number);
    if (!real) {
      out.push(`| ${hole.number} | ${hole.par} | - | - | - | no real map |`);
      continue;
    }
    const path = real.path;
    const [gx = 0, gy = 0] = real.green;
    const target = hole.par === 3 ? gy - 14 : hole.par === 4 ? Math.min(hole.yards - 150, 270) : Math.min(hole.yards - 200, 290);
    // Walk the line of play to the point at the target distance from the tee.
    let land = path[0]!;
    let walked = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const seg = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
      if (walked + seg >= target) {
        const t = seg ? (target - walked) / seg : 0;
        land = [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t];
        break;
      }
      walked += seg;
      land = b;
    }
    const f = (p: number[]) => `${Math.round(p[0]!)},${Math.round(p[1]!)}`;
    const id = String(hole.number).padStart(2, "0");
    const pic = art[`${course.id}:${hole.number}`] as { image?: string; width?: number; height?: number } | undefined;
    const image = pic?.image?.split("?")[0] ?? `art-demo/${course.id}/hole-${id}.webp`;
    const cmd = `npm run art:calibrate -- ${course.id} ${hole.number} public/${image} ${pic?.width ?? 1774} ${pic?.height ?? 887} "0,0:TEE_PX" "${f(land)}:LANDING_PX" "${f([gx, gy])}:GREEN_PX"`;
    out.push(`| ${hole.number} | ${hole.par} | 0,0 | ${f(land)} | ${f([gx, gy])} | \`${cmd}\` |`);
  }
  return out.join("\n");
}

const courses = target === "all" ? REAL_COURSES.filter((c) => art[`${c.id}:1`]) : REAL_COURSES.filter((c) => c.id === target);
if (!courses.length) {
  console.log(`No course "${target}". Use a course id such as tpc-scottsdale, or "all".`);
  process.exit(1);
}
for (const course of courses) {
  const report = auditCourse(course, rounds);
  console.log(report + "\n");
  if (write) {
    const dir = resolve("audit-reports");
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, `${course.id}.md`), report + "\n");
  }
}
