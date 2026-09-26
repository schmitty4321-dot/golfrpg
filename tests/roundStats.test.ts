import { describe, expect, it } from "vitest";
import {
  COURSES,
  STAT_DEFS,
  addStats,
  createRng,
  emptyStats,
  eventStats,
  fieldRoundStats,
  generateTourField,
  rankStats,
  roundStats,
  simulateTournament,
  tendencies,
  describeTendencies,
  feetInches,
} from "../src/engine";
import { flatPlayer } from "./helpers";

const field = generateTourField(createRng(8), 144);
const t = simulateTournament({ name: "Stats Open", course: COURSES[0]!, field, purse: 1, seed: 4, cutTop: 65 });

describe("round stats", () => {
  it("agree with the scorecard", () => {
    for (const row of t.leaderboard.slice(0, 30)) {
      const s = roundStats(t, row, 0);
      expect(s.holes).toBe(18);
      expect(s.strokes).toBe(row.rounds[0]);
      expect(s.eagles + s.birdies + s.pars + s.bogeys + s.doublesOrWorse).toBe(18);
      expect(s.fairwayAttempts).toBe(COURSES[0]!.holes.filter((h) => h.par > 3).length);
      expect(s.fairwaysHit + s.missLeft + s.missRight).toBeLessThanOrEqual(s.fairwayAttempts);
      expect(s.gir).toBeLessThanOrEqual(18);
      expect(s.scrambleAttempts).toBe(18 - s.gir);
      expect(s.onePutts + s.threePutts).toBeLessThanOrEqual(18);
    }
  });

  it("look like tour golf across a field", () => {
    let tot = emptyStats();
    for (let r = 0; r < 4; r++) for (const s of fieldRoundStats(t, r).values()) tot = addStats(tot, s);
    const rounds = tot.holes / 18;
    const v = (key: string) => STAT_DEFS.find((d) => d.key === key)!.value(tot)!;
    expect(v("dd")).toBeGreaterThan(285);
    expect(v("dd")).toBeLessThan(315);
    expect(v("da")).toBeGreaterThan(50);
    expect(v("da")).toBeLessThan(70);
    expect(v("gir")).toBeGreaterThan(52);
    expect(v("gir")).toBeLessThan(75);
    expect(v("fromFairway")).toBeGreaterThan(v("fromRough") + 15);
    expect(v("goForIt")).toBeLessThan(65);
    expect(tot.putts / rounds).toBeGreaterThan(27.5);
    expect(tot.putts / rounds).toBeLessThan(31);
  });

  it("add up over an event", () => {
    const row = t.leaderboard[0]!;
    const total = eventStats(t, row, 3);
    expect(total.holes).toBe(72);
    expect(total.strokes).toBe(row.total);
  });

  it("rank a player against the field", () => {
    const stats = fieldRoundStats(t, 0);
    const [id, mine] = [...stats.entries()][0]!;
    const ranked = rankStats(mine, [...stats.values()]);
    const score = ranked.find((r) => r.def.key === "score")!;
    const better = [...stats.values()].filter((s) => s.toPar < mine.toPar).length;
    expect(score.rank).toBe(better + 1);
    expect(score.fieldSize).toBe(stats.size);
    expect(ranked.find((r) => r.def.key === "left")!.rank).toBeNull();
    void id;
  });
});

describe("formatting", () => {
  it("shows proximity in feet and inches", () => {
    expect(feetInches(28.4)).toBe(`28' 5"`);
    expect(feetInches(9.99)).toBe(`10' 0"`);
  });
});

describe("tendencies", () => {
  it("are fixed per player and described in words", () => {
    const p = flatPlayer("tendency-test", 12);
    expect(tendencies(p)).toEqual(tendencies(p));
    expect(describeTendencies(tendencies(p))).toHaveLength(5);
  });

  it("show up in the replays: a right-miss player misses right", () => {
    const players = Array.from({ length: 200 }, (_, i) => flatPlayer(`p${i}`, 12));
    const righty = players.find((p) => tendencies(p).missRight > 0.66)!;
    const lefty = players.find((p) => tendencies(p).missRight < 0.34)!;
    const misses = (p: typeof righty) => {
      let left = 0;
      let right = 0;
      for (let s = 0; s < 12; s++) {
        const tt = simulateTournament({ name: `T${s}`, course: COURSES[0]!, field: [p, ...field.slice(0, 20)], purse: 1, seed: s });
        const row = tt.leaderboard.find((r) => r.player.id === p.id)!;
        for (let r = 0; r < row.holes.length; r++) {
          const st = roundStats(tt, row, r);
          left += st.missLeft;
          right += st.missRight;
        }
      }
      return right / Math.max(1, left + right);
    };
    expect(misses(righty)).toBeGreaterThan(misses(lefty) + 0.15);
  });

  it("make aggressive players go for more par 5s", () => {
    const aggressive = flatPlayer("agg", 12, { aggression: 19, courseManagement: 8 });
    const careful = flatPlayer("safe", 12, { aggression: 5, courseManagement: 17 });
    expect(tendencies(aggressive).strategy).toBe("aggressive");
    expect(tendencies(careful).strategy).toBe("conservative");
    const attempts = (p: typeof aggressive) => {
      let n = 0;
      for (let s = 0; s < 10; s++) {
        const tt = simulateTournament({ name: `G${s}`, course: COURSES[0]!, field: [p, ...field.slice(0, 20)], purse: 1, seed: s });
        n += eventStats(tt, tt.leaderboard.find((r) => r.player.id === p.id)!, 3).goForItAttempts;
      }
      return n;
    };
    expect(attempts(aggressive)).toBeGreaterThan(attempts(careful));
  });
});
