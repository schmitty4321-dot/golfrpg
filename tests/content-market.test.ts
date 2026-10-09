import { describe, expect, it } from "vitest";
import { EQUIPMENT, EQUIPMENT_SLOTS } from "../src/engine";
import { generateCaddies, generateCoaches } from "../src/season";
import { PLAYER_PORTRAIT_CATALOG, portraitSpec } from "../src/ui/components/Portrait";

describe("expanded illustrated markets", () => {
  it("offers 25 coaches in every specialty", () => {
    const coaches = generateCoaches(42);
    expect(coaches).toHaveLength(125);
    for (const role of ["swing", "shortGame", "putting", "mental", "fitness"]) {
      expect(coaches.filter((c) => c.role === role)).toHaveLength(25);
    }
    expect(new Set(coaches.map((c) => c.name)).size).toBe(125);
  });

  it("offers 100 distinct caddies", () => {
    const caddies = generateCaddies(42);
    expect(caddies).toHaveLength(100);
    expect(new Set(caddies.map((c) => c.name)).size).toBe(100);
  });

  it("offers 100 models in every equipment slot with varied prices", () => {
    for (const slot of EQUIPMENT_SLOTS) {
      const models = EQUIPMENT.filter((e) => e.slot === slot);
      expect(models).toHaveLength(100);
      expect(new Set(models.map((e) => e.price)).size).toBeGreaterThan(10);
    }
  });

  it("provides a stable 400-face cartoon portrait catalog", () => {
    expect(PLAYER_PORTRAIT_CATALOG).toHaveLength(400);
    const looks = PLAYER_PORTRAIT_CATALOG.map((id) => JSON.stringify(portraitSpec({ id, nationality: "USA", age: 20 + (Number(id.split("-").at(-1)) % 35) })));
    expect(new Set(looks).size).toBeGreaterThan(175);
  });
});
