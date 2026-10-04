import { describe, expect, it } from "vitest";
import { BURNOUT_FROM, TARGET_SET_WEEKS, burnoutFactor, checkBreakthrough, createWorld, developmentReports, effectivePeak, fatigueWeek, peakView, pressureGrowth, setSkillTargets, settleTargets, targetProgress, targetsOf } from "../src/season";

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

  it("practice targets: set early, measured from when set, locked later, settled with mastery", () => {
    const w = createWorld({ seed: 35, scenario: "agency" });
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    w.week = 1;
    setSkillTargets(w, id, ["lagPutting", "bunkerPlay"]);
    const [lag] = targetsOf(w, wp);
    expect(lag!.from).toBeCloseTo(wp.player.attributes.lagPutting + (wp.development.progress.lagPutting ?? 0));
    expect(() => setSkillTargets(w, id, ["lagPutting", "bunkerPlay", "chipping", "pitching"])).toThrow();
    // Swapping one keeps the other's starting point.
    wp.player.attributes.lagPutting += 1;
    setSkillTargets(w, id, ["lagPutting", "chipping"]);
    expect(targetsOf(w, wp)[0]!.from).toBe(lag!.from);
    expect(targetProgress(w, wp, targetsOf(w, wp)[0]!).pace).toBe("met");
    w.week = TARGET_SET_WEEKS + 1;
    expect(() => setSkillTargets(w, id, ["putting" as never])).toThrow();
    developmentReports(w);
    settleTargets(w);
    expect(targetsOf(w, wp)[0]!.met).toBe(true);
    expect(wp.client!.devReports!.at(-1)!.milestones.some((m) => m.startsWith("Practice targets"))).toBe(true);
  });

  it("the peak age is a range that holds the truth and narrows with better staff and time", () => {
    const w = createWorld({ seed: 36, scenario: "agency" });
    const wp = Object.values(w.players).find((p) => p.player.age <= 24)!;
    const truth = effectivePeak(wp);
    const poor = peakView(wp, 5, 0, w.seed);
    const good = peakView(wp, 19, 0, w.seed);
    const watched = peakView(wp, 5, 6, w.seed);
    for (const v of [poor, good, watched]) {
      expect(v.low).toBeLessThanOrEqual(truth);
      expect(v.high).toBeGreaterThanOrEqual(truth);
    }
    expect(good.high - good.low).toBeLessThan(poor.high - poor.low);
    expect(watched.high - watched.low).toBeLessThan(poor.high - poor.low);
    wp.player.age = truth + 2;
    expect(peakView(wp, 5, 0, w.seed)).toEqual({ low: truth, high: truth, exact: true });
  });
});
