import { describe, expect, it } from "vitest";
import {
  HQ_TIERS,
  agencyProfit,
  borrow,
  createWorld,
  creditLimit,
  hqBlock,
  playWeek,
  repay,
  rosterLimit,
  upgradeHq,
  weeklyForecast,
} from "../src/season";

describe("headquarters", () => {
  it("costs money and reputation, then adds roster room and costs more to run", () => {
    const world = createWorld({ seed: 1, scenario: "rookie" });
    const before = rosterLimit(world.agency.reputation, world.agency.hq);
    expect(hqBlock(world)).toMatch(/reputation/);
    world.agency.reputation = 30;
    world.agency.bank = 1_000_000;
    upgradeHq(world);
    expect(world.agency.hq).toBe(1);
    expect(rosterLimit(world.agency.reputation, world.agency.hq)).toBe(rosterLimit(world.agency.reputation) + 1);
    expect(rosterLimit(world.agency.reputation, world.agency.hq)).toBeGreaterThanOrEqual(before + 1);
    const office = world.agency.ledger.office;
    playWeek(world);
    expect(world.agency.ledger.office - office).toBe(HQ_TIERS[1]!.office);
  });
});

describe("credit line and the books", () => {
  it("lends up to the limit, charges weekly interest, and is repaid from the bank", () => {
    const world = createWorld({ seed: 1, scenario: "rookie" });
    const limit = creditLimit(world);
    const bank = world.agency.bank;
    borrow(world, limit * 2);
    expect(world.agency.loan).toBe(limit);
    expect(world.agency.bank).toBe(bank + limit);
    playWeek(world);
    expect(world.agency.ledger.interest).toBeGreaterThan(0);
    expect(world.agency.bankHistory!.length).toBe(1);
    repay(world, 100_000);
    expect(world.agency.loan).toBe(limit - 100_000);
    expect(agencyProfit(world.agency.ledger)).toBeLessThan(world.agency.ledger.prizeCommission + world.agency.ledger.endorsementCommission);
  });

  it("forecasts a week of commission against running costs", () => {
    const world = createWorld({ seed: 1, scenario: "rookie" });
    const f = weeklyForecast(world, 0);
    expect(f.income).toBeGreaterThan(0);
    expect(f.costs).toBeGreaterThanOrEqual(HQ_TIERS[0]!.office);
    expect(f.net).toBe(f.income - f.costs);
  });
});
