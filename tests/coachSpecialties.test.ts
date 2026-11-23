import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  COACH_SPECIALTIES,
  clientSpecialties,
  coachFee,
  createWorld,
  deserializeWorld,
  developWeek,
  hireCoach,
  injuryChance,
  pressureGrowth,
  rebuildChance,
  rebuildWeeks,
  serializeWorld,
  specialistFee,
  specialtiesOf,
  specialtyGrowth,
  specialtyValue,
  type Coach,
  type World,
  type WorldPlayer,
} from "../src/season";

const base = createWorld({ seed: 21, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
/** A market coach of this role who has the specialty. */
const withSpecialty = (w: World, s: string): Coach => w.coaches.find((c) => c.role === COACH_SPECIALTIES[s]!.role && !c.formerClient && specialtiesOf(w.seed, c).includes(s))!;
const without = (w: World, s: string): Coach => w.coaches.find((c) => c.role === COACH_SPECIALTIES[s]!.role && !c.formerClient && !specialtiesOf(w.seed, c).includes(s))!;
const clone = (wp: WorldPlayer): WorldPlayer => JSON.parse(JSON.stringify(wp));

describe("coach specialties", () => {
  it("gives every coach one from his role's list, and a second from 15 out of 20", () => {
    for (const c of base.coaches) {
      const s = specialtiesOf(base.seed, c);
      expect(s.length).toBe(c.quality >= 15 ? 2 : 1);
      expect(new Set(s).size).toBe(s.length);
      for (const id of s) expect(COACH_SPECIALTIES[id]!.role).toBe(c.role);
      expect(specialtiesOf(base.seed, c)).toEqual(s);
    }
    // Every specialty turns up somewhere on the market.
    const seen = new Set(base.coaches.flatMap((c) => specialtiesOf(base.seed, c)));
    for (const id of Object.keys(COACH_SPECIALTIES)) expect(seen.has(id), id).toBe(true);
  });

  it("makes specialists ask 10% more, or 25% for two", () => {
    for (const c of base.coaches.filter((x) => !x.formerClient)) {
      const premium = specialtiesOf(base.seed, c).length >= 2 ? 1.25 : 1.1;
      expect(c.weeklyFee).toBe(Math.round((coachFee(c.quality) * premium) / 100) * 100);
    }
  });

  it("needs nothing new in a save: an old one loads and is repriced", () => {
    const raw = JSON.parse(serializeWorld(base));
    for (const c of raw.coaches) c.weeklyFee = coachFee(c.quality);
    const w = deserializeWorld(JSON.stringify(raw));
    for (const c of w.coaches.filter((x) => !x.formerClient)) expect(c.weeklyFee).toBe(specialistFee(w.seed, c));
    expect(specialtiesOf(w.seed, w.coaches[0]!)).toEqual(specialtiesOf(base.seed, base.coaches[0]!));
  });

  it("boosts growth only in the specialty's area, by 10-30%", () => {
    const s = new Set(["distance-guru", "young-minds"]);
    expect(specialtyGrowth(s, "drivingDistance", 30)).toBeCloseTo(1.3);
    expect(specialtyGrowth(s, "wedges", 30)).toBe(1);
    expect(specialtyGrowth(s, "composure", 22)).toBeCloseTo(1.25);
    expect(specialtyGrowth(s, "composure", 28)).toBe(1);
    for (const sp of Object.values(COACH_SPECIALTIES)) {
      if (!sp.growth) continue;
      expect(sp.growth.mult).toBeGreaterThanOrEqual(1.1);
      expect(sp.growth.mult).toBeLessThanOrEqual(1.3);
    }
  });

  it("a distance guru grows driving distance faster in a week of training", () => {
    const w = fresh();
    const wp = w.players.client!;
    const week = (specialties?: Set<string>) => {
      const p = clone(wp);
      p.player.age = 21;
      p.development.potential = 19;
      const start = p.player.attributes.drivingDistance;
      const rng = createRng(3);
      for (let i = 0; i < 60; i++) developWeek(p, { plan: { focus: "longGame", intensity: "normal" }, coachQuality: { swing: 14 }, competed: false, managed: true, ...(specialties ? { specialties } : {}) }, rng);
      return p.player.attributes.drivingDistance - start + (p.development.progress.drivingDistance ?? 0);
    };
    expect(week(new Set(["distance-guru"]))).toBeGreaterThan(week());
  });

  it("Old Pros and Longevity slow ageing for a veteran", () => {
    const w = fresh();
    const vet = clone(Object.values(w.players).find((x) => x.player.age >= 40)!);
    const week = (specialties?: Set<string>) => {
      const p = clone(vet);
      p.development.progress = {};
      developWeek(p, { plan: { focus: "balanced", intensity: "normal" }, coachQuality: { swing: 12, fitness: 14 }, competed: false, managed: true, ...(specialties ? { specialties } : {}) }, createRng(3));
      return p.development.progress;
    };
    const plain = week();
    const pros = week(new Set(["old-pros"]));
    const long = week(new Set(["longevity"]));
    expect(pros.longIrons!).toBeGreaterThan(plain.longIrons!);
    expect(long.stamina!).toBeGreaterThan(plain.stamina!);
    expect(long.wedges).toBe(plain.wedges);
  });

  it("an Injury Prevention trainer cuts injuries a little more", () => {
    const wp = fresh().players.client!;
    expect(injuryChance(wp, true, 1, 16, 1.3)).toBeLessThan(injuryChance(wp, true, 1, 16));
    expect(injuryChance(wp, true, 1, 16, 1.3)).toBeGreaterThan(injuryChance(wp, true, 1, 16) * 0.85);
  });

  it("a rebuild specialist's swing rebuild is 4 weeks shorter and likelier to work", () => {
    const w = fresh();
    const wp = w.players.client!;
    const spec = withSpecialty(w, "rebuild-specialist");
    const plain = without(w, "rebuild-specialist");
    plain.quality = spec.quality = 8;
    hireCoach(w, "client", plain.id);
    const plainChance = rebuildChance(w, wp, "swing");
    expect(rebuildWeeks(w, "client", "swing")).toBe(16);
    hireCoach(w, "client", spec.id);
    expect(rebuildWeeks(w, "client", "swing")).toBe(12);
    expect(rebuildWeeks(w, "client", "putting")).toBe(8);
    expect(clientSpecialties(w, wp).has("rebuild-specialist")).toBe(true);
    expect(rebuildChance(w, wp, "swing")).toBeCloseTo(Math.min(0.95, plainChance + 0.1));
  });

  it("a Closer hardens the nerve faster after a contending week", () => {
    const wp = fresh().players.client!;
    const a = clone(wp);
    const b = clone(wp);
    a.development.progress = {};
    b.development.progress = {};
    pressureGrowth(a, 2, "standard");
    pressureGrowth(b, 2, "standard", 1.3);
    const k = Object.keys(a.development.progress)[0]!;
    expect(b.development.progress[k as "composure"]!).toBeCloseTo(a.development.progress[k as "composure"]! * 1.3);
  });

  it("development directors value a specialty that fits the client", () => {
    const w = fresh();
    const wp = w.players.client!;
    const young = withSpecialty(w, "young-minds");
    const old = clone(wp);
    old.player.age = 30;
    const kid = clone(wp);
    kid.player.age = 21;
    expect(specialtyValue(w, kid, young)).toBeGreaterThan(specialtyValue(w, old, young));
  });
});
