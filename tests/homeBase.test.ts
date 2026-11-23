import { describe, expect, it } from "vitest";
import { getCourse, traitRoundEffects } from "../src/engine";
import {
  HOME_CITY_BY_ID,
  buyLifestyle,
  createWorld,
  defaultHomeCity,
  deserializeWorld,
  homeCityOf,
  homeCrowd,
  homeRecovery,
  moveBlock,
  moveHome,
  offWeekAtHome,
  personalWealth,
  serializeWorld,
  taxWeek,
  travelDays,
  withinDrive,
  type World,
} from "../src/season";

const base = createWorld({ seed: 31, scenario: "agency" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

describe("home base", () => {
  it("every player has a home city from his nationality, the same every time", () => {
    const players = Object.values(base.players);
    for (const wp of players.slice(0, 200)) {
      expect(HOME_CITY_BY_ID[defaultHomeCity(wp)]).toBeDefined();
      expect(defaultHomeCity(wp)).toBe(defaultHomeCity(wp));
    }
    const americans = players.filter((wp) => wp.player.nationality === "USA");
    for (const wp of americans.slice(0, 50)) expect(homeCityOf(wp).region).toBe("NA");
    // The spread: more than one city among Americans.
    expect(new Set(americans.map((wp) => homeCityOf(wp).id)).size).toBeGreaterThan(4);
  });

  it("clients get a home city on load, including from a save without one", () => {
    const w = fresh();
    for (const id of w.clientIds) delete w.players[id]!.homeCity;
    const loaded = deserializeWorld(serializeWorld(w));
    for (const id of loaded.clientIds) expect(loaded.players[id]!.homeCity).toBe(defaultHomeCity(loaded.players[id]!));
  });

  it("a drive from home: a travel day fewer; a home crowd in his state", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    wp.homeCity = "jupiter";
    wp.career.lastRegion = "NA";
    expect(withinDrive(wp, "pga-national-champion")).toBe(true);
    expect(withinDrive(wp, "waialae")).toBe(false);
    expect(travelDays(w, wp, "NA", "pga-national-champion")).toBe(travelDays(w, wp, "NA", "waialae") - 1);
    expect(homeCrowd(wp, "bay-hill")).toBe(true);
    expect(homeCrowd(wp, "augusta-national")).toBe(false);
  });

  it("the home crowd is measured against the field: a whole field scores the same", () => {
    const player = Object.values(base.players).find((w) => w.career.status === "exempt")!.player;
    const course = getCourse("bay-hill");
    const ctx = (home: boolean) => ({ majorsStarted: 0, missedCutHereLastSeason: false, top25sHere: 0, home: false, regionChanged: false, consecutiveStarts: 1, weeksOff: 1, lateSeason: false, homeCrowd: home, fieldHomeCrowd: 0.25 });
    const at = (home: boolean) => traitRoundEffects({ player: { ...player, traits: [] }, course, rain: false, wave: "AM", round: 1, shotsBehind: null, event: ctx(home) }).strokes;
    expect(at(true) - at(false)).toBeCloseTo(-0.05);
    // A quarter at home, three quarters not: the field's average is unchanged.
    const none = traitRoundEffects({ player: { ...player, traits: [] }, course, rain: false, wave: "AM", round: 1, shotsBehind: null }).strokes;
    expect(0.25 * at(true) + 0.75 * at(false)).toBeCloseTo(none);
  });

  it("tax by home city comes out of his wealth, never the agency's, and can be switched off", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    wp.homeCity = "san-diego";
    const bank = w.agency.bank;
    const before = personalWealth(wp);
    wp.client!.finances.prizeMoney += 1_000_000;
    wp.client!.finances.commission += 100_000;
    taxWeek(w);
    expect(wp.client!.finances.tax).toBe(Math.round(900_000 * 0.12));
    expect(personalWealth(wp)).toBe(before + 900_000 - 108_000);
    expect(w.agency.bank).toBe(bank);
    // Taxed once: a second week with nothing new adds nothing.
    taxWeek(w);
    expect(wp.client!.finances.tax).toBe(108_000);
    // Moving to Florida: no tax on what comes in next.
    wp.homeCity = "jupiter";
    wp.client!.finances.prizeMoney += 500_000;
    taxWeek(w);
    expect(wp.client!.finances.tax).toBe(108_000);
    // Switched off: nothing.
    w.homeTax = false;
    wp.homeCity = "london";
    wp.client!.finances.prizeMoney += 500_000;
    taxWeek(w);
    expect(wp.client!.finances.tax).toBe(108_000);
  });

  it("moving costs money and mood, sells his home, and happens once a season", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    wp.homeCity = "jupiter";
    wp.client!.savings = 5_000_000;
    buyLifestyle(w, id, "home-condo");
    const spent = wp.client!.finances.lifestyle ?? 0;
    const mood = wp.client!.happiness;
    moveHome(w, id, "dallas");
    expect(wp.homeCity).toBe("dallas");
    expect(wp.client!.lifestyle ?? []).not.toContain("home-condo");
    expect(wp.client!.finances.lifestyle).toBe(spent + HOME_CITY_BY_ID.dallas!.moveCost - Math.round(350_000 * 0.8));
    expect(wp.client!.happiness).toBeLessThan(mood);
    expect(moveBlock(w, id, "orlando")).toMatch(/once this season/);
    // Too poor to move.
    const other = w.clientIds[1]!;
    w.players[other]!.client!.savings = -1_000_000;
    expect(moveBlock(w, other, "monte-carlo")).toMatch(/can't afford/);
  });

  it("weeks off at home recover more, more again with a home there", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    wp.homeCity = "jupiter";
    wp.career.lastRegion = "NA";
    expect(offWeekAtHome(w, wp)).toBe(true);
    wp.career.lastRegion = "EU";
    expect(offWeekAtHome(w, wp)).toBe(false);
    expect(homeRecovery(wp)).toBeCloseTo(1.15);
    wp.client!.savings = 5_000_000;
    buyLifestyle(w, id, "home-condo");
    expect(homeRecovery(wp)).toBeCloseTo(1.25);
  });
});
