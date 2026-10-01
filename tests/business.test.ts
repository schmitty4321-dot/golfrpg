import { describe, expect, it } from "vitest";
import {
  CENTER_TIERS,
  buildCenter,
  centerBlock,
  chargeDevelopment,
  createWorld,
  dealChance,
  endDevelopmentDeal,
  offerDevelopmentDeal,
  plans,
  playWeek,
  projectDevelopment,
  winterCost,
} from "../src/season";

describe("Performance Center", () => {
  it("needs the reputation and the money, then speeds growth and cuts camp prices", () => {
    const world = createWorld({ seed: 1, scenario: "rookie" });
    const id = world.clientIds[0]!;
    expect(centerBlock(world)).toMatch(/reputation/);
    world.agency.reputation = 25;
    world.agency.bank = 100_000;
    expect(centerBlock(world)).toMatch(/bank/);
    world.agency.bank = 2_000_000;
    const camp = winterCost(world, id, "camp");
    const before = projectDevelopment(world, id, plans(world, id).current);
    buildCenter(world);
    expect(world.agency.center).toBe(1);
    expect(world.agency.bank).toBe(2_000_000 - CENTER_TIERS[1]!.build);
    expect(winterCost(world, id, "camp")).toBeLessThan(camp);
    const after = projectDevelopment(world, id, plans(world, id).current);
    expect(after.levels.at(-1)!.level).toBeGreaterThanOrEqual(before.levels.at(-1)!.level);
    const bank = world.agency.bank;
    playWeek(world);
    expect(world.agency.ledger.facility).toBeGreaterThanOrEqual(CENTER_TIERS[1]!.build + CENTER_TIERS[1]!.upkeep);
    expect(world.agency.bank).toBeLessThan(bank + 1_000_000);
  });
});

describe("development deals", () => {
  it("raise the commission on a yes, and the agency then pays and keeps the books", () => {
    const world = createWorld({ seed: 1, scenario: "rookie" });
    const id = world.clientIds[0]!;
    const m = world.players[id]!.client!;
    m.happiness = 95;
    expect(dealChance(world, id, { share: 1, terms: "years" })).toBeGreaterThan(dealChance(world, id, { share: 0.5, terms: "commission" }) - 0.5);
    let r = offerDevelopmentDeal(world, id, { share: 1, terms: "commission" });
    for (let i = 0; !r.accepted && i < 5; i++) {
      world.agency.cooldowns = {};
      world.week++;
      r = offerDevelopmentDeal(world, id, { share: 1, terms: "commission" });
    }
    expect(r.accepted).toBe(true);
    expect(m.contract.commission).toBeCloseTo(0.13, 5);
    expect(m.devFunding).toBe(1);
    chargeDevelopment(world, id, 20_000, "coaching");
    expect(m.devDeal!.funded).toBe(20_000);
    expect(m.finances.coaching).toBe(0);
    const mood = m.happiness;
    endDevelopmentDeal(world, id);
    expect(m.devFunding).toBe(0);
    expect(m.devDeal).toBeUndefined();
    expect(m.happiness).toBeLessThan(mood);
  });
});
