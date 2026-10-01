import { describe, expect, it } from "vitest";
import { REAL_COURSES, createRng, generatePlayer, holesWon, playMatch, type Player } from "../src/engine";
import {
  createWorld,
  finishSeason,
  isRyderCupSeason,
  playWeek,
  ryderCupWeek,
  ryderPoints,
  ryderStandings,
  seasonWeeks,
  seedOrder,
  selectTeam,
  simulateMatchPlay,
  yearOf,
  type World,
} from "../src/season";

const course = REAL_COURSES[0]!;
const golfer = (seed: number, id: string): Player => ({ ...generatePlayer(createRng(seed), { tier: "tour" }), id });

describe("a match", () => {
  it("ends once it is decided, and its margin agrees with the holes", () => {
    for (let s = 1; s <= 40; s++) {
      const m = playMatch({ course, a: [golfer(s, "a")], b: [golfer(s + 100, "b")], format: "singles", rng: createRng(s) });
      const won = holesWon(m);
      if (m.winner === null) {
        expect(m.margin).toBe("Halved");
        expect(won.a).toBe(won.b);
        expect(m.holes).toHaveLength(18);
        continue;
      }
      const lead = Math.abs(won.a - won.b);
      const left = 18 - m.holes.length;
      expect(lead).toBeGreaterThan(left);
      expect(m.margin).toBe(left === 0 ? `${lead} up` : `${lead}&${left}`);
      expect(won[m.winner]).toBeGreaterThan(won[m.winner === "a" ? "b" : "a"]);
    }
  });

  it("goes to extra holes in a knockout, and sudden death starts from the 1st", () => {
    let extra = 0;
    for (let s = 1; s <= 60; s++) {
      const m = playMatch({ course, a: [golfer(s, "a")], b: [golfer(s, "b")], format: "singles", rng: createRng(s), extraHoles: true });
      expect(m.winner).not.toBeNull();
      if (m.holes.length > 18) extra++;
    }
    expect(extra).toBeGreaterThan(0);
    const sd = playMatch({ course, a: [golfer(3, "a")], b: [golfer(4, "b")], format: "singles", rng: createRng(9), suddenDeath: true });
    expect(sd.winner).not.toBeNull();
    expect(sd.margin).toMatch(/^\d+(st|nd|rd|th) hole$/);
    expect(sd.holes.at(-1)!.a).not.toBe(sd.holes.at(-1)!.b);
  });

  it("plays four-balls on the better ball and foursomes as one ball", () => {
    const fs = playMatch({ course, a: [golfer(1, "a1"), golfer(2, "a2")], b: [golfer(3, "b1"), golfer(4, "b2")], format: "foursomes", rng: createRng(5) });
    expect(fs.a).toEqual(["a1", "a2"]);
    expect(fs.b).toEqual(["b1", "b2"]);
    // Better-ball scores beat one ball's on average.
    const avg = (m: typeof fs) => m.holes.reduce((t, h) => t + h.a + h.b, 0) / m.holes.length;
    let fbSum = 0;
    let fsSum = 0;
    for (let s = 1; s <= 30; s++) {
      const a = [golfer(s, "a1"), golfer(s + 1, "a2")];
      const b = [golfer(s + 2, "b1"), golfer(s + 3, "b2")];
      fbSum += avg(playMatch({ course, a, b, format: "fourball", rng: createRng(s) }));
      fsSum += avg(playMatch({ course, a, b, format: "foursomes", rng: createRng(s) }));
    }
    expect(fbSum).toBeLessThan(fsSum);
  });
});

