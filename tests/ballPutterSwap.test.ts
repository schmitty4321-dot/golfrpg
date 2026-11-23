import { describe, expect, it } from "vitest";
import { EQUIPMENT, KIT_SLOTS, ballOf, equipmentReach, equipmentRound, expectedStrokesGained, totalSg, type Player } from "../src/engine";
import {
  PUTTER_FRESH,
  PUTTER_SWAP_COOLDOWN,
  PUTTER_WRONG,
  absWeek,
  coldPuttingStreak,
  createWorld,
  deserializeWorld,
  equip,
  kitAfterEvent,
  playWeek,
  putterSwapBlock,
  putterSwapLift,
  serializeWorld,
  swapPutter,
  type EventRecord,
  type World,
  type WorldPlayer,
} from "../src/season";
import { flatPlayer } from "./helpers";

const base = createWorld({ seed: 77, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
const withBall = (id: string): Player => ({ ...flatPlayer("b", 12), equipment: { ball: id } });
const total = (p: Player, firm: boolean, rain: boolean, wind: number) => totalSg(equipmentRound(p, firm, rain, wind).sg);

describe("golf balls", () => {
  it("are a fifth bag slot with tour standard and four trade-offs, each branded", () => {
    expect(KIT_SLOTS).toContain("ball");
    const balls = EQUIPMENT.filter((m) => m.slot === "ball");
    expect(balls).toHaveLength(5);
    expect(balls.filter((m) => !m.brand).map((m) => m.id)).toEqual(["ball-standard"]);
    expect(ballOf(flatPlayer("x", 12)).id).toBe("ball-standard");
  });

  it("every club except tour standard carries a brand", () => {
    const clubs = EQUIPMENT.filter((m) => ["driver", "irons", "wedges", "putter"].includes(m.slot));
    expect(clubs.filter((m) => !m.brand).map((m) => m.id).sort()).toEqual(["driver-standard", "irons-standard", "putter-standard", "wedges-standard"]);
    expect(EQUIPMENT.find((m) => m.id === "driver-catalog-01")!.brand).toBe("Talon Golf");
  });

  it("tour standard changes nothing in any weather", () => {
    for (const wind of [0, 10, 25]) expect(total(withBall("ball-standard"), true, false, wind)).toBe(0);
  });

  it("the wind ball pays in the wind and costs a little in calm air", () => {
    const p = withBall("ball-wind");
    expect(total(p, false, false, 22)).toBeCloseTo(0.05);
    expect(total(p, false, false, 3)).toBeCloseTo(-0.02);
    expect(total(p, false, false, 10)).toBeGreaterThan(0);
    expect(total(p, false, false, 10)).toBeLessThan(0.05);
  });

  it("the spin ball helps around the greens but loses in the wind", () => {
    const p = withBall("ball-spin");
    expect(equipmentRound(p, false, false, 0).sg.aroundTheGreen).toBeCloseTo(0.03);
    expect(total(p, false, false, 25)).toBeLessThan(total(p, false, false, 0));
  });

  it("the distance ball goes further but gives it back into firm greens", () => {
    const p = withBall("ball-distance");
    expect(equipmentReach(p)).toBe(5);
    expect(total(p, false, false, 5)).toBeCloseTo(0.02);
    expect(total(p, true, false, 5)).toBeCloseTo(-0.02);
  });

  it("every ball stays within 0.05 strokes a round either way", () => {
    for (const m of EQUIPMENT.filter((x) => x.slot === "ball")) {
      for (const [firm, rain, wind] of [[false, false, 0], [true, false, 0], [false, true, 15], [true, false, 30]] as const) {
        expect(Math.abs(total(withBall(m.id), firm, rain, wind))).toBeLessThanOrEqual(0.0501);
      }
    }
  });

  it("can be bought and put in the bag like a club", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    equip(w, id, "ball-soft");
    expect(w.players[id]!.player.equipment?.ball).toBe("ball-soft");
    expect(w.players[id]!.client!.ownedEquipment).toContain("ball-soft");
  });
});

const coldRecord = (putting: number): EventRecord => ({ eventId: "e", eventName: "Test Open", tier: "standard", season: 1, week: 1, position: 50, label: "50", toPar: 2, earnings: 0, seasonPoints: 0, owgrPoints: 0, sgPerRound: -0.5, madeCut: true, via: "field", putting });

function coldClient(w: World): WorldPlayer {
  const wp = w.players[w.clientIds[0]!]!;
  wp.career.results.push(coldRecord(-0.6), coldRecord(-0.5));
  return wp;
}

describe("the putter swap", () => {
  it("needs two cold putting events in a row", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.career.results.push(coldRecord(0.2));
    expect(putterSwapBlock(w, wp.player.id)).toMatch(/isn't cold/);
    wp.career.results.push(coldRecord(-0.6));
    expect(coldPuttingStreak(wp)).toBe(1);
    expect(putterSwapBlock(w, wp.player.id)).toMatch(/one more/i);
    wp.career.results.push(coldRecord(-0.4));
    expect(putterSwapBlock(w, wp.player.id)).toBeNull();
  });

  it("lifts his putting for two events, then fades, and waits four weeks", () => {
    const w = fresh();
    const wp = coldClient(w);
    const before = expectedStrokesGained(wp.player, w.courses[0]!).putting;
    swapPutter(w, wp.player.id);
    const s = wp.client!.putterSwap!;
    expect(s.played).toBe(0);
    const first = s.feel === "fresh" ? PUTTER_FRESH[0]! : PUTTER_WRONG;
    expect(putterSwapLift(wp)).toBe(first);
    expect(expectedStrokesGained(wp.player, w.courses[0]!).putting - before).toBeCloseTo(first);
    kitAfterEvent(wp);
    expect(putterSwapLift(wp)).toBe(s.feel === "fresh" ? PUTTER_FRESH[1]! : PUTTER_WRONG);
    kitAfterEvent(wp);
    expect(putterSwapLift(wp)).toBe(0);
    expect(wp.player.kitAdjust).toBeUndefined();
    expect(putterSwapBlock(w, wp.player.id)).toMatch(/give it/);
    // Four weeks on, he can try again.
    wp.client!.putterSwap!.absWeek = absWeek(w.season, w.week) - PUTTER_SWAP_COOLDOWN;
    expect(putterSwapBlock(w, wp.player.id)).toBeNull();
  });

  it("is seeded: the same swap turns out the same, and some feel wrong", () => {
    const feels = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const a = fresh();
      a.seed = seed;
      const b = fresh();
      b.seed = seed;
      swapPutter(a, coldClient(a).player.id);
      swapPutter(b, coldClient(b).player.id);
      const fa = a.players[a.clientIds[0]!]!.client!.putterSwap!.feel;
      expect(b.players[b.clientIds[0]!]!.client!.putterSwap!.feel).toBe(fa);
      feels.add(fa);
    }
    expect(feels).toEqual(new Set(["fresh", "wrong"]));
  });

  it("a played week records his putting and ages the swap; old saves without it load", () => {
    const w = fresh();
    const wp = coldClient(w);
    swapPutter(w, wp.player.id);
    for (let i = 0; i < 6 && wp.client!.putterSwap!.played === 0; i++) playWeek(w);
    const played = w.players[wp.player.id]!;
    expect(played.client!.putterSwap!.played).toBeGreaterThan(0);
    const last = played.career.results.at(-1)!;
    expect(typeof last.putting).toBe("number");
    const raw = JSON.parse(serializeWorld(w));
    delete raw.players[wp.player.id].client.putterSwap;
    delete raw.players[wp.player.id].player.kitAdjust;
    delete raw.players[wp.player.id].player.equipment;
    const loaded = deserializeWorld(JSON.stringify(raw));
    expect(putterSwapLift(loaded.players[wp.player.id]!)).toBe(0);
    expect(ballOf(loaded.players[wp.player.id]!.player).id).toBe("ball-standard");
  });
});
