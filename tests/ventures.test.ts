import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  VENTURES,
  agencyIncome,
  alumni,
  alumnusRetires,
  applyEffects,
  buyVenture,
  createWorld,
  describeExtras,
  deserializeWorld,
  extrasAppeal,
  personalWealth,
  qTarget,
  releaseClient,
  sellVenture,
  serializeWorld,
  ventureBlock,
  ventureDay,
  venturesSeasonEnd,
  withVentureDay,
  type World,
} from "../src/season";

const base = createWorld({ seed: 31, scenario: "agency" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
const rich = (w: World, i = 0) => {
  const id = w.clientIds[i]!;
  w.players[id]!.client!.savings = 20_000_000;
  return id;
};

describe("player businesses", () => {
  it("are paid from his wealth, checked like the store, and some need standing", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    wp.client!.savings = 100_000;
    expect(ventureBlock(w, id, "restaurant")).toMatch(/can't afford/);
    wp.client!.savings = 20_000_000;
    wp.player.age = 28;
    expect(ventureBlock(w, id, "courseDesign")).toMatch(/veterans/);
    wp.client!.qRating = 40;
    expect(ventureBlock(w, id, "apparel")).toMatch(/Q rating/);
    const before = personalWealth(wp);
    const q = qTarget(w, wp);
    buyVenture(w, id, "restaurant");
    expect(personalWealth(wp)).toBe(before - VENTURES.restaurant.cost);
    expect(qTarget(w, wp)).toBe(q + VENTURES.restaurant.qBonus);
    expect(ventureBlock(w, id, "restaurant")).toMatch(/already/);
    expect(sellVenture(w, id, "restaurant")).toBe(Math.round(VENTURES.restaurant.cost * 0.6));
  });

  it("each winter's result is seeded, lands in his money, and the agency takes a share only under contract", () => {
    const a = fresh();
    const b = fresh();
    for (const w of [a, b]) {
      const id = rich(w);
      buyVenture(w, id, "techStake");
      buyVenture(w, id, "podcast");
    }
    const id = a.clientIds[0]!;
    b.players[id]!.client!.contract.extras = { businessShare: 0.1 };
    const bankA = a.agency.bank;
    const bankB = b.agency.bank;
    venturesSeasonEnd(a);
    venturesSeasonEnd(b);
    const fa = a.players[id]!.client!.finances;
    const fb = b.players[id]!.client!.finances;
    expect(fa.business).toBe(fb.business);
    expect(fa.business).not.toBe(0);
    expect(a.agency.bank).toBe(bankA);
    const profit = a.players[id]!.client!.ventures!.reduce((s, v) => s + Math.max(0, v.last ?? 0), 0);
    expect(b.agency.bank - bankB).toBe(a.players[id]!.client!.ventures!.reduce((s, v) => s + ((v.last ?? 0) > 0 ? Math.round(v.last! * 0.1) : 0), 0));
    if (profit > 0) expect(agencyIncome(b.agency.ledger)).toBeGreaterThan(agencyIncome(a.agency.ledger));
  });

  it("the business share is a term he can refuse: it makes the deal less appealing", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    expect(extrasAppeal(wp, 50, { businessShare: 0.1 }, 0.1)).toBeLessThan(0);
    expect(describeExtras({ businessShare: 0.1 })).toBe("10% of business profits");
  });

  it("the podcast and the course firm take a day of his week now and then", () => {
    const w = fresh();
    const id = rich(w);
    const wp = w.players[id]!;
    buyVenture(w, id, "podcast");
    const weeks = Array.from({ length: 8 }, (_, i) => {
      w.week = i + 1;
      return ventureDay(w, wp);
    }).filter(Boolean);
    expect(weeks.length).toBe(2);
    w.week = [1, 2, 3, 4].find((x) => ((w.week = x), ventureDay(w, wp)))!;
    expect(withVentureDay(w, wp, ["rest", "range", "gym"])).toEqual(["rest", "range", "media"]);
  });

  it("an apparel line can cost him his apparel sponsor", () => {
    const w = fresh();
    const id = rich(w);
    const wp = w.players[id]!;
    wp.client!.qRating = 70;
    buyVenture(w, id, "apparel");
    wp.client!.sponsors.push({ id: "s1", sponsor: "Threads", category: "apparel", annualValue: 100_000, winBonus: 0, majorBonus: 0, untilSeason: w.season + 2 });
    applyEffects(w, wp, [{ k: "endSponsor", category: "apparel" }], createRng(1), []);
    expect(wp.client!.sponsors.some((s) => s.category === "apparel")).toBe(false);
    applyEffects(w, wp, [{ k: "closeVenture", kind: "apparel", share: 0.6 }], createRng(1), []);
    expect(wp.client!.ventures ?? []).toHaveLength(0);
  });

  it("ventures go into the legacy record and are valued at retirement, with the agency's share if agreed", () => {
    const w = fresh();
    const id = rich(w);
    const wp = w.players[id]!;
    buyVenture(w, id, "restaurant");
    wp.client!.contract.extras = { businessShare: 0.2 };
    releaseClient(w, id);
    const a = alumni(w).find((x) => x.id === id)!;
    expect(a.ventures).toEqual([{ kind: "restaurant", stake: VENTURES.restaurant.cost }]);
    expect(a.businessShare).toBe(0.2);
    const bank = w.agency.bank;
    alumnusRetires(w, wp);
    expect(a.venturePayout).toBe(Math.round(VENTURES.restaurant.cost * VENTURES.restaurant.retireMultiple));
    expect(w.agency.bank - bank).toBe(Math.round(a.venturePayout! * 0.2));
  });

  it("an older save without ventures loads and plays its winter", () => {
    const w = fresh();
    for (const id of w.clientIds) delete w.players[id]!.client!.ventures;
    const loaded = deserializeWorld(serializeWorld(w));
    expect(loaded.clientIds.length).toBe(w.clientIds.length);
    venturesSeasonEnd(loaded);
  });
});
