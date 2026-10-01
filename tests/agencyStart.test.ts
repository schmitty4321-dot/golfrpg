import { describe, expect, it } from "vitest";
import { createWorld, overall, rosterLimit } from "../src/season";

describe("a new agency", () => {
  it("opens with a rookie, a 25-year-old and a veteran on staggered contracts", () => {
    for (const seed of [1, 7, 21]) {
      const w = createWorld({ seed, scenario: "agency" });
      expect(w.clientIds).toEqual(["client", "client2", "client3"]);
      expect(w.clientIds.length).toBeLessThanOrEqual(rosterLimit(w.agency.reputation, w.agency.hq));
      const [rookie, prospect, veteran] = w.clientIds.map((id) => w.players[id]!);
      expect(rookie!.player.age).toBe(23);
      expect(rookie!.career.status).toBe("graduate");
      expect(prospect!.player.age).toBe(25);
      expect(overall(prospect!.player)).toBeGreaterThanOrEqual(11);
      expect(overall(prospect!.player)).toBeLessThanOrEqual(13);
      expect(veteran!.player.age).toBe(45);
      expect(veteran!.career.careerWins).toBeGreaterThan(0);
      expect(w.clientIds.map((id) => w.players[id]!.client!.contract.untilSeason - w.season)).toEqual([2, 1, 0]);
      expect(new Set(w.clientIds.map((id) => w.players[id]!.player.name)).size).toBe(3);
    }
  });

  it("still allows a single-client start", () => {
    const w = createWorld({ seed: 1, scenario: "rookie" });
    expect(w.clientIds).toEqual(["client"]);
  });
});
