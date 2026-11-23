import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  FAMILY_CADDIE_WEEKS,
  applyEffects,
  caddieChemistry,
  caddieOnBag,
  createWorld,
  defaultFamily,
  deserializeWorld,
  familyDefault,
  familyLabel,
  familyWeek,
  hireFamilyCaddie,
  pendingDecisions,
  serializeWorld,
  weeklyDilemmas,
  type TourEvent,
  type World,
} from "../src/season";

const base = createWorld({ seed: 31, scenario: "agency" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
const event = (w: World, courseId: string, tier: TourEvent["tier"] = "standard"): TourEvent => ({ ...w.schedule.find((e) => e.tier !== "dev")!, courseId, tier, region: "NA" });

describe("family on tour", () => {
  it("families come from age alone, the same every time, and older players are more often married", () => {
    const pros = Object.values(base.players).filter((wp) => wp.career.status !== "amateur");
    for (const wp of pros.slice(0, 50)) expect(defaultFamily(wp, 3)).toEqual(defaultFamily(wp, 3));
    const married = (ws: typeof pros) => ws.filter((wp) => defaultFamily(wp, 3).status === "married").length / Math.max(1, ws.length);
    expect(married(pros.filter((wp) => wp.player.age >= 32))).toBeGreaterThan(married(pros.filter((wp) => wp.player.age < 25)));
    // Computer players don't carry one on the save.
    expect(pros.filter((wp) => !wp.client).every((wp) => wp.family === undefined)).toBe(true);
  });

  it("an older save without families loads, and clients get one", () => {
    const w = fresh();
    for (const id of w.clientIds) delete w.players[id]!.family;
    const loaded = deserializeWorld(serializeWorld(w));
    for (const id of loaded.clientIds) expect(loaded.players[id]!.family).toBeDefined();
  });

  it("the new baby stays: a child on the profile", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.family = { status: "married", children: [] };
    applyEffects(w, wp, [{ k: "child" }], createRng(1), []);
    expect(wp.family.children).toEqual([w.season]);
    expect(familyLabel(w, wp)).toBe("Married, one child (a baby)");
    applyEffects(w, wp, [{ k: "familyTour", v: 6 }], createRng(1), []);
    expect(wp.client!.familyTourUntil).toBe(w.season * 52 + w.week + 6);
  });

  it("the family travelling costs him, lifts his mood, and small children tire him", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.homeCity = "jupiter";
    wp.family = { status: "married", children: [w.season - 2] };
    const far = event(w, "pebble-beach");
    const near = event(w, "pga-national-champion");
    expect(familyDefault(w, wp, near)).toBe(true);
    expect(familyDefault(w, wp, far)).toBe(false);
    expect(familyDefault(w, wp, event(w, "pebble-beach", "major"))).toBe(true);
    const travel = wp.client!.finances.travel;
    wp.player.condition = 80;
    expect(familyWeek(w, wp, far)).toBe(0);
    expect(familyWeek(w, wp, far, "travel")).toBe(3);
    expect(wp.client!.finances.travel).toBeGreaterThan(travel);
    expect(wp.player.condition).toBe(78);
    expect(wp.client!.homeWeek).toBe(w.season * 52 + w.week);
    // Single: nobody to bring.
    wp.family = { status: "single", children: [] };
    expect(familyWeek(w, wp, near, "travel")).toBe(0);
  });

  it("a family member as caddie: cheap, high chemistry, low skills", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    hireFamilyCaddie(w, id);
    const bag = caddieOnBag(w, w.players[id]!)!;
    expect(bag.chemistry).toBe(caddieChemistry(FAMILY_CADDIE_WEEKS));
    expect(bag.chemistry).toBeGreaterThanOrEqual(70);
    expect(Math.max(bag.greenReading, bag.clubbing, bag.calm)).toBeLessThanOrEqual(7);
  });

  it("veterans with children want fewer starts, not more", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    wp.player.age = 38;
    wp.player.attributes.ambition = 18;
    wp.family = { status: "married", children: [w.season - 8] };
    w.clientIds = [id];
    let fewer = 0;
    let more = 0;
    for (let s = 0; s < 400; s++) {
      w.inbox = [];
      weeklyDilemmas(w, new Map(), createRng(s), 1, ["more-starts", "fewer-starts"]);
      for (const d of pendingDecisions(w)) d.key === "fewer-starts" ? fewer++ : more++;
    }
    expect(more).toBe(0);
    expect(fewer).toBeGreaterThan(0);
  });
});
