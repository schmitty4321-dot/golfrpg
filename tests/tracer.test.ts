import { describe, expect, it } from "vitest";
import { COURSES, REAL_COURSES, createRng, getCourse, hasRealHoles, holeLayout, planHole, planStrokes, projectAlong, pointAt, traceHole, traceSeed, scoreName, generateCourse } from "../src/engine";
import { flatPlayer } from "./helpers";

// Real courses are drawn from their OpenStreetMap outlines: include a few (every hole is checked below).
const courses = [...COURSES, ...["augusta-national", "tpc-sawgrass", "pebble-beach"].map(getCourse), ...["links", "parkland", "desert", "resort"].map((s, i) => generateCourse(createRng(i), `g${i}`, `G${i}`, s as "links"))];

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
        // Real holes follow their mapped line, which differs a little from the card.
        if (l.real) expect(Math.abs(projectAlong(l.path, l.green) - hole.yards) / hole.yards).toBeLessThan(0.2);
        else expect(Math.round(projectAlong(l.path, l.green))).toBeCloseTo(hole.yards, -1);
        expect(Math.hypot(l.pin.x - l.green.x, l.pin.y - l.green.y)).toBeLessThan(l.green.r);
        if (hole.par > 3) expect(l.fairway.length).toBeGreaterThan(10);
        else expect(l.fairway).toHaveLength(0);
        expect(l.bounds.maxY).toBeGreaterThan(l.real ? l.green.y : hole.yards);
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

describe("real holes (OpenStreetMap)", () => {
  const real = REAL_COURSES.filter((c) => hasRealHoles(c.id));

  it("cover most of the tour, with a drawing file for each course", async () => {
    const { existsSync } = await import("node:fs");
    expect(real.length).toBeGreaterThanOrEqual(30);
    for (const c of real) expect(existsSync(`public/holes/${c.id}.json`)).toBe(true);
  });

  it("run from the tee to the green about as far as the scorecard says", () => {
    for (const c of real) {
      for (const hole of c.holes) {
        const L = holeLayout(c, hole);
        if (!L.real) continue;
        const len = L.path.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - L.path[i]!.x, p.y - L.path[i]!.y), 0);
        expect(Math.abs(len - hole.yards) / hole.yards).toBeLessThan(0.16);
        expect(Math.hypot(L.green.x - L.path.at(-1)!.x, L.green.y - L.path.at(-1)!.y)).toBeLessThan(40);
        expect(Math.abs(L.path[0]!.x) + Math.abs(L.path[0]!.y)).toBe(0);
      }
    }
  });

  it("put the water where it really is", () => {
    const augusta = getCourse("augusta-national");
    const wet = augusta.holes.filter((h) => holeLayout(augusta, h).water.length > 0).map((h) => h.number);
    for (const n of [12, 13, 16]) expect(wet).toContain(n);
    // Sawgrass 17: the island green, water all around it.
    const saw = getCourse("tpc-sawgrass");
    const L = holeLayout(saw, saw.holes[16]!);
    expect(L.real).toBeTruthy();
    // The lake is mapped with the island cut out of it: water on every side of the green.
    const near = L.water.flat().filter((p) => Math.hypot(p.x - L.green.x, p.y - L.green.y) < 60);
    expect(near.some((p) => p.x < L.green.x - 5)).toBe(true);
    expect(near.some((p) => p.x > L.green.x + 5)).toBe(true);
    expect(near.some((p) => p.y < L.green.y - 5)).toBe(true);
    expect(near.some((p) => p.y > L.green.y + 5)).toBe(true);
  });

  it("sends a ball that finds the water into the real water", () => {
    const saw = getCourse("tpc-sawgrass");
    const hole = saw.holes[16]!;
    const L = holeLayout(saw, hole);
    for (let seed = 0; seed < 60; seed++) {
      const t = traceHole({ course: saw, hole, score: 5, player: flatPlayer("w", 12), seed });
      const wet = t.shots.find((s) => s.lie === "water");
      if (!wet) continue;
      const nearest = Math.min(...L.water.flat().map((p) => Math.hypot(p.x - wet.to.x, p.y - wet.to.y)));
      expect(nearest).toBeLessThan(10);
    }
  });
});
