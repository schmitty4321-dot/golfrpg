import { describe, expect, it } from "vitest";
import { getCourse, coursePar } from "../src/engine";
import {
  COURSE_DB_FORMAT,
  PLAYER_DB_FORMAT,
  courseReport,
  createPlayer,
  createWorld,
  deserializeWorld,
  duplicateCourse,
  editEvent,
  editPlayer,
  eventsAt,
  exportCourses,
  exportPlayers,
  importCourses,
  newCourse,
  parsePlayerDatabase,
  playWeek,
  saveCourse,
  serializeWorld,
  validateCourse,
  type World,
} from "../src/season";

const base = createWorld({ seed: 51, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

describe("course editor", () => {
  it("accepts every course the game ships with", () => {
    for (const c of base.courses) expect(validateCourse(c)).toEqual([]);
  });

  it("explains what's wrong with a broken course", () => {
    const c = structuredClone(getCourse("harrow-pines"));
    c.holes[0]!.yards = 900;
    c.holes[1]!.par = 6 as 5;
    c.greenSpeed = 20;
    c.name = " ";
    const errors = validateCourse(c);
    expect(errors.some((e) => e.startsWith("Hole 1"))).toBe(true);
    expect(errors.some((e) => e.startsWith("Hole 2"))).toBe(true);
    expect(errors.some((e) => e.includes("Green speed"))).toBe(true);
    expect(errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("saves an edited course, which then plays differently", () => {
    const w = fresh();
    const c = structuredClone(w.courses.find((x) => x.id === "marisol-bay")!);
    const before = courseReport(c).scoringVsPar;
    for (const h of c.holes) {
      h.hazard = 0.9;
      if (h.par > 3) h.fairwayWidth = 18;
    }
    c.greenSpeed = 14;
    expect(saveCourse(w, c)).toEqual([]);
    expect(w.edited).toBe(true);
    expect(courseReport(w.courses.find((x) => x.id === "marisol-bay")!).scoringVsPar).toBeGreaterThan(before + 2);
  });

  it("rejects a broken course without changing the world", () => {
    const w = fresh();
    const c = structuredClone(w.courses[0]!);
    c.holes = c.holes.slice(0, 9);
    expect(saveCourse(w, c).length).toBeGreaterThan(0);
    expect(w.courses[0]!.holes).toHaveLength(18);
    expect(w.edited).toBeFalsy();
  });

  it("creates and duplicates courses with fresh ids", () => {
    const w = fresh();
    const c = newCourse(w, "links", "Seabreeze Links");
    expect(saveCourse(w, c)).toEqual([]);
    const copy = duplicateCourse(w, c.id);
    expect(copy.id).not.toBe(c.id);
    expect(saveCourse(w, copy)).toEqual([]);
    expect(new Set(w.courses.map((x) => x.id)).size).toBe(w.courses.length);
  });

  it("reports what a course rewards", () => {
    const long = courseReport(getCourse("saguaro-wells"));
    const short = courseReport(getCourse("marisol-bay"));
    expect(long.demands.distance).toBeGreaterThan(short.demands.distance);
    expect(long.par).toBe(coursePar(getCourse("saguaro-wells")));
  });
});

describe("calendar editor", () => {
  it("moves an event to a new venue, which hosts it from then on", () => {
    const w = fresh();
    const c = newCourse(w, "parkland", "My Home Club");
    saveCourse(w, c);
    const event = w.schedule.find((e) => e.week === 1 && e.tier === "standard")!;
    expect(editEvent(w, event.id, { courseId: c.id, name: "The Home Club Open", purse: 12_000_000 })).toEqual([]);
    expect(eventsAt(w, c.id).map((e) => e.id)).toEqual([event.id]);
    const r = playWeek(w);
    const played = r.results.find((x) => x.event.id === event.id)!;
    expect(played.result.course.id).toBe(c.id);
    expect(played.event.name).toBe("The Home Club Open");
    expect(played.result.leaderboard[0]!.earnings).toBe(Math.round(12_000_000 * 0.18));
  });

  it("refuses silly purses and unknown venues", () => {
    const w = fresh();
    const id = w.schedule[0]!.id;
    expect(editEvent(w, id, { purse: 5 }).length).toBe(1);
    expect(editEvent(w, id, { courseId: "nowhere" }).length).toBe(1);
    expect(editEvent(w, id, { name: "  " }).length).toBe(1);
  });
});

describe("player editor", () => {
  it("edits attributes, age and ceiling, and validates them", () => {
    const w = fresh();
    const id = Object.keys(w.players)[5]!;
    expect(editPlayer(w, id, { attributes: { drivingDistance: 20 }, age: 30, potential: 16 })).toEqual([]);
    expect(w.players[id]!.player.attributes.drivingDistance).toBe(20);
    expect(w.players[id]!.development.potential).toBe(16);
    expect(editPlayer(w, id, { attributes: { drivingDistance: 21 } }).length).toBe(1);
    expect(editPlayer(w, id, { age: 90 }).length).toBe(1);
    const other = Object.values(w.players)[6]!.player.name;
    expect(editPlayer(w, id, { name: other })).toEqual(["Another player already has that name."]);
  });

  it("creates a new player who then plays", () => {
    const w = fresh();
    const { id, errors } = createPlayer(w, { name: "Ace Newcomer", status: "exempt", attributes: { midIrons: 18, shortPutts: 18 } });
    expect(errors).toEqual([]);
    expect(w.players[id!]!.career.status).toBe("exempt");
    let played = false;
    for (let i = 0; i < 6 && !played; i++) played = playWeek(w).results.some((r) => r.field.field.includes(id!));
    expect(played).toBe(true);
  });
});

describe("sharing databases", () => {
  it("round-trips the player database", () => {
    const json = exportPlayers(base);
    const { players, errors } = parsePlayerDatabase(json);
    expect(errors).toEqual([]);
    expect(players).toHaveLength(Object.keys(base.players).length);
  });

  it("fills in missing attributes and skips bad entries", () => {
    const json = JSON.stringify({
      format: PLAYER_DB_FORMAT,
      version: 1,
      players: [{ name: "Short File", age: 25, attributes: { drivingDistance: 18 } }, { age: 30 }, { name: "Short File" }],
    });
    const { players, errors } = parsePlayerDatabase(json);
    expect(players).toHaveLength(1);
    expect(players[0]!.attributes.drivingDistance).toBe(18);
    expect(players[0]!.attributes.wedges).toBe(12);
    expect(errors).toHaveLength(2);
    expect(parsePlayerDatabase("not json").errors).toHaveLength(1);
  });

  it("starts a new world from a database, topping it up to full fields", () => {
    const db = [
      { name: "Real Star", nationality: "USA", age: 28, peakAge: 31, potential: 17, grassPreference: "bentgrass" as const, styleComfort: { links: 12, parkland: 12, desert: 12, resort: 12 }, attributes: Object.fromEntries(Object.keys(base.players.client!.player.attributes).map((k) => [k, 18])) as never },
      { name: "Young Gun", nationality: "Korea", age: 18, peakAge: 30, status: "amateur" as const, grassPreference: "bentgrass" as const, styleComfort: { links: 12, parkland: 12, desert: 12, resort: 12 }, attributes: Object.fromEntries(Object.keys(base.players.client!.player.attributes).map((k) => [k, 10])) as never },
    ];
    const w = createWorld({ seed: 52, scenario: "rookie", database: db });
    const star = Object.values(w.players).find((wp) => wp.player.name === "Real Star")!;
    const gun = Object.values(w.players).find((wp) => wp.player.name === "Young Gun")!;
    expect(star.career.status).toBe("exempt");
    expect(star.career.careerWins).toBeGreaterThan(0);
    expect(gun.career.status).toBe("amateur");
    const pros = Object.values(w.players).filter((wp) => wp.career.status !== "amateur").length;
    expect(pros).toBeGreaterThan(300);
  });

  it("exports and imports courses", () => {
    const w = fresh();
    const json = exportCourses(w, ["harrow-pines"]);
    expect(JSON.parse(json).format).toBe(COURSE_DB_FORMAT);
    const { added, errors } = importCourses(w, json);
    expect(errors).toEqual([]);
    expect(added).toEqual(["Harrow Pines"]);
    expect(w.courses.filter((c) => c.name === "Harrow Pines")).toHaveLength(2);
    expect(importCourses(w, JSON.stringify({ format: "nope" })).errors).toHaveLength(1);
  });
});
