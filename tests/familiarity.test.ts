import { describe, expect, it } from "vitest";
import { familiarityAfter, familiarityHole, familiarityLabel, familiarityRound } from "../src/engine";
import { createWorld, deserializeWorld, eventsInWeek, familiarityWith, fadeFamiliarity, playWeek, serializeWorld, type World } from "../src/season";

const base = createWorld({ seed: 33, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

describe("familiarity score", () => {
  it("grows with every round and more with good finishes, slower near the top", () => {
    expect(familiarityAfter(0, 4, 40, true)).toBe(12);
    expect(familiarityAfter(0, 2, 99, false)).toBe(6);
    expect(familiarityAfter(0, 4, 8, true)).toBeLessThan(familiarityAfter(0, 4, 3, true));
    expect(familiarityAfter(0, 4, 3, true)).toBeLessThan(familiarityAfter(0, 4, 1, true));
    expect(familiarityAfter(90, 4, 40, true) - 90).toBeLessThan(12);
    expect(familiarityAfter(0, 4, 40, true, true)).toBe(24);
    expect(familiarityAfter(99, 4, 1, true)).toBeLessThanOrEqual(100);
    expect(familiarityLabel(75)).toBe("Course expert");
  });

  it("builds up for everyone who plays an event, and fades a little for courses skipped", () => {
    const w = fresh();
    const course = eventsInWeek(w)[0]!.courseId;
    const before = new Map(Object.values(w.players).map((p) => [p.player.id, familiarityWith(p, course)]));
    const report = playWeek(w);
    const field = report.results[0]!.result.leaderboard.map((r) => r.player.id);
    for (const id of field) {
      // Familiarity tops out at 100: anyone already there stays there.
      const was = before.get(id)!;
      if (was >= 100) expect(familiarityWith(w.players[id]!, course)).toBe(100);
      else expect(familiarityWith(w.players[id]!, course)).toBeGreaterThan(was);
    }
    const someone = w.players[field[0]!]!;
    const other = Object.keys(someone.career.familiarity!).find((c) => c !== course && someone.career.familiarity![c]! > 5)!;
    const was = someone.career.familiarity![other]!;
    fadeFamiliarity(w);
    expect(someone.career.familiarity![other]).toBeCloseTo(was - 3, 5);
    expect(familiarityWith(someone, course)).toBeGreaterThan(before.get(someone.player.id)!);
  }, 60_000);

  it("starts veterans off knowing the tour's courses, rookies not", () => {
    const pros = Object.values(base.players).filter((p) => p.career.status === "exempt");
    const avg = (xs: typeof pros) => xs.reduce((s, p) => s + Object.values(p.career.familiarity ?? {}).reduce((a, b) => a + b, 0), 0) / Math.max(1, xs.length);
    expect(avg(pros.filter((p) => p.player.age >= 35))).toBeGreaterThan(avg(pros.filter((p) => p.player.age <= 24)) * 1.5);
  });
});

describe("on the course", () => {
  it("is local knowledge against the field's, and a debut costs a stroke-and-a-half in ten", () => {
    const expert = familiarityRound({ familiarity: 80, fieldFamiliarity: 30, debut: false }, 1);
    expect(expert.approach + expert.putting).toBeCloseTo(0.125);
    const average = familiarityRound({ familiarity: 30, fieldFamiliarity: 30, debut: false }, 1);
    expect(average.approach + average.putting).toBe(0);
    expect(familiarityRound({ familiarity: 0, fieldFamiliarity: 30, debut: true }, 1).strokes).toBeCloseTo(0.15);
    expect(familiarityRound({ familiarity: 0, fieldFamiliarity: 30, debut: true }, 2).strokes).toBe(0);
  });

  it("softens a tucked pin and the big numbers on holes with trouble", () => {
    const tucked = { mean: 0.1, blowup: 1.2 };
    const known = familiarityHole({ familiarity: 100, fieldFamiliarity: 30, debut: false }, 0.6, tucked);
    const stranger = familiarityHole({ familiarity: 0, fieldFamiliarity: 30, debut: true }, 0.6, tucked);
    expect(known.mean).toBeLessThan(stranger.mean);
    expect(known.blowup).toBeLessThan(stranger.blowup);
    // An easy pin stays easy: familiarity only takes the sting out of hard ones.
    expect(familiarityHole({ familiarity: 100, fieldFamiliarity: 30, debut: false }, 0, { mean: -0.05, blowup: 0.9 }).mean).toBe(-0.05);
  });
});
