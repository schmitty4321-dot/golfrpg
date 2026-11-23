import { describe, expect, it } from "vitest";
import {
  PERKS,
  PERK_BRANCHES,
  PERK_FX,
  asksAllowed,
  buyPerk,
  caddieChemistry,
  chemistryRate,
  checkAchievements,
  createWorld,
  deserializeWorld,
  endorsementSlots,
  exemptionOdds,
  finishSeason,
  hireScout,
  jetWeeklyFee,
  JET_LEASE_WEEKLY,
  perkBlock,
  perkPoints,
  perkPointsEarned,
  perkState,
  rosterLimit,
  scoutTripsWeek,
  sendScout,
  serializeWorld,
  tripCostPerWeek,
  type World,
} from "../src/season";

const base = createWorld({ seed: 404, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
/** A world with some points and the given perks already owned. */
const withPerks = (...ids: string[]): World => {
  const w = fresh();
  w.agency.perks = [...ids];
  w.agency.perkPoints = 0;
  return w;
};

describe("the perk tree", () => {
  it("has four branches of five tiers, one perk a tier", () => {
    expect(PERKS).toHaveLength(20);
    expect(new Set(PERKS.map((p) => p.id)).size).toBe(20);
    for (const b of PERK_BRANCHES) expect(PERKS.filter((p) => p.branch === b.id).map((p) => p.tier).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("starts a new game with no perks and no points", () => {
    const w = fresh();
    expect(w.agency.perks).toEqual([]);
    expect(perkPoints(w)).toBe(0);
    expect(perkPointsEarned(w)).toBe(0);
  });

  it("earns a point for a finished season, with a news line", () => {
    const w = fresh();
    finishSeason(w);
    expect(w.season).toBe(2);
    expect(perkPoints(w)).toBeGreaterThanOrEqual(1);
    expect(w.news.some((n) => /Season 1 complete: a perk point/.test(n))).toBe(true);
  });

  it("earns a point for a landmark achievement, not for every achievement", () => {
    const w = fresh();
    checkAchievements(w);
    const before = perkPoints(w);
    (w.agency.trophies ??= []).push({ season: w.season, kind: "major", title: "Masters Tournament", player: "Test" });
    const fresh2 = checkAchievements(w).map((a) => a.id);
    // First win and first major both unlock; only the major is a landmark.
    expect(fresh2).toEqual(expect.arrayContaining(["first-win", "first-major"]));
    expect(perkPoints(w)).toBe(before + 1);
    expect(w.news.some((n) => /Major champion: a perk point/.test(n))).toBe(true);
  });

  it("gates each tier on the one above, spends a point, and can't be bought twice", () => {
    const w = fresh();
    w.agency.perkPoints = 3;
    expect(perkState(w, "scout-expenses")).toBe("available");
    expect(perkState(w, "scout-first-look")).toBe("locked");
    expect(perkBlock(w, "scout-first-look")).toMatch(/Needs Expense account/);
    expect(() => buyPerk(w, "scout-first-look")).toThrow();
    buyPerk(w, "scout-expenses");
    expect(w.agency.perks).toEqual(["scout-expenses"]);
    expect(perkPoints(w)).toBe(2);
    expect(perkState(w, "scout-expenses")).toBe("owned");
    expect(() => buyPerk(w, "scout-expenses")).toThrow(/Already/);
    expect(perkPoints(w)).toBe(2);
    expect(perkState(w, "scout-first-look")).toBe("available");
    buyPerk(w, "scout-first-look");
    buyPerk(w, "dev-fund");
    expect(perkPoints(w)).toBe(0);
    expect(perkBlock(w, "ops-travel")).toMatch(/No perk points/);
    expect(() => buyPerk(w, "ops-travel")).toThrow();
  });
});

describe("perk effects", () => {
  it("adds a roster place, an exemption ask and an endorsement slot", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    const limit = rosterLimit(w.agency.reputation, w.agency.hq, w.agency.perks);
    const asks = asksAllowed(w);
    const slots = endorsementSlots(w, wp);
    w.agency.perks = ["ops-roster", "com-extra-ask", "com-extra-slot"];
    expect(rosterLimit(w.agency.reputation, w.agency.hq, w.agency.perks)).toBe(limit + 1);
    expect(asksAllowed(w)).toBe(asks + 1);
    expect(endorsementSlots(w, wp)).toBe(slots + 1);
  });

  it("makes trips, the jet and caddie chemistry cheaper or quicker", () => {
    const plain = fresh();
    const w = withPerks("scout-expenses", "ops-jet", "dev-caddie");
    expect(tripCostPerWeek("EU", w)).toBe(Math.round(tripCostPerWeek("EU", plain) * PERK_FX.tripCost));
    expect(jetWeeklyFee(plain, "lease")).toBe(JET_LEASE_WEEKLY);
    expect(jetWeeklyFee(w, "lease")).toBe(Math.round(JET_LEASE_WEEKLY * PERK_FX.jetCost));
    expect(caddieChemistry(10, chemistryRate(plain))).toBe(30);
    expect(caddieChemistry(10, chemistryRate(w))).toBe(35);
  });

  it("raises the exemption odds by five points", () => {
    const plain = fresh();
    const w = withPerks("com-exemption-odds");
    const ev = plain.schedule.find((e) => e.tier === "standard" && e.format !== "matchplay")!;
    const a = exemptionOdds(plain, plain.players[plain.clientIds[0]!]!, ev);
    const b = exemptionOdds(w, w.players[w.clientIds[0]!]!, ev);
    expect(b.chance).toBeCloseTo(Math.min(0.9, a.chance + PERK_FX.exemptionOdds), 2);
    expect(b.reasons).toContain("friends at the tournaments");
  });

  it("lets a scout on a trip see three new players a week, with a sharper first look", () => {
    const run = (w: World) => {
      const scout = [...w.agency.scouts].sort((a, b) => b.quality - a.quality)[0]!;
      hireScout(w, scout.id);
      expect(sendScout(w, scout.id, "NA", "amateurs", 2)).toBeNull();
      scoutTripsWeek(w);
      const trip = w.agency.trips!.find((t) => t.scoutId === scout.id)!;
      return { found: trip.found.length, accuracy: w.agency.knowledge[trip.found[0]!]!.accuracy };
    };
    const plain = run(fresh());
    const perked = run(withPerks("scout-first-look", "scout-wider-net"));
    expect(perked.found).toBe(plain.found + 1);
    expect(perked.accuracy).toBeGreaterThanOrEqual(PERK_FX.firstLook);
  });
});

describe("old saves", () => {
  it("get back the points their seasons and landmark achievements earned", () => {
    const w = fresh();
    w.season = 6;
    w.achievements = { "first-major": { season: 3, week: 14 }, "first-win": { season: 2, week: 5 } };
    const raw = JSON.parse(serializeWorld(w));
    delete raw.agency.perks;
    delete raw.agency.perkPoints;
    const loaded = deserializeWorld(JSON.stringify(raw));
    // Five finished seasons and one landmark (a first win isn't one).
    expect(loaded.agency.perks).toEqual([]);
    expect(perkPoints(loaded)).toBe(6);
  });

  it("count perks already owned against the back-filled points", () => {
    const w = fresh();
    w.season = 4;
    const raw = JSON.parse(serializeWorld(w));
    raw.agency.perks = ["dev-fund"];
    delete raw.agency.perkPoints;
    expect(perkPoints(deserializeWorld(JSON.stringify(raw)))).toBe(2);
  });

  it("keep their points once filled in", () => {
    const w = fresh();
    w.agency.perkPoints = 4;
    expect(perkPoints(deserializeWorld(serializeWorld(w)))).toBe(4);
  });
});
