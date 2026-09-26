import { describe, expect, it } from "vitest";
import { COURSES, createRng, holeLayout, planHole, planStrokes, projectAlong, pointAt, traceHole, traceSeed, scoreName, generateCourse } from "../src/engine";
import { flatPlayer } from "./helpers";

const courses = [...COURSES, ...["links", "parkland", "desert", "resort"].map((s, i) => generateCourse(createRng(i), `g${i}`, `G${i}`, s as "links"))];

describe("shot plans", () => {
  it("always add up to the score", () => {
    const rng = createRng(1);
    for (const par of [3, 4, 5]) {
      for (let score = 1; score <= par + 5; score++) {
        for (let i = 0; i < 200; i++) expect(planStrokes(planHole(par, score, rng.next(), rng))).toBe(score);
      }
    }
  });
});

describe("traceHole", () => {
  it("reconstructs every score on every hole, ending in the cup", () => {
    for (const course of courses) {
      for (const hole of course.holes) {
        for (let score = 1; score <= hole.par + 4; score++) {
          if (score === 1 && hole.par > 3 && score < hole.par - 3) continue;
          const t = traceHole({ course, hole, score, player: flatPlayer("p", 13), seed: traceSeed(course.id, hole.number, score) });
          expect(t.shots.length).toBe(score);
          expect(t.shots.at(-1)!.lie).toBe("holed");
          expect(t.shots.filter((s) => s.lie === "holed")).toHaveLength(1);
          t.shots.forEach((s, i) => expect(s.stroke).toBe(i + 1));
          for (const s of t.shots) {
            expect(Number.isFinite(s.to.x) && Number.isFinite(s.to.y)).toBe(true);
            if (s.kind === "putt") expect(["green", "holed"]).toContain(t.shots[t.shots.indexOf(s) - 1]?.lie === "holed" ? "x" : s.lie);
          }
        }
      }
    }
  });

  it("only putts from the green", () => {
    for (const hole of COURSES[0]!.holes) {
      for (let score = 2; score <= hole.par + 3; score++) {
        const t = traceHole({ course: COURSES[0]!, hole, score, player: flatPlayer("p", 12), seed: score * 97 + hole.number });
        t.shots.forEach((s, i) => {
          if (s.kind === "putt") expect(["green"]).toContain(i === 0 ? "tee" : t.shots[i - 1]!.lie);
        });
      }
    }
  });

  it("is repeatable, and differs between seeds", () => {
    const course = COURSES[1]!;
    const hole = course.holes[3]!;
    const a = traceHole({ course, hole, score: 4, player: flatPlayer("p", 12), seed: 5 });
    const b = traceHole({ course, hole, score: 4, player: flatPlayer("p", 12), seed: 5 });
    expect(a).toEqual(b);
    const texts = new Set(Array.from({ length: 20 }, (_, s) => traceHole({ course, hole, score: 5, player: flatPlayer("p", 12), seed: s }).shots.map((x) => x.text).join("|")));
    expect(texts.size).toBeGreaterThan(3);
  });

  it("lets long hitters hit it further", () => {
    const course = COURSES[0]!;
    const hole = course.holes.find((h) => h.par === 5)!;
    const avg = (dd: number) => {
      let sum = 0;
      for (let s = 0; s < 40; s++) sum += traceHole({ course, hole, score: 5, player: flatPlayer("p", 12, { drivingDistance: dd }), seed: s }).shots[0]!.yards;
      return sum / 40;
    };
    expect(avg(19)).toBeGreaterThan(avg(7) + 40);
  });

  it("names scores", () => {
    expect(scoreName(1, 3)).toBe("Hole in one");
    expect(scoreName(3, 4)).toBe("Birdie");
    expect(scoreName(3, 5)).toBe("Eagle");
    expect(scoreName(6, 4)).toBe("Double bogey");
  });
});

describe("holeLayout", () => {
  it("puts the green at the hole's length and the pin on the green", () => {
    for (const course of courses) {
      for (const hole of course.holes) {
        const l = holeLayout(course, hole);
        expect(Math.round(projectAlong(l.path, l.green))).toBeCloseTo(hole.yards, -1);
        expect(Math.hypot(l.pin.x - l.green.x, l.pin.y - l.green.y)).toBeLessThan(l.green.r);
        if (hole.par > 3) expect(l.fairway.length).toBeGreaterThan(10);
        else expect(l.fairway).toHaveLength(0);
        expect(l.bounds.maxY).toBeGreaterThan(hole.yards);
      }
    }
  });

  it("walks the centre line", () => {
    const path = [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }];
    expect(pointAt(path, 50)).toEqual({ x: 0, y: 50 });
    expect(pointAt(path, 150)).toEqual({ x: 50, y: 100 });
    expect(pointAt(path, 50, 10).x).toBeCloseTo(10);
  });
});
