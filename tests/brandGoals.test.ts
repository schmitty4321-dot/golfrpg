import { describe, expect, it } from "vitest";
import { BASE_SHARE, BONUS_POOL, brandOffers, createWorld, goalsFor, guaranteed, maxPayout, settleBrandGoals, signBrand } from "../src/season";

const world = (seed: number) => {
  const w = createWorld({ seed, scenario: "agency" });
  w.agency.reputation = 60;
  return w;
};

describe("brand partnership goals", () => {
  it("offers come with goals sharing the bonus pool, on top of a guaranteed half", () => {
    const w = world(81);
    const offers = brandOffers(w);
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(o.goals!.length).toBeGreaterThanOrEqual(3);
      expect(o.goals!.length).toBeLessThanOrEqual(5);
      expect(o.goals!.reduce((s, g) => s + g.share, 0)).toBeCloseTo(BONUS_POOL, 1);
      expect(guaranteed(o)).toBe(Math.round(o.annual * BASE_SHARE));
      expect(maxPayout(o)).toBeGreaterThan(o.annual);
    }
  });

  it("every category's goals fit the roster", () => {
    const w = world(82);
    w.clientIds = w.clientIds.slice(0, 1);
    expect(goalsFor(w, "equipment").map((g) => g.id)).not.toContain("eq-loyalty");
    // Targets scale with the agency: one client is asked for 16 events, not 75.
    expect(goalsFor(w, "automotive").find((g) => g.id === "au-road")!.target).toBe(16);
    w.agency.reputation = 30;
    expect(goalsFor(w, "equipment").find((g) => g.id === "eq-major")!.label).toContain("top 10");
  });

  it("a goal met pays its bonus at season end, and the brand remembers", () => {
    const w = world(83);
    const offer = brandOffers(w).find((o) => o.goals!.some((g) => g.id === "eq-win" || g.id === "au-wins" || g.id === "wa-prestige" || g.id === "fi-charity"))
      ?? brandOffers(w)[0]!;
    signBrand(w, offer.id);
    const deal = w.agency.brands!.at(-1)!;
    // Hand the agency a win this season (and the reputation a watch brand wants).
    const wp = w.players[w.clientIds[0]!]!;
    wp.career.results.push({ eventId: "x", eventName: "Test Open", tier: "major", season: w.season, week: 5, position: 1, label: "1", toPar: -12, earnings: 12_000_000, seasonPoints: 600, owgrPoints: 100, sgPerRound: 3, madeCut: true, via: "field" });
    w.agency.reputation = 70;
    const bank = w.agency.bank;
    settleBrandGoals(w);
    expect(w.agency.ledger.brandBonuses ?? 0).toBeGreaterThan(0);
    expect(w.agency.bank).toBeGreaterThan(bank);
    expect(w.agency.brandHistory![deal.brand]).toBeGreaterThan(0);
  });
});
