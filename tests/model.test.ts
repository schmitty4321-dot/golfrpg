import { describe, expect, it } from "vitest";
import {
  COURSES,
  VISIBLE_ATTRIBUTES,
  coursePar,
  createRng,
  expectedStrokesGained,
  generatePlayer,
  generateTourField,
  getCourse,
  totalSg,
  windMultiplier,
  PAYOUT_PERCENT,
  tiedPayout,
} from "../src/engine";
import { flatPlayer } from "./helpers";

describe("courses", () => {
  it.each(COURSES)("$name has 18 holes and a tour par", (c) => {
    expect(c.holes).toHaveLength(18);
    expect(coursePar(c)).toBeGreaterThanOrEqual(70);
    expect(coursePar(c)).toBeLessThanOrEqual(72);
  });
});

describe("skill model", () => {
  const course = getCourse("harrow-pines");

  it("rates a tour-average player at about zero", () => {
    expect(Math.abs(totalSg(expectedStrokesGained(flatPlayer("a", 12), course)))).toBeLessThan(0.3);
  });

  it("puts a generational talent about 2.5-3 strokes a round ahead, like the very best seasons", () => {
    // Ceilings top out at 17 (MAX_POTENTIAL). Data Golf: a top-5 player is about +2, and seasons
    // above +2.5 are very rare; the rescaled approach weights (2026-10-01) put 17 at about +2.8.
    const ahead = (level: number) => totalSg(expectedStrokesGained(flatPlayer("a", level), course)) - totalSg(expectedStrokesGained(flatPlayer("b", 12), course));
    expect(ahead(17)).toBeGreaterThan(2.5);
    expect(ahead(17)).toBeLessThan(3.2);
    // A player rated 20 at everything can't exist, but even he isn't absurd.
    expect(ahead(20)).toBeLessThan(5.5);
  });

  it("rewards distance more on a long course than a short one", () => {
    const bomber = flatPlayer("b", 12, { drivingDistance: 18 });
    const short = getCourse("marisol-bay");
    const long = getCourse("saguaro-wells");
    expect(expectedStrokesGained(bomber, long).offTheTee).toBeGreaterThan(expectedStrokesGained(bomber, short).offTheTee);
  });

  it("rewards accuracy more on tight, penal courses", () => {
    const plotter = flatPlayer("p", 12, { drivingAccuracy: 18 });
    const tight = getCourse("harrow-pines");
    const wide = getCourse("saguaro-wells");
    expect(expectedStrokesGained(plotter, tight).offTheTee).toBeGreaterThan(expectedStrokesGained(plotter, wide).offTheTee);
  });

  it("gives a putting edge on the player's home grass", () => {
    const bent = flatPlayer("x", 12);
    const bermuda = { ...flatPlayer("y", 12), grassPreference: "bermuda" as const };
    expect(expectedStrokesGained(bent, course).putting).toBeGreaterThan(expectedStrokesGained(bermuda, course).putting);
  });

  it("makes good wind players and low-ball hitters suffer less in wind", () => {
    expect(windMultiplier(flatPlayer("w", 12, { windTolerance: 18, trajectoryControl: 18 }))).toBeLessThan(1);
    expect(windMultiplier(flatPlayer("w", 12, { windTolerance: 5, trajectoryControl: 5 }))).toBeGreaterThan(1);
  });

  it("hurts a slumping, worn-out player", () => {
    const fresh = flatPlayer("f", 14);
    const tired = { ...flatPlayer("t", 14), form: -0.8, condition: 55 };
    expect(totalSg(expectedStrokesGained(tired, course))).toBeLessThan(totalSg(expectedStrokesGained(fresh, course)) - 0.5);
  });
});

describe("player generator", () => {
  const rng = createRng(1);

  it("keeps every attribute on the 1-20 scale", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePlayer(rng, { tier: "junior" });
      for (const v of Object.values(p.attributes)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(20);
      }
    }
  });

  it("makes elite players better than juniors on average", () => {
    const avg = (tier: "elite" | "junior") => {
      let s = 0;
      for (let i = 0; i < 100; i++) {
        const p = generatePlayer(rng, { tier });
        s += VISIBLE_ATTRIBUTES.reduce((t, k) => t + p.attributes[k], 0) / VISIBLE_ATTRIBUTES.length;
      }
      return s / 100;
    };
    expect(avg("elite")).toBeGreaterThan(avg("junior") + 5);
  });

  it("gives juniors junior ages and veterans veteran ages", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePlayer(rng, { tier: "junior" }).age).toBeLessThanOrEqual(17);
      expect(generatePlayer(rng, { tier: "veteran" }).age).toBeGreaterThanOrEqual(42);
    }
  });

  it("never repeats a name within a field", () => {
    const field = generateTourField(createRng(5), 156);
    expect(new Set(field.map((p) => p.name)).size).toBe(156);
    expect(new Set(field.map((p) => p.id)).size).toBe(156);
  });
});

describe("purse", () => {
  it("pays out close to the whole purse", () => {
    const total = PAYOUT_PERCENT.reduce((s, x) => s + x, 0);
    expect(total).toBeGreaterThan(95);
    expect(total).toBeLessThanOrEqual(100 + 1e-9);
  });

  it("pools and splits tied places", () => {
    expect(tiedPayout(1_000_000, 2, 2)).toBe(Math.round((1_000_000 * (10.9 + 6.9)) / 100 / 2));
  });
});

describe("temporary adjustments", () => {
  it("applies sgAdjust on top of attributes (e.g. mid swing rebuild)", () => {
    const course = getCourse("harrow-pines");
    const base = flatPlayer("a", 14);
    const rebuilding = { ...flatPlayer("b", 14), sgAdjust: { approach: -0.5, offTheTee: -0.2 } };
    const a = expectedStrokesGained(base, course);
    const b = expectedStrokesGained(rebuilding, course);
    expect(b.approach).toBeCloseTo(a.approach - 0.5, 9);
    expect(b.offTheTee).toBeCloseTo(a.offTheTee - 0.2, 9);
    expect(b.putting).toBeCloseTo(a.putting, 9);
  });
});

describe("names", () => {
  it("stays unique even when the name pools run dry", () => {
    const rng = createRng(9);
    const used = new Set<string>();
    const names = Array.from({ length: 3000 }, () => generatePlayer(rng, { tier: "tour", nationality: "Ireland", usedNames: used }).name);
    expect(new Set(names).size).toBe(names.length);
  });
});
