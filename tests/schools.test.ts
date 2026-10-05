import { describe, expect, it } from "vitest";
import { amateurRanking, createWorld, schoolOf, TOP_PROGRAMS } from "../src/season";

describe("amateurs' schools", () => {
  const w = createWorld({ seed: 5, scenario: "agency" });
  const amateurs = amateurRanking(w).map((id) => w.players[id]!);

  it("puts 16 and 17-year-olds in high school with a home state if they're American", () => {
    for (const wp of amateurs.filter((p) => p.player.age <= 17)) {
      const s = schoolOf(w, wp)!;
      if (wp.player.nationality === "USA") expect(s.kind === "high" && s.state.length > 0).toBe(true);
      else expect(s.kind).not.toBe("college");
    }
  });

  it("sends the best American college-age amateurs to the top programs", () => {
    const best = amateurs.filter((p) => p.player.nationality === "USA" && p.player.age >= 19 && p.development.potential >= 14.5);
    for (const wp of best) {
      const s = schoolOf(w, wp)!;
      expect(s.kind).toBe("college");
      if (s.kind === "college") expect(TOP_PROGRAMS.indexOf(s.name as (typeof TOP_PROGRAMS)[number])).toBeLessThan(8);
    }
  });

  it("is fixed once given, and a high-school senior moves on to college at 19", () => {
    const hs = amateurs.find((p) => schoolOf(w, p)?.kind === "high" && p.player.nationality === "USA")!;
    const state = (schoolOf(w, hs) as { state: string }).state;
    expect(schoolOf(w, hs)).toEqual(schoolOf(w, hs));
    hs.player.age = 19;
    const s = schoolOf(w, hs)!;
    expect(s.kind).toBe("college");
    if (s.kind === "college") expect(s.state).toBe(state);
  });
});
