import { describe, expect, it } from "vitest";
import { CHALLENGES, applyChallenge, checkChallenge, createWorld, finishSeason, playWeek, seasonWeeks } from "../src/season";

describe("challenges", () => {
  it("each sets up a playable career with its goal", () => {
    for (const c of CHALLENGES) {
      const w = createWorld({ seed: 111, scenario: c.scenario });
      applyChallenge(w, c.id);
      expect(w.challenge).toMatchObject({ id: c.id, status: "active", deadline: w.season + c.seasons - 1 });
      expect(checkChallenge(w, "week")).toBeNull();
    }
  });

  it("are won when the goal is met, with a better score for finishing early", () => {
    const w = createWorld({ seed: 112, scenario: "journeyman" });
    applyChallenge(w, "journeyman");
    (w.agency.trophies ??= []).push({ season: w.season, kind: "win", title: "Sony Open in Hawaii", player: "x" });
    expect(checkChallenge(w, "week")).toBe("won");
    expect(w.challenge!.score).toBeGreaterThan(1000 + 300);
    expect(checkChallenge(w, "week")).toBeNull(); // ends once
  });

  it("are lost by breaking the rule or missing the deadline", () => {
    const w = createWorld({ seed: 113, scenario: "agency" });
    applyChallenge(w, "bankrupt");
    expect(w.agency.bank).toBe(-400_000);
    w.agency.bank = -3_000_000;
    expect(checkChallenge(w, "week")).toBe("lost");

    const b = createWorld({ seed: 114, scenario: "agency" });
    applyChallenge(b, "comeback");
    expect(b.players.client3!.player.age).toBe(38);
    expect(b.players.client3!.injury).not.toBeNull();
    for (let s = 0; s < 2 && b.challenge!.status === "active"; s++) {
      while (b.week <= seasonWeeks(b)) playWeek(b);
      finishSeason(b);
    }
    expect(["won", "lost"]).toContain(b.challenge!.status);
  });
});
