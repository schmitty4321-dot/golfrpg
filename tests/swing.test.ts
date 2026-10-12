import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine/rng";
import { generatePlayer } from "../src/engine/players";
import { BASE_WINDOW_MS, POWER_SWEEP_MS, clubSkill, powerSweepMs, scoreSwing, sweetSpotMs, strikeSweepMs } from "../src/engine/swing";
import type { Player } from "../src/engine/types";
import type { AttributeKey } from "../src/engine/attributes";

// A player whose game is set to one level: a control for the rules, not a random golfer.
function golfer(value: number): Player {
  const p = generatePlayer(createRng(11), { tier: "tour" });
  const keys: AttributeKey[] = ["drivingDistance", "drivingAccuracy", "longIrons", "fairwayWoods", "midIrons", "wedges", "distanceControl", "chipping", "pitching", "bunkerPlay"];
  for (const k of keys) p.attributes[k] = value;
  return p;
}

describe("swing timing", () => {
  it("a better player has a slower meter for each club, a worse player a faster one", () => {
    const good = golfer(20);
    const poor = golfer(4);
    for (const club of ["driver", "iron", "wedge"] as const) {
      expect(powerSweepMs(good, club)).toBeGreaterThan(powerSweepMs(poor, club));
      expect(strikeSweepMs(good, club)).toBeGreaterThan(strikeSweepMs(poor, club));
    }
    expect(clubSkill(good, "driver")).toBeGreaterThan(0);
    expect(clubSkill(poor, "driver")).toBeLessThan(0);
  });

  it("the meter stays within 0.7 to 1.4 of the base sweep", () => {
    expect(powerSweepMs(golfer(60), "iron")).toBeLessThanOrEqual(Math.round(POWER_SWEEP_MS * 1.4));
    expect(powerSweepMs(golfer(-60), "iron")).toBeGreaterThanOrEqual(Math.round(POWER_SWEEP_MS * 0.7));
  });

  it("a clean fairway gives the club's full window for an average player", () => {
    expect(sweetSpotMs(golfer(12), "iron", "fairway")).toBe(BASE_WINDOW_MS.iron);
  });

  it("worse lies give shorter sweet spots: light, deep, then fairway bunker", () => {
    const p = golfer(12);
    const clean = sweetSpotMs(p, "iron", "fairway");
    const light = sweetSpotMs(p, "iron", "light");
    const deep = sweetSpotMs(p, "iron", "deep");
    const bunker = sweetSpotMs(p, "iron", "fairwaySand");
    expect(light).toBeLessThan(clean);
    expect(deep).toBeLessThan(light);
    expect(bunker).toBeLessThan(deep);
  });

  it("shaped, high and low shots shorten the sweet spot, and overdriving the meter does too", () => {
    const p = golfer(12);
    const straight = sweetSpotMs(p, "driver", "fairway");
    expect(sweetSpotMs(p, "driver", "fairway", { shape: -1, strength: 0.5 })).toBeLessThan(straight);
    expect(sweetSpotMs(p, "driver", "fairway", { height: 1 })).toBeLessThan(straight);
    expect(sweetSpotMs(p, "driver", "fairway", { power: 108 })).toBeLessThan(straight);
    expect(sweetSpotMs(p, "wedge", "fairway", { shot: "flop" })).toBeLessThan(sweetSpotMs(p, "wedge", "fairway"));
  });

  it("a sweet spot never falls below 25 ms", () => {
    expect(sweetSpotMs(golfer(-60), "driver", "fairwaySand", { shot: "flop", shape: 1, strength: 1, height: 1, power: 110 })).toBe(25);
  });

  it("a dead-centre strike scores 1, a late one inside the window still scores, and a miss is outside it", () => {
    expect(scoreSwing({ power: 90, timingMs: 0 }, 80, 90)).toMatchObject({ quality: 1, inWindow: true });
    const late = scoreSwing({ power: 90, timingMs: 40 }, 80, 90);
    expect(late.inWindow).toBe(true);
    expect(late.quality).toBeLessThan(1);
    expect(scoreSwing({ power: 90, timingMs: 120 }, 80, 90).inWindow).toBe(false);
  });
});
