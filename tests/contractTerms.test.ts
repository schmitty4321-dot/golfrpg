import { describe, expect, it } from "vitest";
import { STRUCTURE_AT, acceptChance, createWorld, prizeCut, rankMap, signClient } from "../src/season";

describe("contract extras", () => {
  it("a ladder takes more of a big season, a star deal less, and majors can have their own rate", () => {
    const flat = { commission: 0.1 };
    expect(prizeCut(flat, 0, 1_000_000, false)).toBe(100_000);
    // Half of this cheque is above the line.
    const before = STRUCTURE_AT - 500_000;
    expect(prizeCut({ commission: 0.1, extras: { structure: "ladder" } }, before, 1_000_000, false)).toBe(50_000 + 70_000);
    expect(prizeCut({ commission: 0.1, extras: { structure: "star" } }, before, 1_000_000, false)).toBe(50_000 + 30_000);
    expect(prizeCut({ commission: 0.1, extras: { majorCommission: 0.07 } }, 0, 1_000_000, true)).toBe(70_000);
    expect(prizeCut({ commission: 0.1, extras: { majorCommission: 0.07 } }, 0, 1_000_000, false)).toBe(100_000);
  });

  it("stars prefer a star deal to a ladder; anyone likes a signing bonus and dislikes a win bonus", () => {
    const w = createWorld({ seed: 21, scenario: "agency" });
    w.agency.reputation = 90;
    const ranks = rankMap(w);
    const star = Object.values(w.players).find((wp) => !wp.client && (ranks.get(wp.player.id) ?? 999) <= 20)!.player.id;
    const base = { commission: 0.1, years: 2 };
    const chance = (extras: object) => acceptChance(w, star, { ...base, extras });
    expect(chance({ structure: "star" })).toBeGreaterThan(chance({}));
    expect(chance({ structure: "ladder" })).toBeLessThan(chance({}));
    expect(chance({ signingBonus: 150_000 })).toBeGreaterThan(chance({}));
    expect(chance({ winBonus: 50_000 })).toBeLessThan(chance({}));
  });

  it("pays the signing bonus out of the bank and keeps the terms on the contract", () => {
    const w = createWorld({ seed: 22, scenario: "agency" });
    const id = Object.values(w.players).find((wp) => !wp.client && wp.career.status === "exempt")!.player.id;
    const bank = w.agency.bank;
    signClient(w, id, { commission: 0.12, years: 2, extras: { signingBonus: 50_000, winBonus: 25_000, structure: "flat" } });
    expect(w.agency.bank).toBe(bank - 50_000);
    expect(w.players[id]!.client!.contract.extras).toEqual({ signingBonus: 50_000, winBonus: 25_000 });
  });
});
