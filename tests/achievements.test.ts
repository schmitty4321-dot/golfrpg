import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, bump, checkAchievements, createWorld, finishSeason, playWeek, seasonWeeks } from "../src/season";

describe("achievements", () => {
  it("unlock once, with their reputation, when earned", () => {
    const w = createWorld({ seed: 91, scenario: "agency" });
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(checkAchievements(w).map((a) => a.id)).not.toContain("first-win");
    (w.agency.trophies ??= []).push({ season: w.season, kind: "major", title: "Masters Tournament", player: "Test" });
    const rep = w.agency.reputation;
    const fresh = checkAchievements(w).map((a) => a.id);
    expect(fresh).toEqual(expect.arrayContaining(["first-win", "first-major"]));
    expect(w.agency.reputation).toBeGreaterThan(rep);
    expect(checkAchievements(w)).toHaveLength(0);
    for (let i = 0; i < 5; i++) bump(w, "promisesKept");
    expect(checkAchievements(w).map((a) => a.id)).toContain("promises-5");
  });

  it("are checked through a season without trouble", () => {
    const w = createWorld({ seed: 92, scenario: "agency" });
    while (w.week <= seasonWeeks(w)) playWeek(w);
    finishSeason(w);
    for (const [id, when] of Object.entries(w.achievements ?? {})) {
      expect(ACHIEVEMENTS.some((a) => a.id === id)).toBe(true);
      expect(when.season).toBeGreaterThanOrEqual(1);
    }
  });
});
