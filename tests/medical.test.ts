import { describe, expect, it } from "vitest";
import { createRng, getCourse, playHole, roundForm, traitRoundEffects, type Player, type RoundContext } from "../src/engine";
import {
  KNOCK_STROKES,
  MEDICS_PER_ROLE,
  RETAINER_WEEKS,
  canManageKnock,
  createWorld,
  deserializeWorld,
  endOfWeek,
  eventContext,
  generateMedics,
  hireManager,
  hireMedic,
  knockWeek,
  lateFatigueRelief,
  manageKnock,
  physioCut,
  physioWeeks,
  releaseMedic,
  restRecoveryBoost,
  rushBackRisk,
  serializeWorld,
  setAutoHire,
  weeklyStaffCost,
  type Medic,
  type World,
} from "../src/season";

const base = createWorld({ seed: 21, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
const best = (w: World, role: Medic["role"]) => w.medics!.filter((m) => m.role === role).reduce((a, b) => (b.quality > a.quality ? b : a));
const worst = (w: World, role: Medic["role"]) => w.medics!.filter((m) => m.role === role).reduce((a, b) => (b.quality < a.quality ? b : a));

describe("the medical market", () => {
  it("has eight physios and eight nutritionists, $40k-$250k a season", () => {
    const pool = generateMedics(21);
    expect(pool.filter((m) => m.role === "physio")).toHaveLength(MEDICS_PER_ROLE);
    expect(pool.filter((m) => m.role === "nutritionist")).toHaveLength(MEDICS_PER_ROLE);
    expect(new Set(pool.map((m) => m.id)).size).toBe(16);
    expect(new Set(pool.map((m) => m.name)).size).toBe(16);
    for (const m of pool) {
      expect(m.weeklyFee * RETAINER_WEEKS).toBeGreaterThanOrEqual(30_000);
      expect(m.weeklyFee * RETAINER_WEEKS).toBeLessThanOrEqual(260_000);
    }
    expect(generateMedics(21)).toEqual(pool);
  });

  it("opens in an old save that has no medics, and no one is on staff", () => {
    const raw = JSON.parse(serializeWorld(base));
    delete raw.medics;
    for (const wp of Object.values(raw.players) as { client?: { medical?: unknown }; knock?: unknown }[]) {
      if (wp.client) delete wp.client.medical;
      delete wp.knock;
    }
    const w = deserializeWorld(JSON.stringify(raw));
    expect(w.medics).toHaveLength(16);
    expect(w.players.client!.client!.medical).toBeUndefined();
    expect(() => endOfWeek(w, new Set(), createRng(1))).not.toThrow();
  });

  it("charges the medics' wages with the coaches'", () => {
    const w = fresh();
    const before = weeklyStaffCost(w, "client");
    const p = best(w, "physio");
    hireMedic(w, "client", p.id);
    expect(weeklyStaffCost(w, "client")).toBe(before + p.weeklyFee);
    releaseMedic(w, "client", "physio");
    expect(weeklyStaffCost(w, "client")).toBe(before);
  });

  it("isn't hired by computer players", () => {
    const w = fresh();
    const event = w.schedule.find((e) => e.tier !== "dev")!;
    const rival = Object.values(w.players).find((wp) => !wp.client && wp.career.status === "exempt")!;
    const ctx = eventContext(w, event, rival.player.id);
    expect(ctx.lateFatigueRelief).toBeUndefined();
    expect(ctx.jetLagRelief).toBeUndefined();
    expect(restRecoveryBoost(w, rival)).toBe(1);
  });
});

describe("the physio", () => {
  it("shortens injuries by 15-35% by quality", () => {
    expect(physioCut(1)).toBeCloseTo(0.15);
    expect(physioCut(20)).toBeCloseTo(0.35);
    const w = fresh();
    const wp = w.players.client!;
    expect(physioWeeks(w, wp, 10)).toBe(10);
    hireMedic(w, "client", worst(w, "physio").id);
    const low = physioWeeks(w, wp, 10);
    hireMedic(w, "client", best(w, "physio").id);
    const high = physioWeeks(w, wp, 10);
    expect(low).toBeLessThan(10);
    expect(high).toBeLessThanOrEqual(low);
    expect(high).toBeGreaterThanOrEqual(6);
    expect(physioWeeks(w, wp, 1)).toBe(1);
  });

  it("halves the risk of rushing back", () => {
    const w = fresh();
    const wp = w.players.client!;
    expect(rushBackRisk(w, wp, 0.35)).toBeCloseTo(0.35);
    hireMedic(w, "client", best(w, "physio").id);
    expect(rushBackRisk(w, wp, 0.35)).toBeCloseTo(0.175);
  });

  it("lets him play through a minor knock, a little worse, until it clears", () => {
    const w = fresh();
    const wp = w.players.client!;
    wp.injury = { name: "Back spasm", weeksLeft: 2, totalWeeks: 2 };
    expect(canManageKnock(w, wp)).toBe(false); // no physio
    hireMedic(w, "client", best(w, "physio").id);
    expect(canManageKnock(w, wp)).toBe(true);
    manageKnock(w, "client");
    expect(wp.injury).toBeNull();
    expect(wp.knock).toEqual({ name: "Back spasm", weeksLeft: 2 });
    const event = w.schedule.find((e) => e.tier !== "dev")!;
    expect(eventContext(w, event, "client").knock).toBe(KNOCK_STROKES);
    knockWeek(wp);
    knockWeek(wp);
    expect(wp.knock).toBeUndefined();
    expect(eventContext(w, event, "client").knock).toBeUndefined();
  });

  it("won't clear a serious injury", () => {
    const w = fresh();
    const wp = w.players.client!;
    hireMedic(w, "client", best(w, "physio").id);
    wp.injury = { name: "Rib stress fracture", weeksLeft: 2, totalWeeks: 10 };
    expect(canManageKnock(w, wp)).toBe(false);
    expect(() => manageKnock(w, "client")).toThrow();
  });
});

describe("the nutritionist", () => {
  it("speeds up rest-week recovery by 10-20%", () => {
    const w = fresh();
    const wp = w.players.client!;
    expect(restRecoveryBoost(w, wp)).toBe(1);
    hireMedic(w, "client", worst(w, "nutritionist").id);
    const low = restRecoveryBoost(w, wp);
    hireMedic(w, "client", best(w, "nutritionist").id);
    const high = restRecoveryBoost(w, wp);
    expect(low).toBeGreaterThanOrEqual(1.1);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1.2 + 1e-9);
  });

  it("takes a quarter off jet lag and some of the late-round fade", () => {
    const w = fresh();
    hireMedic(w, "client", best(w, "nutritionist").id);
    const event = w.schedule.find((e) => e.tier !== "dev")!;
    const ctx = eventContext(w, event, "client");
    expect(ctx.jetLagRelief).toBe(0.25);
    expect(ctx.lateFatigueRelief).toBeCloseTo(lateFatigueRelief(w, w.players.client!));
    const course = getCourse(event.courseId);
    const player = { ...w.players.client!.player, traits: ["jet-lag"] };
    const lag = (relief?: number) =>
      traitRoundEffects({ player, course, rain: false, wave: "AM", round: 1, shotsBehind: null, event: { ...ctx, regionChanged: true, flewPrivate: false, jetLagRelief: relief } }).strokes;
    expect(lag(0) - lag(0.25)).toBeCloseTo(0.0625);
  });

  it("makes a tired, low-stamina player fade less on weekend back nines", () => {
    const w = fresh();
    const event = w.schedule.find((e) => e.tier !== "dev")!;
    const course = getCourse(event.courseId);
    const tired: Player = { ...w.players.client!.player, condition: 45, attributes: { ...w.players.client!.player.attributes, stamina: 6 } };
    const hole = course.holes.find((h) => h.number > 12)!;
    const avg = (relief: number) => {
      const rng = createRng(9);
      const ctx: RoundContext = { player: tired, course, weather: { windMph: { AM: 5, PM: 5 }, rain: false }, wave: "AM", round: 3, shotsBehind: 4, rng, event: { ...eventContext(w, event, "client"), lateFatigueRelief: relief } };
      let s = 0;
      for (let i = 0; i < 20000; i++) s += playHole({ ctx, hole, dayForm: { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 }, teeShotHoles: 14, state: { lastOverPar: 0 } });
      return s / 20000;
    };
    expect(avg(0.5)).toBeLessThan(avg(0));
  });

  it("the knock costs about 0.15 strokes of day form", () => {
    const w = fresh();
    const event = w.schedule.find((e) => e.tier !== "dev")!;
    const course = getCourse(event.courseId);
    const form = (knock?: number) => {
      const f = roundForm({ player: w.players.client!.player, course, weather: { windMph: { AM: 5, PM: 5 }, rain: false }, wave: "AM", round: 1, shotsBehind: null, rng: createRng(4), event: { ...eventContext(w, event, "client"), knock } });
      return f.offTheTee + f.approach + f.aroundTheGreen + f.putting;
    };
    expect(form(0) - form(KNOCK_STROKES)).toBeCloseTo(KNOCK_STROKES, 5);
  });
});

describe("development directors", () => {
  it("hire a nutritionist, and a physio only for a client who gets hurt", () => {
    const w = fresh();
    const wp = w.players.client!;
    wp.player.attributes.injuryProneness = 5;
    hireManager(w, "client", w.managers![w.managers!.length - 1]!.id);
    setAutoHire(w, "client", true);
    expect(wp.client!.medical?.nutritionist).toBeDefined();
    expect(wp.client!.medical?.physio).toBeUndefined();
  });
});
