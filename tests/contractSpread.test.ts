import { describe, expect, it } from "vitest";
import { approachBlock, createWorld, rankMap, spreadStartingContracts } from "../src/season";

const top = (w: ReturnType<typeof createWorld>, n: number) =>
  [...rankMap(w)].filter(([, r]) => r <= n).map(([id]) => w.players[id]!).filter((wp) => !wp.client && wp.agent);

describe("starting contracts", () => {
  it("the top 150 have contracts from this season to four more, and only final-season players can be approached", () => {
    const w = createWorld({ seed: 11, scenario: "agency" });
    const players = top(w, 150);
    const left = players.map((wp) => wp.agent!.untilSeason - w.season);
    const final = left.filter((y) => y === 0).length;
    expect(final).toBeGreaterThan(players.length * 0.05);
    expect(final).toBeLessThan(players.length * 0.3);
    expect(left.some((y) => y >= 3)).toBe(true);
    expect(Math.max(...left)).toBeLessThanOrEqual(4);
    for (const wp of players) {
      const block = approachBlock(w, wp.player.id) ?? "";
      if (wp.agent!.untilSeason > w.season) expect(block).not.toBe("");
      else expect(block).not.toMatch(/under contract/);
    }
  });

  it("re-deals a first-season save's top contracts once", () => {
    const w = createWorld({ seed: 12, scenario: "agency" });
    const players = top(w, 150);
    for (const wp of players) wp.agent!.untilSeason = w.season;
    w.agency.contractsSpread = undefined;
    spreadStartingContracts(w);
    expect(players.filter((wp) => wp.agent!.untilSeason > w.season).length).toBeGreaterThan(players.length * 0.6);
    const after = players.map((wp) => wp.agent!.untilSeason);
    spreadStartingContracts(w);
    expect(players.map((wp) => wp.agent!.untilSeason)).toEqual(after);
  });
});