describe("the Match Play Championship", () => {
  it("draws 16 groups of four, then a seeded bracket to one winner, paying the purse once", () => {
    const field = Array.from({ length: 64 }, (_, i) => golfer(i + 1, `p${i + 1}`));
    const seeds = new Map(field.map((p, i) => [p.id, i + 1]));
    const r = simulateMatchPlay({ name: "Match Play", course, field, purse: 20_000_000, seed: 7, tier: "signature" }, seeds);
    const b = r.bracket!;
    expect(b.groups).toHaveLength(16);
    // One seed from each band of 16 in every group.
    for (const g of b.groups) expect(g.players.map((id) => Math.ceil(seeds.get(id)! / 16)).sort()).toEqual([1, 2, 3, 4]);
    expect(b.knockout.map((x) => x.name)).toEqual(["Round of 16", "Quarter-finals", "Semi-finals", "Final"]);
    expect(b.knockout[0]!.matches.every((m) => m.winner && m.b.length === 1)).toBe(true);
    const places = r.leaderboard.map((x) => x.positionLabel);
    expect(places.slice(0, 4)).toEqual(["1", "2", "3", "4"]);
    expect(places.filter((x) => x === "T5")).toHaveLength(4);
    expect(places.filter((x) => x === "T9")).toHaveLength(8);
    expect(places.filter((x) => x === "T17")).toHaveLength(16);
    expect(r.leaderboard).toHaveLength(64);
    const paid = r.leaderboard.reduce((t, x) => t + x.earnings, 0);
    expect(paid).toBeGreaterThan(19_900_000);
    expect(paid).toBeLessThanOrEqual(20_000_000);
    expect(seedOrder(16).slice(0, 4)).toEqual([1, 16, 8, 9]);
  });

  it("is on the calendar, gets a full field, and leaves a bracket and a headline", () => {
    const w = createWorld({ seed: 21, scenario: "agency" });
    const event = w.schedule.find((e) => e.format === "matchplay")!;
    expect(event).toBeDefined();
    let size = 0;
    while (w.week <= event.week) {
      const rep = playWeek(w);
      const mp = rep.results.find((x) => x.event.id === event.id);
      if (mp) size = mp.field.field.length;
    }
    expect(size).toBe(64);
    expect(w.lastBracket?.eventId).toBe(event.id);
    expect(w.news.some((n) => n.includes("in the final to win the Match Play Championship"))).toBe(true);
  });
});

describe("Ryder Cup points", () => {
  const r = (tier: string, eventName: string, position: number, madeCut = true) => ({ tier: tier as never, eventName, position, madeCut });

  it("use the 2027 US table, split ties, and leave out opposite-field events", () => {
    expect(ryderPoints("USA", r("major", "Masters", 1))).toBe(3000);
    expect(ryderPoints("USA", r("standard", "THE PLAYERS Championship", 2))).toBe(1734);
    expect(ryderPoints("USA", r("signature", "Memorial", 3))).toBe(864);
    expect(ryderPoints("USA", r("standard", "Sony Open", 70))).toBe(6);
    expect(ryderPoints("USA", r("standard", "Sony Open", 71))).toBe(0);
    expect(ryderPoints("USA", r("major", "Masters", 60, false))).toBe(10);
    expect(ryderPoints("USA", r("opposite", "Puerto Rico Open", 1))).toBe(0);
    expect(ryderPoints("USA", r("standard", "Sony Open", 1), 2)).toBe((1500 + 909) / 2);
    expect(ryderPoints("USA", r("finale", "TOUR Championship", 1))).toBe(0);
    expect(ryderPoints("Europe", r("major", "Masters", 1))).toBe(5000);
    expect(ryderPoints("Europe", r("opposite", "Puerto Rico Open", 1))).toBe(1000);
  });

  it("build through the year, pick twelve, and play a 28-point match in odd years", () => {
    expect(yearOf(1)).toBe(2026);
    expect(isRyderCupSeason(0)).toBe(false); // the warm-up keeps 2025's real result
    expect(isRyderCupSeason(2)).toBe(true);
    const w: World = createWorld({ seed: 22, scenario: "agency" });
    while (w.week <= seasonWeeks(w)) playWeek(w);
    finishSeason(w);
    expect(w.season).toBe(2);
    while (w.week < ryderCupWeek(w)) playWeek(w);
    const usa = ryderStandings(w, "USA");
    expect(usa.length).toBeGreaterThan(20);
    for (let i = 1; i < usa.length; i++) expect(usa[i - 1]!.points).toBeGreaterThanOrEqual(usa[i]!.points);
    const team = selectTeam(w, "USA");
    expect(team.automatic).toHaveLength(6);
    expect(team.picks).toHaveLength(6);
    expect(team.automatic).toEqual(usa.filter((x) => !w.players[x.id]!.injury).slice(0, 6).map((x) => x.id));
    const rep = playWeek(w);
    // The teams sit out the week's other events.
    const twelve = new Set([...team.automatic, ...team.picks]);
    for (const x of rep.results) for (const id of x.field.field) expect(twelve.has(id)).toBe(false);
    const cup = w.ryderCup!.history.at(-1)!;
    expect(cup.season).toBe(2);
    expect(cup.score.USA + cup.score.Europe).toBe(28);
    expect(cup.sessions.map((s) => s.matches.length)).toEqual([4, 4, 4, 4, 12]);
    // Europe hold it at the start, so they keep it on 14-14.
    expect(cup.winner).toBe(cup.score.USA > 14 ? "USA" : "Europe");
    expect(w.ryderCup!.holder).toBe(cup.winner);
  });
});
