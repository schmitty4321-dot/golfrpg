import { describe, expect, it } from "vitest";
import { RECRUITING_CLOSES, actionBlock, recruitingCountdown, amateurRanking, createWorld, onShortlist, playWeek, prospects, recruit, recruitingWindow, standingMove, standingOrder, toggleShortlist, type World } from "../src/season";

const amateurs = (w: World): string[] => Object.values(w.players).filter((p) => p.career.status === "amateur").map((p) => p.player.id);

describe("amateur weekly results", () => {
  it("before any event, the standing is the preseason ranking", () => {
    const w = createWorld({ seed: 31, scenario: "agency" });
    expect(standingOrder(w)).toEqual(amateurRanking(w));
  });

  it("each week the whole field plays one event: a finish for everyone, one winner, and a record", () => {
    const w = createWorld({ seed: 31, scenario: "agency" });
    playWeek(w);
    const ev = w.amateurEvent!;
    expect(new Set(ev.finishes)).toEqual(new Set(amateurs(w)));
    expect(ev.field).toBe(amateurs(w).length);
    for (const id of amateurs(w)) expect(w.amateurRecords![id]!.events).toBe(1);
    expect(ev.finishes.reduce((n, id) => n + w.amateurRecords![id]!.wins, 0)).toBe(1);
  });

  it("the first week has no arrows, and from the second the movements net to zero across the field", () => {
    const w = createWorld({ seed: 31, scenario: "agency" });
    playWeek(w);
    expect(standingMove(w, amateurs(w)[0]!)).toBeNull();
    playWeek(w);
    const moves = amateurs(w).map((id) => standingMove(w, id));
    expect(moves.every((m) => m !== null)).toBe(true);
    expect((moves as number[]).reduce((a, b) => a + b, 0)).toBe(0);
    expect(moves.some((m) => m !== 0)).toBe(true);
  });
});

describe("recruiting window", () => {
  it("is shut before week 10, open from week 10 to week 32, and shut after", () => {
    const w = createWorld({ seed: 31, scenario: "agency" });
    w.week = 9;
    expect(recruitingWindow(w)).toMatch(/opens in week 10/);
    w.week = 10;
    expect(recruitingWindow(w)).toBeNull();
    w.week = RECRUITING_CLOSES;
    expect(recruitingWindow(w)).toBeNull();
    w.week = RECRUITING_CLOSES + 1;
    expect(recruitingWindow(w)).toMatch(/closed after week 32/);
    w.week = 1;
    expect(recruitingCountdown(w)).toBe("9 weeks until recruiting starts");
    w.week = 10;
    expect(recruitingCountdown(w)).toBe("22 weeks until recruiting ends");
    w.week = RECRUITING_CLOSES;
    expect(recruitingCountdown(w)).toMatch(/Last week of recruiting/);
  });

  it("blocks recruiting actions while shut, but the board stays open to watch", () => {
    const w = createWorld({ seed: 31, scenario: "agency" });
    w.week = 5;
    const id = prospects(w)[0]!;
    expect(actionBlock(w, id, "call")).toMatch(/opens in week 10/);
    expect(() => recruit(w, id, "call")).toThrow(/opens in week 10/);
    toggleShortlist(w, id);
    expect(onShortlist(w, id)).toBe(true);
  });
});
