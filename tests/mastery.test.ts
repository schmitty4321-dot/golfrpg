import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  ARCHETYPE_KEY,
  EUROPE,
  EUROPE_EDGE,
  GOLD_AT,
  SILVER_AT,
  createWorld,
  developWeek,
  masteries,
  masteryGrowth,
  masteryWeek,
  overall,
  tierOf,
  type WorldPlayer,
} from "../src/season";

describe("trait and archetype mastery", () => {
  const world = createWorld({ seed: 31, scenario: "agency" });
  const young = Object.values(world.players).find((wp) => wp.player.archetype && wp.player.age <= 22 && wp.development.potential - overall(wp.player) > 2)!;

  it("climbs from bronze to silver to gold with weeks played, faster when training those skills", () => {
    expect(tierOf(0)).toBe("bronze");
    expect(tierOf(SILVER_AT)).toBe("silver");
    expect(tierOf(GOLD_AT)).toBe("gold");
    const a: WorldPlayer = structuredClone(young);
    const b: WorldPlayer = structuredClone(young);
    delete a.mastery;
    delete b.mastery;
    for (let i = 0; i < 20; i++) {
      masteryWeek(a, true);
      masteryWeek(b, false);
    }
    expect(a.mastery![ARCHETYPE_KEY]).toBe(20);
    expect(b.mastery![ARCHETYPE_KEY]).toBe(10);
    expect(masteries(a).some((m) => m.key === ARCHETYPE_KEY)).toBe(true);
  });

  it("makes a gold player's skills grow faster, never past his ceiling", () => {
    const run = (gold: boolean) => {
      const wp: WorldPlayer = structuredClone(young);
      wp.mastery = gold ? Object.fromEntries(masteries(wp).map((m) => [m.key, GOLD_AT])) : {};
      const rng = createRng(5);
      // Growth is slow (real players gain about 0.15 a year): count the fractional progress too.
      const total = () => Object.values(wp.player.attributes).reduce((t, x) => t + x, 0) + Object.values(wp.development.progress).reduce((t, x) => t + (x ?? 0), 0);
      const start = total();
      for (let i = 0; i < 104; i++) developWeek(wp, { plan: { focus: "balanced", intensity: "normal" }, coachQuality: { swing: 12, shortGame: 12, putting: 12, mental: 10, fitness: 10 }, competed: true }, rng);
      return total() - start;
    };
    expect(masteryGrowth({ ...young, mastery: Object.fromEntries(masteries(young).map((m) => [m.key, GOLD_AT])) }).size).toBeGreaterThan(0);
    expect(run(true)).toBeGreaterThan(run(false));
  });
});

describe("European players", () => {
  it("come in with an edge: the pick of a deeper home tour", () => {
    expect(EUROPE_EDGE).toBeGreaterThan(0);
    const w = createWorld({ seed: 32, scenario: "agency" });
    const pros = Object.values(w.players).filter((wp) => wp.career.status !== "amateur" && !wp.client);
    const mean = (xs: WorldPlayer[]) => xs.reduce((t, wp) => t + overall(wp.player), 0) / xs.length;
    const eu = pros.filter((wp) => EUROPE.has(wp.player.nationality));
    const rest = pros.filter((wp) => !EUROPE.has(wp.player.nationality));
    expect(eu.length).toBeGreaterThan(20);
    expect(mean(eu)).toBeGreaterThan(mean(rest));
  });
});
