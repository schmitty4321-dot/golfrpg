import { describe, expect, it } from "vitest";
import { careerLines, createWorld, finishSeason, playWeek, rollingSg, seasonWeeks, tourPercentiles } from "../src/season";

describe("profile charts", () => {
  const world = createWorld({ seed: 11, scenario: "rookie" });
  const pros = Object.values(world.players).filter((wp) => wp.career.status === "exempt");

  it("logs every pro's warm-up season for the career chart", () => {
    const logged = pros.filter((wp) => (wp.career.seasonLog ?? []).some((l) => l.season === 0));
    expect(logged.length / pros.length).toBeGreaterThan(0.9);
    const line = logged[0]!.career.seasonLog!.find((l) => l.season === 0)!;
    expect(line.overall).toBeGreaterThan(5);
    expect(line.events).toBeGreaterThan(0);
  });

  it("ranks a regular in each part of the game, and the rolling line follows his events", () => {
    for (let i = 0; i < 8; i++) playWeek(world);
    const regular = pros.find((wp) => tourPercentiles(world, wp.player.id))!;
    const p = tourPercentiles(world, regular.player.id)!;
    expect(p.rows.map((r) => r.category)).toEqual(["total", "offTheTee", "approach", "aroundTheGreen", "putting"]);
    for (const r of p.rows) {
      expect(r.rank).toBeGreaterThanOrEqual(1);
      expect(r.rank).toBeLessThanOrEqual(p.pool);
      expect(r.percentile).toBeGreaterThanOrEqual(0);
      expect(r.percentile).toBeLessThanOrEqual(100);
    }
    const pts = rollingSg(regular);
    expect(pts.length).toBe(regular.career.results.length);
    // The first point is just that event; later ones average the last few.
    expect(pts[0]!.rolling).toBeCloseTo(pts[0]!.sg, 6);
  });

  it("adds the season in progress, then keeps it when the season closes", () => {
    const client = world.players[world.clientIds[0]!]!;
    expect(careerLines(world, client).at(-1)!.current).toBe(true);
    while (world.week <= seasonWeeks(world)) playWeek(world);
    const season = world.season;
    finishSeason(world);
    const lines = careerLines(world, client);
    expect(lines.find((l) => l.season === season)?.current).toBe(false);
    expect(lines.at(-1)!.season).toBe(season + 1);
  });
});
