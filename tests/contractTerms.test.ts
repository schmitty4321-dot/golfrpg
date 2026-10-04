import { describe, expect, it } from "vitest";
import { STRUCTURE_AT, acceptChance, createWorld, playWeek, prizeCut, rankMap, signClient } from "../src/season";

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

describe("sponsor offers nobody answers", () => {
  it("a marketing lead closes them; without one he sometimes signs a smaller deal himself", async () => {
    const { hireStaffer, maybeOffer, playWeek, staffMarket } = await import("../src/season");
    const { createRng } = await import("../src/engine");
    const w = createWorld({ seed: 23, scenario: "agency" });
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    wp.client!.sponsors = [];
    wp.client!.offers = [];
    const offer = maybeOffer(w, wp, createRng(1), 1)!;
    expect(offer).toBeTruthy();
    hireStaffer(w, staffMarket(w).find((s) => s.role === "marketing")!.id);
    for (let i = 0; i < 5; i++) playWeek(w);
    expect(wp.client!.sponsors.some((s) => s.id === offer.id && s.annualValue === offer.annualValue)).toBe(true);
  });
});

describe("retainers", () => {
  it("a client on a retainer pays it every week, and the books still balance", () => {
    const w = createWorld({ seed: 24, scenario: "agency" });
    const id = w.clientIds[0]!;
    w.players[id]!.client!.contract.extras = { retainer: 1_000 };
    const bank = w.agency.bank;
    const L0 = { ...w.agency.ledger };
    playWeek(w);
    expect(w.agency.ledger.retainers).toBe(1_000);
    const L = w.agency.ledger as unknown as Record<string, number>;
    const before = L0 as unknown as Record<string, number>;
    const d = (k: string) => (L[k] ?? 0) - (before[k] ?? 0);
    const income = d("prizeCommission") + d("endorsementCommission") + d("winBonuses") + d("retainers") + d("brands") + d("events") + d("buyouts");
    const costs = d("office") + d("scouts") + d("development") + d("facility") + d("interest") + d("staff") + d("clientCare") + d("support") + d("signingBonuses");
    expect(w.agency.bank - bank).toBe(income - costs);
  });
});

describe("investments", () => {
  it("cost a lump to start, pay out every winter, and sell for most of the stake", async () => {
    const { buyInvestment, finishSeason, investBlock, sellInvestment, INVESTMENTS, SALE_SHARE, seasonWeeks } = await import("../src/season");
    const w = createWorld({ seed: 25, scenario: "agency" });
    w.agency.reputation = 70;
    w.agency.bank = 20_000_000;
    expect(investBlock(w, "course")).toBeNull();
    buyInvestment(w, "course");
    expect(w.agency.bank).toBe(20_000_000 - INVESTMENTS.course.cost);
    expect(investBlock(w, "course")).toMatch(/already/);
    while (w.week <= seasonWeeks(w)) playWeek(w);
    finishSeason(w);
    const inv = w.agency.investments!.find((i) => i.kind === "course")!;
    expect(inv.last).toBeGreaterThan(0);
    const bank = w.agency.bank;
    sellInvestment(w, "course");
    expect(w.agency.bank).toBe(bank + INVESTMENTS.course.cost * SALE_SHARE);
  });
});

describe("the owners", () => {
  it("set targets, pay a bonus for all of them, warn after two losing seasons and bail out after three", async () => {
    const { setObjectives, settleBoard, BAILOUT } = await import("../src/season");
    const w = createWorld({ seed: 26, scenario: "agency" });
    expect(w.agency.board!.objectives).toHaveLength(3);
    const losing = { ...w.agency.ledger, prizeCommission: 0, office: 1_000_000 };
    settleBoard(w, losing);
    setObjectives(w);
    w.agency.board!.season = w.season;
    expect(settleBoard(w, losing)).toMatch(/Two losing seasons/);
    setObjectives(w);
    const bank = w.agency.bank;
    expect(settleBoard(w, losing)).toMatch(/bail/);
    expect(w.agency.bank).toBe(bank + BAILOUT);
  });
});
