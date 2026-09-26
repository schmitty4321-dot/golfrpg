import { describe, expect, it } from "vitest";
import { SG_CATEGORIES, createRng, generateTourField, getCourse, simulateTournament, standingsAfterRound } from "../src/engine";
import { flatPlayer } from "./helpers";

const course = getCourse("harrow-pines");
const field = generateTourField(createRng(11), 156);
const run = (seed: number, cutTop: number | null = 65) =>
  simulateTournament({ name: "Test Open", course, field, purse: 9_000_000, seed, cutTop: cutTop ?? undefined });

describe("simulateTournament", () => {
  it("is reproducible from a seed", () => {
    const a = run(1);
    const b = run(1);
    expect(a.leaderboard.map((r) => [r.player.id, r.total])).toEqual(b.leaderboard.map((r) => [r.player.id, r.total]));
    expect(run(2).leaderboard.map((r) => r.total)).not.toEqual(a.leaderboard.map((r) => r.total));
  });

  it("sorts the leaderboard and labels ties", () => {
    const t = run(3);
    const made = t.leaderboard.filter((r) => r.madeCut);
    for (let i = 1; i < made.length; i++) expect(made[i]!.total).toBeGreaterThanOrEqual(made[i - 1]!.total);
    for (const r of made) {
      const tied = made.filter((x) => x.position === r.position).length;
      if (r.position === 1) expect(r.positionLabel).toBe("1");
      else expect(r.positionLabel).toBe(tied > 1 ? `T${r.position}` : `${r.position}`);
    }
  });

  it("makes the top 65 and ties play the weekend", () => {
    const t = run(4);
    const made = t.leaderboard.filter((r) => r.madeCut);
    const missed = t.leaderboard.filter((r) => !r.madeCut);
    expect(made.length).toBeGreaterThanOrEqual(65);
    for (const r of made) expect(r.rounds).toHaveLength(4);
    for (const r of missed) {
      expect(r.rounds).toHaveLength(2);
      expect(r.positionLabel).toBe("MC");
      expect(r.earnings).toBe(0);
      expect(r.toPar).toBeGreaterThan(t.cutLine!);
    }
  });

  it("plays everyone four rounds in a no-cut event", () => {
    const t = run(5, null);
    expect(t.cutLine).toBeNull();
    for (const r of t.leaderboard) expect(r.rounds).toHaveLength(4);
  });

  it("has exactly one winner, even after a playoff", () => {
    for (let seed = 0; seed < 40; seed++) {
      const t = run(seed);
      expect(t.leaderboard.filter((r) => r.position === 1)).toHaveLength(1);
      if (t.playoff) {
        expect(t.playoff.players.length).toBeGreaterThanOrEqual(2);
        expect(t.playoff.players).toContain(t.leaderboard[0]!.player.id);
      }
    }
  });

  it("pays everyone who makes the cut, going past the purse only for extra places", () => {
    for (let seed = 0; seed < 10; seed++) {
      const t = run(seed);
      const paid = t.leaderboard.reduce((s, r) => s + r.earnings, 0);
      const made = t.leaderboard.filter((r) => r.madeCut);
      for (const r of made) expect(r.earnings).toBeGreaterThan(0);
      const extraPlaces = Math.max(0, made.length - 65);
      expect(paid).toBeLessThanOrEqual(9_000_000 * (1 + extraPlaces * 0.0025) + 100);
    }
  });

  it("splits strokes gained so that it adds up to beating the field", () => {
    const t = run(6);
    for (const r of t.leaderboard) {
      const sum = SG_CATEGORIES.reduce((s, c) => s + r.sg[c], 0);
      expect(sum).toBeCloseTo(r.sgPerRound * r.rounds.length, 6);
    }
    // Round 1 strokes gained is zero-sum across the field.
    const avg = t.leaderboard.reduce((s, r) => s + r.rounds[0]!, 0) / t.leaderboard.length;
    const r1 = t.leaderboard.reduce((s, r) => s + (avg - r.rounds[0]!), 0);
    expect(Math.abs(r1)).toBeLessThan(1e-6);
  });

  it("lets the better player finish ahead far more often than not", () => {
    const star = flatPlayer("star", 17);
    const journeyman = flatPlayer("journeyman", 11);
    let starAhead = 0;
    for (let seed = 0; seed < 60; seed++) {
      const t = simulateTournament({ name: "H2H", course, field: [star, journeyman, ...field.slice(0, 40)], purse: 1_000_000, seed });
      const pos = (id: string) => t.leaderboard.find((r) => r.player.id === id)!.total;
      if (pos("star") < pos("journeyman")) starAhead++;
    }
    expect(starAhead).toBeGreaterThan(48);
  });

  it("produces tour-like scoring (a loose guard; see npm run calibrate)", () => {
    let rounds = 0, strokesVsPar = 0, doubles = 0, birdies = 0;
    for (let seed = 100; seed < 120; seed++) {
      for (const r of run(seed).leaderboard) {
        r.holes.forEach((card) => {
          rounds++;
          card.forEach((s, h) => {
            const d = s - course.holes[h]!.par;
            strokesVsPar += d;
            if (d === -1) birdies++;
            if (d >= 2) doubles++;
          });
        });
      }
    }
    expect(strokesVsPar / rounds).toBeGreaterThan(-1.5);
    expect(strokesVsPar / rounds).toBeLessThan(1.5);
    expect(birdies / rounds).toBeGreaterThan(3);
    expect(birdies / rounds).toBeLessThan(4.5);
    expect(doubles / rounds).toBeGreaterThan(0.15);
    expect(doubles / rounds).toBeLessThan(0.6);
  });
});

describe("standingsAfterRound", () => {
  const t = run(21);
  it("matches the final leaderboard after the last round", () => {
    const s = standingsAfterRound(t, 4);
    expect(s.map((r) => r.player.id)).toEqual(t.leaderboard.map((r) => r.player.id));
    expect(s.map((r) => r.positionLabel)).toEqual(t.leaderboard.map((r) => r.positionLabel));
  });

  it("orders by strokes so far, with ties and today's score", () => {
    for (const round of [1, 2, 3]) {
      const s = standingsAfterRound(t, round).filter((r) => r.active);
      for (let i = 1; i < s.length; i++) expect(s[i]!.total).toBeGreaterThanOrEqual(s[i - 1]!.total);
      for (const r of s) {
        expect(r.rounds).toHaveLength(round);
        expect(r.today).toBe(r.rounds[round - 1]);
        const tied = s.filter((x) => x.total === r.total).length;
        expect(r.positionLabel.startsWith("T")).toBe(tied > 1);
      }
    }
  });

  it("drops players who missed the cut to the bottom from round 3", () => {
    const s = standingsAfterRound(t, 3);
    const firstMc = s.findIndex((r) => !r.active);
    expect(firstMc).toBeGreaterThan(60);
    expect(s.slice(firstMc).every((r) => !r.active && r.positionLabel === "MC")).toBe(true);
  });

  it("reports movement from the previous round", () => {
    expect(standingsAfterRound(t, 1).every((r) => r.movement === null)).toBe(true);
    const s = standingsAfterRound(t, 2);
    expect(s.some((r) => (r.movement ?? 0) > 0)).toBe(true);
    expect(s.some((r) => (r.movement ?? 0) < 0)).toBe(true);
  });
});
