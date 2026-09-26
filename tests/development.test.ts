import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  COACH_GROUPS,
  REBUILD_WEEKS,
  SEASON_WEEKS,
  canStartRebuild,
  clientOptions,
  createWorld,
  deserializeWorld,
  developWeek,
  endOfWeek,
  hireCoach,
  overall,
  playWeek,
  rebuildSuccessChance,
  releaseCoach,
  seasonChange,
  serializeWorld,
  startRebuild,
  abandonRebuild,
  weeklyStaffCost,
  finishSeason,
  type DevelopmentInputs,
  type World,
  type WorldPlayer,
} from "../src/season";
import { flatPlayer } from "./helpers";

const person = (age: number, level: number, potential: number, peakAge = 31): WorldPlayer => {
  const p = { ...flatPlayer("x", level), age, peakAge };
  return {
    player: p,
    career: {} as WorldPlayer["career"],
    targetEvents: 25,
    development: { potential, progress: {}, seasonStart: { ...p.attributes } },
    injury: null,
    rebuild: null,
  };
};
const inputs = (over: Partial<DevelopmentInputs> = {}): DevelopmentInputs => ({
  plan: { focus: "balanced", intensity: "normal" },
  coachQuality: { swing: 10, shortGame: 10, putting: 10, mental: 10, fitness: 10 },
  competed: false,
  ...over,
});
const weeks = (wp: WorldPlayer, n: number, i: DevelopmentInputs, seed = 1) => {
  const rng = createRng(seed);
  for (let k = 0; k < n; k++) developWeek(wp, i, rng);
  return wp;
};

describe("development", () => {
  it("grows a young player with room towards his ceiling", () => {
    const wp = weeks(person(19, 9, 15), 150, inputs());
    expect(overall(wp.player)).toBeGreaterThan(11.5);
    expect(overall(wp.player)).toBeLessThanOrEqual(15.5);
  });

  it("barely moves a player already at his ceiling in his prime", () => {
    const wp = weeks(person(30, 13, 13), 100, inputs());
    expect(Math.abs(overall(wp.player) - 13)).toBeLessThan(0.6);
  });

  it("takes distance from veterans first, while experience still grows", () => {
    const wp = weeks(person(44, 13, 13), 100, inputs());
    expect(wp.player.attributes.drivingDistance).toBeLessThan(13);
    expect(wp.player.attributes.courseManagement).toBeGreaterThanOrEqual(13);
  });

  it("grows the focused area faster than the rest", () => {
    const focused = weeks(person(20, 9, 15), 80, inputs({ plan: { focus: "putting", intensity: "normal" } }));
    const avg = (wp: WorldPlayer, keys: readonly string[]) => keys.reduce((s, k) => s + wp.player.attributes[k as "shortPutts"], 0) / keys.length;
    expect(avg(focused, ["lagPutting", "shortPutts", "greenReading", "speedControl"])).toBeGreaterThan(avg(focused, ["chipping", "pitching", "bunkerPlay", "creativity"]));
  });

  it("develops players faster with better coaches", () => {
    const good = weeks(person(20, 9, 16), 80, inputs({ coachQuality: { swing: 18, shortGame: 18, putting: 18, mental: 18, fitness: 18 } }));
    const none = weeks(person(20, 9, 16), 80, inputs({ coachQuality: {} }));
    expect(overall(good.player)).toBeGreaterThan(overall(none.player));
  });

  it("never pushes an attribute past 20 or far past the ceiling", () => {
    const wp = weeks(person(18, 17, 18.5), 400, inputs({ plan: { focus: "longGame", intensity: "heavy" } }));
    for (const v of Object.values(wp.player.attributes)) expect(v).toBeLessThanOrEqual(20);
  });

  it("reports what changed this season", () => {
    const wp = weeks(person(19, 9, 15), 100, inputs());
    const change = seasonChange(wp);
    expect(Object.values(change).some((d) => (d ?? 0) > 0)).toBe(true);
  });
});

