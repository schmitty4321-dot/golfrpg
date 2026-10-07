import { describe, expect, it } from "vitest";
import {
  ROOKIE_SEASONS,
  createWorld,
  extendChance,
  extensionWindow,
  extensionsWeek,
  knownWishes,
  leverage,
  makeRookieDeal,
  maxYears,
  roundsFor,
  startNegotiation,
  talkItOver,
  termsChance,
  wishMet,
  wishesOf,
  windowWeek,
  type World,
} from "../src/season";

const world = (): { w: World; id: string } => {
  const w = createWorld({ seed: 68, scenario: "agency" });
  return { w, id: w.clientIds[0]! };
};

describe("contract extensions", () => {
  it("talks open halfway through his final season, or a season early", () => {
    const { w, id } = world();
    const c = w.players[id]!.client!;
    c.contract.untilSeason = w.season;
    w.week = 2;
    const closed = extensionWindow(w, id);
    expect(closed.open).toBe(false);
    expect(startNegotiation(w, id, "extend")).toMatch(/halfway/);
    w.week = windowWeek(w);
    expect(extensionWindow(w, id)).toEqual({ open: true, early: false });
    c.contract.untilSeason = w.season + 1;
    expect(extensionWindow(w, id)).toEqual({ open: true, early: true });
    c.contract.untilSeason = w.season + 2;
    expect(extensionWindow(w, id).open).toBe(false);
  });

  it("he has two wishes; talking it over finds one a week, and meeting them helps", () => {
    const { w, id } = world();
    const wp = w.players[id]!;
    const wishes = wishesOf(w, wp);
    expect(wishes).toHaveLength(2);
    expect(new Set(wishes).size).toBe(2);
    expect(wishesOf(w, wp)).toEqual(wishes);
    expect(knownWishes(w, wp)).toHaveLength(0);
    talkItOver(w, id);
    expect(knownWishes(w, wp)).toEqual([wishes[0]]);
    expect(talkItOver(w, id)).toMatch(/already/);
    w.week++;
    talkItOver(w, id);
    expect(knownWishes(w, wp)).toEqual(wishes);
    // An offer that meets both against one that meets neither (same rate and length otherwise).
    const plain = { commission: 0.2, years: 1, promises: [] };
    const fill = (wish: string) => (wish === "commission" ? { commission: 0.05 } : wish === "security" ? { years: 3 } : wish === "majors" ? { promises: ["majors" as const] } : {});
    const extras = (wish: string) => (wish === "bonuses" ? { structure: "ladder" as const } : wish === "freedom" ? { releaseClause: 5_000_000 } : wish === "signingBonus" ? { signingBonus: 100_000 } : undefined);
    const rich = { ...plain, ...fill(wishes[0]!), ...fill(wishes[1]!), extras: { ...extras(wishes[0]!), ...extras(wishes[1]!) } };
    for (const wish of wishes) expect(wishMet(wp, wish, rich)).toBe(true);
    // Compare like with like: strip the effect of rate and length by using his wishes' own fields only.
    expect(extendChance(w, id, { ...plain, fill: wishes[0] })).toBeGreaterThan(extendChance(w, id, plain));
  });

  it("form and the rivals' approaches raise his leverage, and his price", () => {
    const { w, id } = world();
    const wp = w.players[id]!;
    const c = wp.client!;
    c.contract.untilSeason = w.season;
    const offer = { commission: 0.1, years: 2, promises: [] };
    const calm = leverage(w, id);
    const before = extendChance(w, id, offer);
    w.week = windowWeek(w);
    for (let i = 0; i < 6; i++) {
      extensionsWeek(w);
      w.week++;
    }
    expect(c.tapped).toBeGreaterThan(0);
    expect(leverage(w, id)).toBeGreaterThan(calm);
    expect(extendChance(w, id, offer)).toBeLessThan(before);
  });

  it("staff cards: a boost lifts the next offer, an extra round adds to the talks", () => {
    const { w, id } = world();
    w.players[id]!.client!.contract.untilSeason = w.season + 1;
    expect(startNegotiation(w, id, "extend")).toBeNull();
    const n = w.talks![id]!;
    const t = { commission: 0.12, years: 2, promises: [] };
    const plain = termsChance(w, n, t);
    n.boost = 6;
    expect(termsChance(w, n, t)).toBeGreaterThan(plain);
    expect(roundsFor(n)).toBe(4);
    n.extraRounds = 1;
    expect(roundsFor(n)).toBe(5);
  });

  it("three seasons with you opens a four-season career deal", () => {
    const { w, id } = world();
    const wp = w.players[id]!;
    wp.client!.joinedSeason = w.season;
    expect(maxYears(w, wp)).toBe(3);
    wp.client!.joinedSeason = w.season - 3;
    expect(maxYears(w, wp)).toBe(4);
  });

  it("a rookie deal runs three full pro seasons", () => {
    const { w, id } = world();
    const wp = w.players[id]!;
    makeRookieDeal(w, wp);
    expect(wp.client!.contract.untilSeason).toBe(w.season + ROOKIE_SEASONS);
    expect(wp.client!.contract.rookie).toBe(true);
  });
});
