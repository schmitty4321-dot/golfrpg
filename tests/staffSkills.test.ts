import { describe, expect, it } from "vitest";
import { LOYAL_SEASONS, STAFF_SKILLS, createWorld, hasSkill, hireStaffer, skillCount, skillsOf, staffContract, staffMarket, weeklyScoutCost } from "../src/season";

describe("staff skills", () => {
  it("everyone has one to three skills of their own role, more for a better rating", () => {
    const w = createWorld({ seed: 91, scenario: "agency" });
    for (const s of staffMarket(w)) {
      const skills = skillsOf(w, s);
      expect(skills.length).toBe(skillCount(s.quality));
      expect(new Set(skills).size).toBe(skills.length);
      for (const k of skills) expect(STAFF_SKILLS[k]!.role).toBe(s.role);
    }
    expect([skillCount(6), skillCount(12), skillCount(17)]).toEqual([1, 2, 3]);
    // Fixed by who they are: the same person shows the same skills every time.
    const s = staffMarket(w)[0]!;
    expect(skillsOf(w, s)).toEqual(skillsOf(w, s));
  });

  it("three seasons of loyalty bring one more skill", () => {
    const w = createWorld({ seed: 92, scenario: "agency" });
    w.agency.bank = 50_000_000;
    const s = staffMarket(w).find((x) => x.role === "analyst")!;
    hireStaffer(w, s.id, 3);
    const before = skillsOf(w, s).length;
    staffContract(w, "analyst")!.seasonsServed = LOYAL_SEASONS;
    expect(skillsOf(w, s).length).toBe(before + 1);
  });

  it("a skill changes the game: scouting reports halve the scouts' bill", () => {
    const w = createWorld({ seed: 93, scenario: "agency" });
    w.agency.bank = 50_000_000;
    const analyst = staffMarket(w).find((x) => x.role === "analyst" && skillsOf(w, x).includes("scouting-reports"));
    if (!analyst) return;
    w.agency.hiredScouts = w.agency.scouts.slice(0, 2).map((x) => x.id);
    const full = weeklyScoutCost(w);
    hireStaffer(w, analyst.id, 1);
    expect(hasSkill(w, "scouting-reports")).toBe(true);
    expect(weeklyScoutCost(w)).toBe(Math.round(full * 0.5));
  });
});
