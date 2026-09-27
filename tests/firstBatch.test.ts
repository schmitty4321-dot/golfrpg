import { describe, expect, it } from "vitest";
import { EQUIPMENT, caddieRound, equipmentRound, type Player } from "../src/engine";
import {
  JET_PRICE,
  caddieEmployer,
  caddiesOf,
  clientOptions,
  createWorld,
  deserializeWorld,
  equip,
  goalProgress,
  hireCaddie,
  offerGoals,
  playWeek,
  serializeWorld,
  setJet,
  setTravelClass,
  toggleGoal,
  travelDays,
  weekPlans,
  type World,
} from "../src/season";

const base = createWorld({ seed: 55, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

describe("caddies", () => {
  it("can be hired by one client at a time and build chemistry", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const best = [...caddiesOf(w)].sort((a, b) => b.greenReading + b.clubbing - a.greenReading - a.clubbing)[0]!;
    hireCaddie(w, id, best.id);
    expect(caddieEmployer(w, best.id)).toBe(id);
    playWeek(w);
    expect(w.players[id]!.client!.caddieWeeks).toBe(1);
  });

  it("a good caddie is worth strokes, an ordinary one nothing", () => {
    expect(caddieRound({ greenReading: 10, clubbing: 10, calm: 10, chemistry: 50 }).putting).toBe(0);
    const good = caddieRound({ greenReading: 17, clubbing: 16, calm: 15, chemistry: 100 });
    expect(good.putting + good.approach).toBeGreaterThan(0.05);
  });
});

describe("clubs", () => {
  it("cost money once, then swap for free, and change his game", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const blades = EQUIPMENT.find((e) => e.id === "irons-blades")!;
    equip(w, id, blades.id);
    expect(w.players[id]!.client!.finances.equipment).toBe(blades.price);
    equip(w, id, "irons-standard");
    equip(w, id, blades.id);
    expect(w.players[id]!.client!.finances.equipment).toBe(blades.price);
    const p = w.players[id]!.player as Player;
    expect(equipmentRound(p, false, false).sg.approach).toBeGreaterThan(0);
  });
});

describe("travel", () => {
  it("better classes and the jet mean fewer travel days", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.career.lastRegion = "EU";
    expect(travelDays(w, wp, "NA")).toBe(2);
    setTravelClass(w, wp.player.id, "business");
    expect(travelDays(w, wp, "NA")).toBe(1);
    setJet(w, "lease");
    expect(travelDays(w, wp, "NA")).toBe(0);
    w.agency.bank = JET_PRICE - 1;
    expect(setJet(w, "own")).toMatch(/costs/);
  });
});

describe("the weekly planner", () => {
  it("fits the days he has, and practice days lift his familiarity before the event", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const option = clientOptions(w, id).find((o) => o.access === "in" || o.access === "invited");
    if (!option) return;
    const plans = weekPlans(w, { [id]: { kind: "enter", eventId: option.event.id, days: ["practice", "range", "gym", "sponsor"] } });
    expect(plans.get(id)!.length).toBeLessThanOrEqual(3);
    const off = weekPlans(w, { [id]: { kind: "rest", days: ["gym"] } });
    expect(off.get(id)).toHaveLength(7);
    const before = w.players[id]!.career.familiarity?.[option.event.courseId] ?? 0;
    playWeek(w, { [id]: { kind: "enter", eventId: option.event.id, days: ["practice", "practice"] } });
    expect(w.players[id]!.career.familiarity![option.event.courseId]!).toBeGreaterThan(before + 12);
  });
});

describe("season goals", () => {
  it("offers four goals that suit him, lets you agree two, and tracks them", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const offers = offerGoals(w, w.players[id]!);
    expect(offers).toHaveLength(4);
    w.players[id]!.client!.goalOffers = offers;
    w.players[id]!.client!.goals = [];
    for (const g of offers) toggleGoal(w, id, g.id);
    expect(w.players[id]!.client!.goals).toHaveLength(2);
    const p = goalProgress(w, w.players[id]!, offers[0]!);
    expect(p.target).toBeGreaterThan(0);
  });
});
