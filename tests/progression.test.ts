import { describe, expect, it } from "vitest";
import { BURNOUT_FROM, burnoutFactor, checkBreakthrough, createWorld, developmentReports, fatigueWeek, pressureGrowth } from "../src/season";

describe("progression moments", () => {
  it("a first win lifts the ceiling once, and only once", () => {
    const w = createWorld({ seed: 31, scenario: "agency" });
    const wp = w.players[w.clientIds[0]!]!;
    const before = wp.development.potential;
    checkBreakthrough(w, wp, 1, "standard");
    const after = wp.development.potential;
    expect(after).toBeGreaterThan(before);
    checkBreakthrough(w, wp, 1, "standard");
    expect(wp.development.potential).toBe(after);
    expect(wp.client!.breakthroughs).toContain("first-win");
  });

  it("contention builds composure; a 40th place doesn't", () => {
    const w = createWorld({ seed: 32, scenario: "agency" });
    const wp = w.players[w.clientIds[0]!]!;
    wp.development.progress.composure = 0;
    pressureGrowth(wp, 40, "standard");
    expect(wp.development.progress.composure).toBe(0);
    pressureGrowth(wp, 2, "major");
    expect(wp.development.progress.composure!).toBeGreaterThan(0);
  });

  it("heavy weeks build fatigue that slows growth; rest clears it", () => {
    const w = createWorld({ seed: 33, scenario: "agency" });
    const wp = w.players[w.clientIds[0]!]!;
    wp.client!.training.intensity = "heavy";
    let factor = 1;
    for (let i = 0; i < 12; i++) factor = fatigueWeek(wp, true);
    expect(wp.client!.fatigue!).toBeGreaterThan(BURNOUT_FROM);
    expect(factor).toBeLessThan(1);
    wp.client!.training.intensity = "light";
    for (let i = 0; i < 12; i++) fatigueWeek(wp, false);
    expect(wp.client!.fatigue!).toBeLessThan(10);
    expect(burnoutFactor(100)).toBe(0.5);
  });

  it("the season's development report records milestones", () => {
    const w = createWorld({ seed: 34, scenario: "agency" });
    const wp = w.players[w.clientIds[0]!]!;
    for (const k of Object.keys(wp.development.seasonStart) as (keyof typeof wp.development.seasonStart)[]) wp.development.seasonStart[k] = Math.max(1, wp.player.attributes[k] - 1);
    developmentReports(w);
    const r = wp.client!.devReports!.at(-1)!;
    expect(r.to).toBeGreaterThan(r.from);
    expect(r.milestones.some((m) => m.startsWith("Most improved"))).toBe(true);
  });
});
