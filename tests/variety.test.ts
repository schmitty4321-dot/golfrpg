import { describe, expect, it } from "vitest";
import { BREAKOUT_CHANCE, SLUMP_CHANCE, createWorld, drawSeasonForm, eventContext, nextGeneration } from "../src/season";

describe("variety between worlds and seasons", () => {
  it("gives each amateur class a generation strength that carries over", () => {
    const world = createWorld({ seed: 4, scenario: "rookie" });
    const gens: number[] = [];
    for (let s = 0; s < 30; s++) {
      world.season++;
      gens.push(nextGeneration(world));
    }
    expect(Math.max(...gens)).toBeGreaterThan(0.2);
    expect(Math.min(...gens)).toBeLessThan(-0.2);
    for (const g of gens) expect(Math.abs(g)).toBeLessThanOrEqual(0.9);
  });

  it("gives a few pros a breakout or a slump each season, felt in every event", () => {
    const world = createWorld({ seed: 4, scenario: "rookie" });
    drawSeasonForm(world);
    const pros = Object.values(world.players).filter((wp) => wp.career.status !== "amateur");
    const up = pros.filter((wp) => (wp.seasonForm?.sg ?? 0) > 0).length / pros.length;
    const down = pros.filter((wp) => (wp.seasonForm?.sg ?? 0) < 0).length / pros.length;
    expect(up).toBeGreaterThan(BREAKOUT_CHANCE / 3);
    expect(up).toBeLessThan(BREAKOUT_CHANCE * 3);
    expect(down).toBeGreaterThan(SLUMP_CHANCE / 3);
    const hot = pros.find((wp) => wp.seasonForm)!;
    expect(eventContext(world, world.schedule[0]!, hot.player.id).seasonForm).toBe(hot.seasonForm!.sg);
  });
});

describe("the Realism setting", () => {
  it("makes a lively world scatter more and break out more often; realistic stays the default", () => {
    const realistic = createWorld({ seed: 4, scenario: "rookie" });
    const lively = createWorld({ seed: 4, scenario: "rookie", style: "lively" });
    expect(realistic.style).toBeUndefined();
    expect(lively.style).toBe("lively");
    const id = Object.values(lively.players).find((wp) => wp.career.status === "exempt")!.player.id;
    expect(eventContext(realistic, realistic.schedule[0]!, id).scatter).toBeUndefined();
    expect(eventContext(lively, lively.schedule[0]!, id).scatter).toBeGreaterThan(1);
    drawSeasonForm(lively);
    const pros = Object.values(lively.players).filter((wp) => wp.career.status !== "amateur");
    expect(pros.filter((wp) => wp.seasonForm).length / pros.length).toBeGreaterThan(2 * (BREAKOUT_CHANCE + SLUMP_CHANCE) * 0.6);
  });
});
