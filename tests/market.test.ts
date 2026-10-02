import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  RIVAL_AGENCIES,
  abilityView,
  acceptChance,
  agencyTable,
  createWorld,
  hireStaffer,
  playWeek,
  rivalPoaching,
  shortlistAlerts,
  sponsorBoost,
  staffMarket,
  toggleShortlist,
} from "../src/season";

describe("agency staff", () => {
  it("offers 100 persistent candidates across every role and rating tier", () => {
    const world = createWorld({ seed: 22, scenario: "rookie" });
    const market = staffMarket(world);
    expect(market).toHaveLength(100);
    for (const role of ["agent", "analyst", "marketing", "lawyer"]) {
      const candidates = market.filter((staffer) => staffer.role === role);
      expect(candidates).toHaveLength(25);
      expect(Math.min(...candidates.map((staffer) => staffer.quality))).toBeLessThanOrEqual(6);
      expect(Math.max(...candidates.map((staffer) => staffer.quality))).toBeGreaterThanOrEqual(18);
    }
    expect(new Set(market.map((staffer) => staffer.name)).size).toBe(100);
    expect(staffMarket(world)).toEqual(market);
  });

  it("an agent wins signings, marketing lifts sponsor offers, an analyst sharpens ceilings, and they are paid weekly", () => {
    const world = createWorld({ seed: 2, scenario: "rookie" });
    const target = Object.values(world.players).find((wp) => !wp.client && wp.career.status === "conditional")!;
    const before = acceptChance(world, target.player.id, { commission: 0.1, years: 2 });
    const best = (role: string) => staffMarket(world).filter((s) => s.role === role).sort((a, b) => b.quality - a.quality)[0]!;
    hireStaffer(world, best("agent").id);
    expect(acceptChance(world, target.player.id, { commission: 0.1, years: 2 })).toBeGreaterThan(before);
    expect(sponsorBoost(world)).toBe(1);
    hireStaffer(world, best("marketing").id);
    expect(sponsorBoost(world)).toBeGreaterThan(1);
    hireStaffer(world, best("analyst").id);
    expect(abilityView(world, world.clientIds[0]!).coachQuality).toBe(best("analyst").quality);
    playWeek(world);
    expect(world.agency.ledger.staff).toBe(best("agent").weeklyFee + best("marketing").weeklyFee + best("analyst").weeklyFee);
  });
});

describe("recruitment board and rivals", () => {
  it("keeps a board and reports free agents at season end", () => {
    const world = createWorld({ seed: 2, scenario: "rookie" });
    const free = Object.values(world.players).find((wp) => !wp.client && !wp.agent && wp.career.status !== "amateur")!;
    toggleShortlist(world, free.player.id);
    expect(world.agency.shortlist).toEqual([free.player.id]);
    expect(shortlistAlerts(world).join(" ")).toContain(free.player.name);
    toggleShortlist(world, free.player.id);
    expect(world.agency.shortlist).toEqual([]);
  });

  it("ranks every agency, and an unhappy client can be poached for a buyout", () => {
    const world = createWorld({ seed: 2, scenario: "rookie" });
    const table = agencyTable(world);
    expect(table.length).toBe(RIVAL_AGENCIES.length + 1);
    expect(table.some((r) => r.yours && r.clients === 1)).toBe(true);
    const id = world.clientIds[0]!;
    world.players[id]!.client!.happiness = 10;
    world.players[id]!.client!.contract.untilSeason = world.season + 2;
    let gone = false;
    for (let s = 1; s < 40 && !gone; s++) {
      rivalPoaching(world, createRng(s));
      gone = !world.clientIds.includes(id);
    }
    expect(gone).toBe(true);
    expect(world.agency.ledger.buyouts).toBeGreaterThan(0);
    expect(world.players[id]!.agent).not.toBeNull();
  });
});
