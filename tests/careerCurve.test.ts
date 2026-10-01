import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import { ROOKIE_CEILING, createWorld, developWeek, overall, rookieCeiling, type DevelopmentInputs, type WorldPlayer } from "../src/season";

describe("the Rookie's ceiling", () => {
  it("is a bell curve: a few legends, more busts, most in between", () => {
    const rng = createRng(7);
    const xs = Array.from({ length: 4000 }, () => rookieCeiling(10.9, rng));
    const share = (f: (x: number) => boolean) => xs.filter(f).length / xs.length;
    expect(share((x) => x >= 16.3)).toBeGreaterThan(0.015);
    expect(share((x) => x >= 16.3)).toBeLessThan(0.05);
    expect(share((x) => x >= 12 && x < 13.6)).toBeGreaterThan(0.28);
    // Some can't grow at all: their ceiling is where they start.
    expect(share((x) => x === 10.9)).toBeGreaterThan(0.08);
    expect(Math.max(...xs)).toBeLessThanOrEqual(17);
    expect(ROOKIE_CEILING.mean).toBe(12.8);
  });
});

describe("how a client develops", () => {
  const world = createWorld({ seed: 5, scenario: "rookie" });
  const start = world.players[world.clientIds[0]!]!;
  start.development.potential = 16.5;
  start.player.peakAge = 29;
  start.player.attributes.professionalism = 12;
  start.player.attributes.coachability = 12;

  const sixYears = (managed: boolean, q: number, extra: Partial<DevelopmentInputs> & { range?: number; winter?: "standard" | "camp" } = {}): number => {
    let total = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const wp: WorldPlayer = structuredClone(start);
      const rng = createRng(seed);
      const plan = { focus: "balanced" as const, intensity: extra.plan?.intensity ?? ("normal" as const) };
      const coachQuality = { swing: q, shortGame: q, putting: q, mental: q, fitness: q };
      const from = overall(wp.player);
      for (let y = 0; y < 6; y++) {
        for (let wk = 0; wk < 41; wk++) {
          const boost = extra.range ? { training: 1 + 0.15 * extra.range, fitness: 1 } : undefined;
          developWeek(wp, { plan, coachQuality, competed: wk % 5 !== 4 && wk % 3 !== 2, managed, ...(boost ? { boost } : {}) }, rng);
        }
        for (let wk = 0; wk < 10; wk++) developWeek(wp, { plan, coachQuality, competed: false, managed, ...(managed ? { winter: extra.winter ?? "standard" } : {}) }, rng);
        wp.player.age++;
      }
      total += overall(wp.player) - from;
    }
    return total / 8;
  };

  it("grows at the pace you set, not at the pace of his ceiling", () => {
    const typical = sixYears(true, 12);
    const wellRun = sixYears(true, 18, { plan: { focus: "balanced", intensity: "heavy" }, range: 3, winter: "camp" });
    // About +1 to his peak for a typical setup, +3.5 for a well-run one (Data Golf: rookie to top 20).
    expect(typical).toBeGreaterThan(0.6);
    expect(typical).toBeLessThan(1.6);
    expect(wellRun).toBeGreaterThan(2.8);
    expect(wellRun).toBeLessThan(5);
    // The levers add up rather than multiply.
    expect(wellRun / typical).toBeLessThan(5);
  });

  it("stops growing at his peak and fades after it", () => {
    let lost = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const wp: WorldPlayer = structuredClone(start);
      wp.player.age = 33;
      const from = overall(wp.player);
      const rng = createRng(seed);
      for (let wk = 0; wk < 51 * 4; wk++) developWeek(wp, { plan: { focus: "balanced", intensity: "normal" }, coachQuality: { swing: 12, shortGame: 12, putting: 12 }, competed: false }, rng);
      lost += (from - overall(wp.player)) / 6;
    }
    // Four years past his peak, about 0.2 of overall a year builds up (Data Golf: 0.17 from 30
    // to 36); skills drop a whole point at a time, so about half a point is still to come.
    expect(lost).toBeGreaterThan(0.3);
    expect(lost).toBeLessThan(1.3);
  });
});