const base = createWorld({ seed: 21, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

describe("coaches", () => {
  it("offers five coaches per role, dearer as they get better", () => {
    expect(base.coaches).toHaveLength(25);
    const swing = base.coaches.filter((c) => c.role === "swing").sort((a, b) => a.quality - b.quality);
    expect(swing[4]!.weeklyFee).toBeGreaterThan(swing[0]!.weeklyFee * 3);
  });

  it("charges the client's staff wages every week, and stops when released", () => {
    const w = fresh();
    const coach = w.coaches.find((c) => c.role === "putting")!;
    hireCoach(w, coach.id);
    expect(weeklyStaffCost(w)).toBe(coach.weeklyFee);
    playWeek(w);
    expect(w.finances.coaching).toBe(coach.weeklyFee);
    releaseCoach(w, "putting");
    playWeek(w);
    expect(w.finances.coaching).toBe(coach.weeklyFee);
  });
});

describe("swing rebuild", () => {
  it("needs a swing coach", () => {
    const w = fresh();
    expect(canStartRebuild(w).ok).toBe(false);
    hireCoach(w, w.coaches.find((c) => c.role === "swing")!.id);
    expect(canStartRebuild(w).ok).toBe(true);
  });

  it("costs strokes at first, eases off, and ends", () => {
    const w = fresh();
    hireCoach(w, w.coaches.filter((c) => c.role === "swing").sort((a, b) => b.quality - a.quality)[0]!.id);
    startRebuild(w);
    const c = w.players[w.clientId]!;
    const early = c.player.sgAdjust!.approach!;
    expect(early).toBeLessThan(0);
    for (let i = 0; i < 8; i++) endOfWeek(w, new Set(), createRng(i));
    expect(c.player.sgAdjust!.approach!).toBeGreaterThan(early);
    for (let i = 8; i < REBUILD_WEEKS; i++) endOfWeek(w, new Set(), createRng(i));
    expect(c.rebuild).toBeNull();
    expect(c.player.sgAdjust).toBeUndefined();
    expect(w.news.some((n) => n.includes("rebuild is complete"))).toBe(true);
  });

  it("succeeds more often with a better coach and a coachable player", () => {
    expect(rebuildSuccessChance(18, 16)).toBeGreaterThan(rebuildSuccessChance(6, 6));
  });

  it("can be abandoned, removing the penalty", () => {
    const w = fresh();
    hireCoach(w, w.coaches.find((c) => c.role === "swing")!.id);
    startRebuild(w);
    abandonRebuild(w);
    expect(w.players[w.clientId]!.player.sgAdjust).toBeUndefined();
    expect(w.players[w.clientId]!.rebuild).toBeNull();
  });

  it("improves the ball-striking when it works", () => {
    const w = fresh();
    const c = w.players[w.clientId]!;
    c.player.attributes.coachability = 20;
    hireCoach(w, w.coaches.filter((x) => x.role === "swing").sort((a, b) => b.quality - a.quality)[0]!.id);
    const before = COACH_GROUPS.swing.reduce((s, k) => s + c.player.attributes[k], 0);
    const potBefore = c.development.potential;
    startRebuild(w);
    for (let i = 0; i < REBUILD_WEEKS; i++) endOfWeek(w, new Set(), createRng(100 + i));
    const worked = w.news.some((n) => n.includes("it's worked"));
    if (worked) {
      expect(COACH_GROUPS.swing.reduce((s, k) => s + c.player.attributes[k], 0)).toBeGreaterThanOrEqual(before + 2);
      expect(c.development.potential).toBeCloseTo(potBefore + 1, 5);
    }
  });
});

describe("injuries", () => {
  it("keeps an injured client out of events and heals over time", () => {
    const w = fresh();
    const c = w.players[w.clientId]!;
    c.injury = { name: "Wrist strain", weeksLeft: 2 };
    const [opt] = clientOptions(w);
    expect(opt!.access).toBe("injured");
    const r = playWeek(w, { kind: "enter", eventId: opt!.event.id });
    expect(r.client.record).toBeNull();
    playWeek(w);
    expect(c.injury).toBeNull();
  });

  it("keeps injured computer players out of fields", () => {
    const w = fresh();
    const hurt = Object.values(w.players).filter((wp) => wp.career.status === "exempt").slice(0, 20);
    for (const wp of hurt) wp.injury = { name: "Back spasm", weeksLeft: 3 };
    const r = playWeek(w);
    for (const { field } of r.results) for (const wp of hurt) expect(field.field).not.toContain(wp.player.id);
  });

  it("happens now and then across a season, not constantly", () => {
    const w = fresh();
    let count = 0;
    while (w.week <= SEASON_WEEKS) {
      playWeek(w);
      count += Object.values(w.players).filter((wp) => wp.injury).length;
    }
    const perWeek = count / SEASON_WEEKS;
    expect(perWeek).toBeGreaterThan(0.5);
    expect(perWeek).toBeLessThan(15);
  });
});

describe("seasons and saves", () => {
  it("resets the season baseline after the winter", () => {
    const w = fresh();
    while (w.week <= SEASON_WEEKS) playWeek(w);
    finishSeason(w);
    const c = w.players[w.clientId]!;
    expect(c.development.seasonStart).toEqual(c.player.attributes);
  });

  it("upgrades a version-1 save", () => {
    const old = JSON.parse(serializeWorld(base)) as Record<string, unknown> & { players: Record<string, Record<string, unknown>> };
    old.version = 1;
    delete old.coaches;
    delete old.staff;
    delete old.training;
    delete (old.finances as Record<string, unknown>).coaching;
    for (const wp of Object.values(old.players)) {
      delete wp.development;
      delete wp.injury;
      delete wp.rebuild;
    }
    const w = deserializeWorld(JSON.stringify(old));
    expect(w.version).toBe(2);
    expect(w.coaches).toHaveLength(25);
    expect(w.training.focus).toBe("balanced");
    expect(w.players[w.clientId]!.development.potential).toBeGreaterThan(0);
    playWeek(w);
  });
});
