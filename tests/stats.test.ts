import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  abilityView,
  ceilingEstimate,
  ceilingStars,
  createWorld,
  deserializeWorld,
  finishSeason,
  mixSeed,
  overall,
  playWeek,
  seasonWeeks,
  serializeWorld,
  statsRows,
  type World,
} from "../src/season";

const base = createWorld({ seed: 23, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

describe("season stats", () => {
  const w = fresh();
  for (let i = 0; i < 6; i++) playWeek(w);

  it("add up every main-tour round, and skip the developmental tour", () => {
    const rows = statsRows(w, "this");
    expect(rows.length).toBeGreaterThan(100);
    for (const { id, stats } of rows.slice(0, 40)) {
      const main = w.players[id]!.career.results.filter((r) => r.season === w.season && r.tier !== "dev");
      expect(stats.events).toBe(main.length);
      expect(stats.shots.holes).toBe(stats.rounds * 18);
      expect(stats.earnings).toBe(main.reduce((s, r) => s + r.earnings, 0));
      expect(stats.cuts).toBe(main.filter((r) => r.madeCut).length);
    }
    const devOnly = Object.entries(w.players).find(([, wp]) => wp.career.results.some((r) => r.season === w.season) && wp.career.results.every((r) => r.tier === "dev"));
    if (devOnly) expect(devOnly[1].career.stats).toBeUndefined();
  });

  it("look like tour golf", () => {
    const rows = statsRows(w, "this").filter((r) => r.stats.rounds >= 8);
    const s = rows.reduce(
      (a, r) => ({ yards: a.yards + r.stats.shots.driveYards, drives: a.drives + r.stats.shots.drives, putts: a.putts + r.stats.shots.putts, holes: a.holes + r.stats.shots.holes }),
      { yards: 0, drives: 0, putts: 0, holes: 0 },
    );
    expect(s.yards / s.drives).toBeGreaterThan(280);
    expect(s.yards / s.drives).toBeLessThan(320);
    expect(s.putts / (s.holes / 18)).toBeGreaterThan(27);
    expect(s.putts / (s.holes / 18)).toBeLessThan(31);
  });

  it("become last season's at the end of the season", () => {
    const v = fresh();
    while (v.week <= seasonWeeks(v)) playWeek(v);
    const before = new Map(statsRows(v, "this").map((r) => [r.id, r.stats]));
    finishSeason(v);
    expect(statsRows(v, "this")).toHaveLength(0);
    const last = statsRows(v, "last");
    // Everyone still in the world keeps their line (retired players leave with theirs).
    expect(last.length).toBe([...before.keys()].filter((id) => v.players[id]).length);
    for (const r of last) expect(r.stats).toEqual(before.get(r.id));
  });

  it("survive a save and load", () => {
    const again = deserializeWorld(serializeWorld(w));
    expect(statsRows(again, "this")).toEqual(statsRows(w, "this"));
  });
});

describe("ability view", () => {
  it("shows the exact current level and the coaches' estimate of his ceiling", () => {
    const w = fresh();
    const v = abilityView(w, "client");
    const wp = w.players.client!;
    expect(v.current).toBeCloseTo(overall(wp.player));
    expect(v.potential).toBeGreaterThanOrEqual(v.current);
    // The same estimate the Training tab shows as stars.
    const stars = ceilingEstimate(wp, v.coachQuality, createRng(mixSeed(w.seed, w.season, 77)));
    if (v.potential > v.current) expect(ceilingStars(v.potential)).toBe(stars);
  });
});
