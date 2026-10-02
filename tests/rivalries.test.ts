import { describe, expect, it } from "vitest";
import type { TournamentResult } from "../src/engine";
import { HOT, createWorld, recordRivalries, rivalriesOf, rivalryEdge, rivalryWeek, type TourEvent } from "../src/season";

const event = { id: "r01", name: "Sony Open in Hawaii", tier: "standard" } as TourEvent;

function result(world: ReturnType<typeof createWorld>, rows: { id: string; position: number; total: number; madeCut?: boolean }[], playoff?: string[]): TournamentResult {
  return {
    leaderboard: rows.map((r) => ({ player: world.players[r.id]!.player, position: r.position, total: r.total, madeCut: r.madeCut ?? true })),
    playoff: playoff ? { players: playoff, holesPlayed: 1 } : null,
  } as unknown as TournamentResult;
}

describe("rivalries", () => {
  it("start at a playoff, count the head-to-head and fade", () => {
    const w = createWorld({ seed: 71, scenario: "agency" });
    const me = w.clientIds[0]!;
    const other = Object.values(w.players).find((wp) => !wp.client && wp.career.status === "exempt")!.player.id;
    recordRivalries(w, event, result(w, [{ id: me, position: 1, total: 270 }, { id: other, position: 2, total: 270 }], [me, other]));
    let r = rivalriesOf(w, me)[0]!;
    expect(r.b).toBe(other);
    expect(r.heat).toBe(30 + 20 + 5); // playoff, Sunday duel, contending together
    expect(r.aWins).toBe(1);
    // Contending again, and this time the rival finishes ahead.
    recordRivalries(w, event, result(w, [{ id: other, position: 1, total: 265 }, { id: me, position: 3, total: 268 }]));
    r = rivalriesOf(w, me)[0]!;
    expect(r.bWins).toBe(1);
    expect(r.heat).toBeGreaterThanOrEqual(HOT);
    const heat = r.heat;
    rivalryWeek(w);
    expect(rivalriesOf(w, me)[0]!.heat).toBe(heat - 1);
  });

  it("gets to a fragile player and fires up a competitor when the rival is in the field", () => {
    const w = createWorld({ seed: 72, scenario: "agency" });
    const me = w.clientIds[0]!;
    const wp = w.players[me]!;
    const other = Object.values(w.players).find((x) => !x.client && x.career.status === "exempt")!.player.id;
    w.rivalries = [{ a: me, b: other, names: { a: "A", b: "B" }, heat: 80, aWins: 0, bWins: 0, since: 1 }];
    const field = new Set([me, other]);
    wp.player.traits = ["hothead"];
    expect(rivalryEdge(w, wp, field)).toBeLessThan(0);
    wp.player.traits = ["clutch-gene"];
    expect(rivalryEdge(w, wp, field)).toBeCloseTo(0.12);
    expect(rivalryEdge(w, wp, new Set([me]))).toBe(0);
  });
});
