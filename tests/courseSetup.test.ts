import { describe, expect, it } from "vitest";
import { REAL_COURSES, createRng, generateTourField, getCourse, simulateTournament, type Course } from "../src/engine";
import {
  asSetUp,
  createWorld,
  deserializeWorld,
  finishSeason,
  nextCourseSetup,
  playWeek,
  seasonVsReal,
  seasonWeeks,
  serializeWorld,
  setupNews,
  tallyRealScoring,
  type World,
} from "../src/season";

const real = REAL_COURSES[0]!;
const field = generateTourField(createRng(9), 60);
const play = (course: Course) => simulateTournament({ name: "Test", course, field, purse: 1_000_000, seed: 77 });
const perRound = (course: Course) => {
  const r = play(course);
  const rounds = r.leaderboard.flatMap((e) => e.rounds);
  return rounds.reduce((s, x) => s + x, 0) / rounds.length;
};

describe("course setup", () => {
  it("leaves the course alone at zero, and carries the setup otherwise", () => {
    expect(asSetUp({}, real)).toBe(real);
    expect(asSetUp({ courseSetup: 0.4 }, real).setup).toBe(0.4);
    expect(real.setup).toBeUndefined();
  });

  it("makes a course play about that many strokes a round harder", () => {
    const diff = perRound(asSetUp({ courseSetup: 1 }, real)) - perRound(real);
    expect(diff).toBeGreaterThan(0.8);
    expect(diff).toBeLessThan(1.2);
  });

  it("counts only real courses, against their real hole averages", () => {
    const world: { setupTally?: { strokes: number; rounds: number } } = {};
    tallyRealScoring(world, getCourse("harrow-pines"), play(getCourse("harrow-pines")));
    expect(world.setupTally).toBeUndefined();
    const result = play(real);
    tallyRealScoring(world, real, result);
    const avg = real.holes.reduce((s, h) => s + h.tourAverage!, 0);
    const rounds = result.leaderboard.flatMap((e) => e.rounds);
    expect(world.setupTally!.rounds).toBe(rounds.length);
    expect(seasonVsReal(world)).toBeCloseTo(rounds.reduce((s, x) => s + x, 0) / rounds.length - avg, 6);
  });

  it("moves the setup each winter by how far the season played from the real averages", () => {
    const easy = { courseSetup: 0.2, setupTally: { strokes: -300, rounds: 1000 } };
    expect(nextCourseSetup(easy)).toEqual({ from: 0.2, to: 0.5 });
    expect(easy.setupTally).toEqual({ strokes: 0, rounds: 0 });
    // A freak season moves it half a stroke at most, and no scoring leaves it where it was.
    expect(nextCourseSetup({ setupTally: { strokes: -2000, rounds: 1000 } })).toEqual({ from: 0, to: 0.5 });
    expect(nextCourseSetup({ courseSetup: 0.3 })).toEqual({ from: 0.3, to: 0.3 });
  });

  it("describes a real change in the season review and stays quiet about noise", () => {
    expect(setupNews({ from: 0.2, to: 0.5 })).toMatch(/0\.3 shots a round tougher/);
    expect(setupNews({ from: 0.5, to: 0.3 })).toMatch(/easier/);
    expect(setupNews({ from: 0.4, to: 0.43 })).toBeNull();
  });
});

describe("course setup in a career", () => {
  const base = createWorld({ seed: 31, scenario: "rookie" });
  const fresh = (): World => deserializeWorld(serializeWorld(base));

  it("starts a new career with the setup the warm-up season called for", () => {
    expect(base.courseSetup).toBeDefined();
    expect(Math.abs(base.courseSetup!)).toBeLessThan(1);
    expect(base.setupTally).toEqual({ strokes: 0, rounds: 0 });
  });

  it("tallies the season, then reports the winter's change in the review", () => {
    const w = fresh();
    while (w.week <= seasonWeeks(w)) playWeek(w);
    const vs = seasonVsReal(w)!;
    expect(w.setupTally!.rounds).toBeGreaterThan(5000);
    // A season on real courses plays close to the real averages once the setup is in.
    expect(Math.abs(vs)).toBeLessThan(0.4);
    const before = w.courseSetup!;
    const summary = finishSeason(w)!;
    expect(summary.courseSetup).toEqual({ from: before, to: Math.round((before - vs) * 100) / 100 });
    expect(w.courseSetup).toBe(summary.courseSetup!.to);
  });

  it("loads a save from before course setup, starting from zero", () => {
    const raw = JSON.parse(serializeWorld(base)) as Record<string, unknown>;
    delete raw.courseSetup;
    delete raw.setupTally;
    const w = deserializeWorld(JSON.stringify(raw));
    expect(w.courseSetup).toBeUndefined();
    playWeek(w);
    expect(w.setupTally!.rounds).toBeGreaterThan(0);
  });
});
