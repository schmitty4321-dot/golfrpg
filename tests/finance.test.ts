import { describe, expect, it } from "vitest";
import {
  COACH_ROLES,
  chargeDevelopment,
  coachFee,
  costBurden,
  createWorld,
  developmentCost,
  earningsAtLevel,
  financeMood,
  finishSeason,
  hireCoach,
  payback,
  plans,
  playWeek,
  projectDevelopment,
  seasonWeeks,
  winterCost,
} from "../src/season";

describe("development finances", () => {
  it("prices coaches so a tour-average coach costs about $74k a season and the best about $330k", () => {
    expect(coachFee(12) * 41).toBeGreaterThan(65_000);
    expect(coachFee(12) * 41).toBeLessThan(85_000);
    expect(coachFee(20) * 41).toBeGreaterThan(300_000);
    expect(coachFee(20) * 41).toBeLessThan(360_000);
    expect(coachFee(8)).toBeLessThan(coachFee(12));
  });

  it("puts earnings on a ladder where each point of level roughly doubles them", () => {
    expect(earningsAtLevel(12.5) / earningsAtLevel(11.5)).toBeGreaterThan(1.8);
    expect(earningsAtLevel(14.5) / earningsAtLevel(13.5)).toBeGreaterThan(1.8);
    expect(earningsAtLevel(13)).toBeGreaterThan(earningsAtLevel(12.9));
  });

  it("splits a bill between him and the agency by the funding share", () => {
    const world = createWorld({ seed: 1, scenario: "rookie" });
    const id = world.clientIds[0]!;
    const m = world.players[id]!.client!;
    const bank = world.agency.bank;
    m.devFunding = 0.5;
    chargeDevelopment(world, id, 10_000, "coaching");
    expect(m.finances.coaching).toBe(5_000);
    expect(world.agency.bank).toBe(bank - 5_000);
    expect(world.agency.ledger.development).toBe(5_000);
    m.devFunding = 1;
    chargeDevelopment(world, id, 40_000, "training");
    expect(m.finances.training ?? 0).toBe(0);
    expect(world.agency.ledger.development).toBe(45_000);
  });

  it("charges the winter program on the new season's books, and a heavy bill he pays sours his mood", () => {
    const world = createWorld({ seed: 1, scenario: "rookie" });
    const id = world.clientIds[0]!;
    const wp = world.players[id]!;
    for (const role of COACH_ROLES) {
      const best = world.coaches.filter((c) => c.role === role).sort((a, b) => b.quality - a.quality)[0]!;
      hireCoach(world, id, best.id);
    }
    wp.client!.training.winter = "camp";
    const camp = winterCost(world, id, "camp");
    expect(camp).toBeGreaterThanOrEqual(60_000);
    for (let i = 0; i < 10; i++) playWeek(world);
    expect(costBurden(wp)).toBeGreaterThan(0.5);
    const sour = financeMood(wp);
    expect(sour).toBeLessThan(0);
    // Taking the bill over earns goodwill (what he already paid still stings).
    wp.client!.devFunding = 1;
    expect(financeMood(wp)).toBe(sour + 4);
    while (world.week <= seasonWeeks(world)) playWeek(world);
    finishSeason(world);
    expect(world.agency.ledger.development).toBe(winterCost(world, id, "camp"));
  });

  it("projects the best plan above his own and both above no coaching, up to his coaches' ceiling", () => {
    const world = createWorld({ seed: 1, scenario: "rookie" });
    const id = world.clientIds[0]!;
    const p = plans(world, id);
    const best = projectDevelopment(world, id, p.best);
    const basic = projectDevelopment(world, id, p.basic);
    const last = (x: typeof best) => x.levels[x.levels.length - 1]!.level;
    expect(last(best)).toBeGreaterThan(last(basic));
    expect(last(best)).toBeLessThanOrEqual(best.ceiling + 1e-9);
    const cost = developmentCost(world, id);
    expect(cost.total).toBe(cost.client + cost.agency);
    expect(payback(world, id, best, basic).extraEarnings).toBeGreaterThan(0);
  });
});
