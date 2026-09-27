import { describe, expect, it } from "vitest";
import { PORTRAITS, PORTRAIT_COUNT, portraitIndex } from "../src/ui/components/Portrait";
import { attributePotential, createWorld } from "../src/season";

describe("player pictures", () => {
  it("has 100 different portraits", () => {
    expect(PORTRAITS).toHaveLength(PORTRAIT_COUNT);
    expect(new Set(PORTRAITS.map((p) => JSON.stringify({ ...p, back: "" }))).size).toBe(PORTRAIT_COUNT);
  });

  it("gives a player the same picture every time, and spreads them around", () => {
    const world = createWorld({ seed: 42, scenario: "rookie" });
    const ids = Object.keys(world.players);
    for (const id of ids.slice(0, 20)) expect(portraitIndex(id)).toBe(portraitIndex(id));
    const used = new Set(ids.map(portraitIndex));
    expect(used.size).toBeGreaterThan(80);
    for (const i of used) expect(i).toBeGreaterThanOrEqual(0), expect(i).toBeLessThan(PORTRAIT_COUNT);
  });
});

describe("attribute potential", () => {
  it("never shows less than today, keeps personality fixed and respects the cap", () => {
    const world = createWorld({ seed: 42, scenario: "rookie" });
    const p = Object.values(world.players)[0]!.player;
    expect(attributePotential(p, "ambition", 20)).toBe(p.attributes.ambition);
    expect(attributePotential(p, "chipping", 0)).toBe(p.attributes.chipping);
    expect(attributePotential(p, "chipping", 30)).toBeLessThanOrEqual(20);
    expect(attributePotential(p, "chipping", 30)).toBeGreaterThanOrEqual(p.attributes.chipping);
  });
});
