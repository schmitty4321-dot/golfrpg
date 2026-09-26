import { describe, expect, it } from "vitest";
import { COURSES, REAL_COURSES, coursePar, createRng, generateTourField, getCourse, simulateTournament } from "../src/engine";
import { adoptRealTour, buildTour, createWorld, deserializeWorld, majorSetup, seasonWeeks, serializeWorld } from "../src/season";

describe("real courses", () => {
  it("have 18 holes with real pars and yardages", () => {
    const augusta = getCourse("augusta-national");
    expect(coursePar(augusta)).toBe(72);
    expect(augusta.holes.map((h) => h.par)).toEqual([4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4]);
    expect(augusta.holes[11]!.yards).toBeLessThan(170); // Golden Bell
    expect(getCourse("tpc-sawgrass").holes[16]!.par).toBe(3); // the island green
    for (const c of REAL_COURSES) {
      expect(c.holes).toHaveLength(18);
      expect(c.info?.city).toBeTruthy();
    }
  });

  it("play to their real scoring averages", () => {
    const course = getCourse("shinnecock-hills");
    const real = course.holes.reduce((s, h) => s + h.tourAverage!, 0);
    let total = 0;
    let rounds = 0;
    for (let e = 0; e < 6; e++) {
      const t = simulateTournament({ name: `S${e}`, course, field: generateTourField(createRng(e), 144), purse: 1, seed: 90 + e });
      for (const row of t.leaderboard) for (const r of row.rounds) (total += r), rounds++;
    }
    expect(Math.abs(total / rounds - real)).toBeLessThan(0.35);
    const easy = getCourse("tpc-river-highlands");
    expect(easy.holes.reduce((s, h) => s + h.tourAverage!, 0) - coursePar(easy)).toBeLessThan(real - coursePar(course));
  });

  it("aren't toughened again for majors (the real numbers are major numbers)", () => {
    expect(majorSetup(getCourse("augusta-national"))).toEqual(getCourse("augusta-national"));
    expect(majorSetup(COURSES[0]!).greenSpeed).toBe(COURSES[0]!.greenSpeed + 1);
  });

  it("credit every photo", () => {
    for (const c of REAL_COURSES) {
      const p = c.info?.photo;
      if (!p) continue;
      expect(p.file).toMatch(/^courses\/.+\.jpg$/);
      expect(p.license).toBeTruthy();
      // Wikimedia Commons photos, or public-domain USGS aerials for US courses.
      expect(p.page).toMatch(/^https:\/\/(commons\.wikimedia\.org|apps\.nationalmap\.gov)\//);
      if (p.page.includes("nationalmap")) expect(p.license).toBe("Public domain");
    }
  });
});

describe("the real tour", () => {
  it("puts every event on a real venue", () => {
    const { schedule } = buildTour(3);
    for (const e of schedule.filter((x) => x.tier !== "dev")) expect(REAL_COURSES.some((c) => c.id === e.courseId)).toBe(true);
  });

  it("moves an older career onto it at the start of the next season", () => {
    const w = deserializeWorld(serializeWorld(createWorld({ seed: 5, scenario: "rookie" })));
    // An old calendar: the fictional events, 36 weeks.
    w.schedule = w.schedule.map((e) => ({ ...e, id: e.id.replace(/^r/, "e"), week: Math.min(e.week, 36) }));
    adoptRealTour(w);
    expect(w.schedule.some((e) => e.id === "r01" && e.name === "Sony Open in Hawaii")).toBe(true);
    expect(seasonWeeks(w)).toBe(41);
    expect(w.news[0]).toMatch(/real schedule/);
  });
});
