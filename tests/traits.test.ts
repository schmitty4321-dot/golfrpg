import { describe, expect, it } from "vitest";
import {
  TRAITS,
  TRAIT_BY_ID,
  callEffect,
  createRng,
  getCourse,
  playHole,
  rollTraits,
  traitRoundEffects,
  traitsOf,
  type Hole,
  type Player,
  type RoundContext,
} from "../src/engine";
import {
  createWorld,
  overall,
  deserializeWorld,
  developWeek,
  extensionBias,
  fatigueMultiplier,
  hireCoach,
  injuryLength,
  knownTraits,
  onMajorWin,
  seasonEndTraits,
  serializeWorld,
  sponsorValueMultiplier,
  type World,
} from "../src/season";

const base = createWorld({ seed: 21, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
const withTraits = (p: Player, traits: string[]): Player => ({ ...p, traits });

describe("the catalogue", () => {
  it("has 100 traits with unique ids and valid conflicts", () => {
    expect(TRAITS).toHaveLength(100);
    expect(new Set(TRAITS.map((t) => t.id)).size).toBe(100);
    for (const t of TRAITS) for (const c of t.conflicts ?? []) expect(TRAIT_BY_ID.has(c), `${t.id} → ${c}`).toBe(true);
  });

  it("can give every trait to someone", () => {
    const players = Object.values(base.players).map((w) => w.player);
    for (const t of TRAITS) expect(players.some((p) => (t.weight ? t.weight(p) : 1) > 0), t.id).toBe(true);
  });
});

describe("assignment", () => {
  it("gives every player one to three traits, no clashes, at most one legendary", () => {
    for (const wp of Object.values(base.players)) {
      expect(rollTraits(wp.player).length).toBeLessThanOrEqual(3);
      const t = traitsOf(wp.player);
      expect(t.length).toBeGreaterThanOrEqual(1);
      // A career can earn one more (a major win brings Major Mindset).
      expect(t.length).toBeLessThanOrEqual(4);
      expect(t.filter((id) => TRAIT_BY_ID.get(id)!.rarity === "legendary").length).toBeLessThanOrEqual(1);
      for (const a of t) for (const b of t) if (a !== b) expect(TRAIT_BY_ID.get(a)!.conflicts ?? []).not.toContain(b);
    }
  });

  it("is fixed per player and survives a save", () => {
    const p = Object.values(base.players)[5]!.player;
    expect(rollTraits(p)).toEqual(rollTraits(p));
    const w = fresh();
    expect(w.players[p.id]!.player.traits).toEqual(p.traits);
  });

  it("mostly hands out common traits and rarely legendary ones", () => {
    const all = Object.values(base.players).flatMap((w) => traitsOf(w.player).map((id) => TRAIT_BY_ID.get(id)!.rarity));
    const share = (r: string) => all.filter((x) => x === r).length / all.length;
    expect(share("common")).toBeGreaterThan(0.45);
    expect(share("legendary")).toBeLessThan(0.05);
  });
});

describe("golf effects", () => {
  const course = getCourse(base.schedule.find((e) => e.tier !== "dev")!.courseId);
  const player = Object.values(base.players).find((w) => w.career.status === "exempt")!.player;
  const average = (p: Player, hole: Hole, n = 20000, extra: Partial<RoundContext> = {}) => {
    const rng = createRng(5);
    const ctx: RoundContext = { player: p, course, weather: { windMph: { AM: 5, PM: 5 }, rain: false }, wave: "AM", round: 1, shotsBehind: null, rng, ...extra };
    const dayForm = { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 };
    let s = 0;
    for (let i = 0; i < n; i++) s += playHole({ ctx, hole, dayForm, teeShotHoles: 14, state: { lastOverPar: 0 } });
    return s / n;
  };

  it("Par-3 Specialist scores better on par 3s, and only there", () => {
    const par3 = course.holes.find((h) => h.par === 3)!;
    const par4 = course.holes.find((h) => h.par === 4)!;
    const plain = withTraits(player, []);
    const spec = withTraits(player, ["par3-specialist"]);
    expect(average(spec, par3)).toBeLessThan(average(plain, par3) - 0.02);
    expect(average(spec, par4)).toBeCloseTo(average(plain, par4), 5);
  });

  it("Houdini has fewer big numbers", () => {
    const hole = [...course.holes].sort((a, b) => b.hazard - a.hazard)[0]!;
    expect(average(withTraits(player, ["houdini"]), hole)).toBeLessThan(average(withTraits(player, []), hole));
  });

  it("round-level traits fire only where they should", () => {
    const info = (traits: string[], extra: object = {}) =>
      traitRoundEffects({ player: withTraits(player, traits), course, rain: false, wave: "AM", round: 1, shotsBehind: null, ...extra });
    const neutral = info([]).strokes;
    expect(info(["major-monster"], { tier: "major" }).strokes).toBeCloseTo(neutral - 0.4);
    expect(info(["major-monster"], { tier: "standard" }).strokes).toBeCloseTo(neutral);
    expect(info(["dawn-patrol"]).strokes).toBeCloseTo(neutral - 0.08);
    expect(info(["dawn-patrol"], { wave: "PM" }).strokes).toBeCloseTo(neutral + 0.08);
    expect(info(["sunday-red"], { round: 4, shotsBehind: 2 }).strokes).toBeCloseTo(neutral - 0.35);
    expect(info(["sunday-red"], { round: 4, shotsBehind: 6 }).strokes).toBeCloseTo(neutral);
    expect(info(["magician"]).sg.aroundTheGreen).toBeCloseTo(0.15);
    expect(info(["flusher"]).spread.approach).toBeCloseTo(0.85);
  });

  it("Driver Addicts only half take a lay-up call, and Stubborn players dilute every call", () => {
    const hole = { ...course.holes.find((h) => h.par === 4)!, hazard: 0.6, fairwayWidth: 24 };
    const plain = callEffect({ tee: "iron" }, hole, withTraits(player, []));
    const addict = callEffect({ tee: "iron" }, hole, withTraits(player, ["driver-addict"]));
    expect(addict.mean).toBeCloseTo(plain.mean * 0.5);
    expect(addict.blowup).toBeGreaterThan(plain.blowup);
    const stubborn = callEffect({ tee: "iron" }, hole, withTraits(player, ["stubborn"]));
    expect(Math.abs(stubborn.mean)).toBeLessThan(Math.abs(plain.mean));
  });
});

describe("season effects", () => {
  it("shows a client's traits, and a scouted player's one trait per trip from the third", () => {
    const w = fresh();
    const client = w.clientIds[0]!;
    expect(knownTraits(w, client)).toEqual(traitsOf(w.players[client]!.player));
    const x = Object.values(w.players).find((p) => !p.client && traitsOf(p.player).length >= 3)!;
    const id = x.player.id;
    const at = (trips: number) => {
      w.agency.knowledge[id] = { accuracy: 0.5, reports: trips, absWeek: 0 };
      return knownTraits(w, id).length;
    };
    expect(at(1)).toBe(0);
    expect(at(2)).toBe(0);
    expect(at(3)).toBe(1);
    expect(at(4)).toBe(2);
  });

  it("fitness, injuries, contracts and sponsors follow the traits", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.player.traits = ["iron-man"];
    expect(fatigueMultiplier(w, wp)).toBeCloseTo(0.7);
    wp.player.traits = ["quick-healer"];
    expect(injuryLength(wp, 10)).toBe(6);
    wp.player.traits = ["glass-back"];
    expect(injuryLength(wp, 10)).toBe(11);
    wp.player.traits = ["loyal"];
    expect(extensionBias(w, wp)).toBe(10);
    wp.player.traits = ["box-office"];
    expect(sponsorValueMultiplier(w, wp, "equipment")).toBeCloseTo(1.5);
  });

  it("a good mental coach cures the yips; a major win brings belief", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.player.traits = ["chip-yips", "big-stage-freeze"];
    const coach = w.coaches.filter((c) => c.role === "mental").sort((a, b) => b.quality - a.quality)[0]!;
    expect(coach.quality).toBeGreaterThanOrEqual(14);
    hireCoach(w, wp.player.id, coach.id);
    seasonEndTraits(w, createRng(1));
    expect(wp.player.traits).toEqual([]);
    onMajorWin(w, wp);
    expect(wp.player.traits).toContain("major-mindset");
  });

  it("a Plateau player stops growing", () => {
    const w = fresh();
    // Someone with plenty of room below the ceiling, so the trait's cap is what makes the difference.
    const young = Object.values(w.players).find((x) => x.player.age >= 25 && x.player.age <= 27 && x.development.potential > 14 && overall(x.player) <= 14)!;
    const grow = (traits: string[]) => {
      const x = deserializeWorld(serializeWorld(w)).players[young.player.id]!;
      x.player.traits = traits;
      // Young enough to still be growing, whoever the world happened to generate.
      x.player.age = 25;
      x.player.peakAge = 31;
      x.development.potential = 17;
      const rng = createRng(3);
      let gained = 0;
      for (let i = 0; i < 80; i++) gained += developWeek(x, { plan: { focus: "balanced", intensity: "normal" }, coachQuality: { swing: 15, shortGame: 15, putting: 15, mental: 15, fitness: 15 }, competed: true }, rng).reduce((s, c) => s + c.delta, 0);
      return gained;
    };
    expect(grow(["plateau"])).toBeLessThan(grow([]));
  });
});
