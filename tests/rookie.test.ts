import { describe, expect, it } from "vitest";
import { ATTRIBUTE_GROUPS, createRng, generatePlayer } from "../src/engine";
import { overall, shapeRookie } from "../src/season";

const GOLF = [...ATTRIBUTE_GROUPS.longGame, ...ATTRIBUTE_GROUPS.approach, ...ATTRIBUTE_GROUPS.shortGame, ...ATTRIBUTE_GROUPS.putting];
const MENTAL = ATTRIBUTE_GROUPS.mental.filter((k) => k !== "aggression");

describe("the rookie's starting profile", () => {
  it("has one strength, two or three weaknesses, a middling rest and an unproven head", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = generatePlayer(createRng(seed), { tier: "fringe", nationality: "USA" });
      shapeRookie(p, createRng(seed + 1000));
      const g = GOLF.map((k) => p.attributes[k]);
      expect(g.filter((v) => v >= 14 && v <= 16)).toHaveLength(1);
      expect(g.filter((v) => v > 16)).toHaveLength(0);
      const weak = g.filter((v) => v >= 7 && v <= 9).length;
      expect(weak).toBeGreaterThanOrEqual(2);
      expect(weak).toBeLessThanOrEqual(3);
      expect(g.filter((v) => v >= 10 && v <= 12)).toHaveLength(GOLF.length - 1 - weak);
      for (const k of MENTAL) expect(p.attributes[k]).toBeGreaterThanOrEqual(8), expect(p.attributes[k]).toBeLessThanOrEqual(11);
      expect(overall(p)).toBeGreaterThanOrEqual(10.3);
      expect(overall(p)).toBeLessThanOrEqual(11.5);
    }
  });
});
