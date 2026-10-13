import { describe, expect, it } from "vitest";
import { MAX_EXTRAS, buyLifestyle, createWorld, lifestyleBlock, lifestyleItem, lifestyleWeek, qRating, qTarget } from "../src/season";

describe("lifestyle", () => {
  it("buying an item charges the client, and a second home trades the first in for half", () => {
    const world = createWorld({ seed: 31, scenario: "agency" });
    const id = world.clientIds[0]!;
    const wp = world.players[id]!;
    buyLifestyle(world, id, "home-condo");
    expect(wp.client!.lifestyle).toEqual(["home-condo"]);
    expect(wp.client!.finances.lifestyle).toBe(lifestyleItem("home-condo")!.price);
    buyLifestyle(world, id, "home-coastal");
    expect(wp.client!.lifestyle).toEqual(["home-coastal"]);
    const condo = lifestyleItem("home-condo")!.price;
    const coastal = lifestyleItem("home-coastal")!.price;
    expect(wp.client!.finances.lifestyle).toBe(condo + coastal - Math.round(condo * 0.5));
  });

  it("two extras at most, and nothing he already owns twice", () => {
    const world = createWorld({ seed: 31, scenario: "agency" });
    const id = world.clientIds[0]!;
    buyLifestyle(world, id, "extra-watches");
    expect(lifestyleBlock(world, id, "extra-watches")).toMatch(/already owns/);
    buyLifestyle(world, id, "extra-yacht");
    expect(MAX_EXTRAS).toBe(2);
    expect(lifestyleBlock(world, id, "extra-yacht")).toMatch(/already owns/);
  });

  it("Q rating drifts toward what he owns, and upkeep is paid a fiftieth each week", () => {
    const world = createWorld({ seed: 31, scenario: "agency" });
    const id = world.clientIds[0]!;
    const wp = world.players[id]!;
    const start = qRating(world, wp);
    buyLifestyle(world, id, "home-estate");
    const target = qTarget(world, wp);
    expect(target).toBeGreaterThan(start);
    for (let i = 0; i < 40; i++) lifestyleWeek(world);
    expect(Math.abs(qRating(world, wp) - target)).toBeLessThan(1);
    const upkeep = lifestyleItem("home-estate")!.upkeep;
    const before = wp.client!.finances.lifestyle ?? 0;
    lifestyleWeek(world);
    expect((wp.client!.finances.lifestyle ?? 0) - before).toBe(Math.round(upkeep / 52));
  });
});
