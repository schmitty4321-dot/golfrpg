import { describe, expect, it } from "vitest";
import { NATIONS, NATION_LIST, createRng, generatePlayer, nationFromRoll, nationInfo } from "../src/engine";
import { FLAG_CODES } from "../src/ui/components/Flag";
import { portraitSpec } from "../src/ui/components/Portrait";
import { attributePotential, createWorld } from "../src/season";

const world = createWorld({ seed: 42, scenario: "rookie" });
const pros = Object.values(world.players).filter((wp) => wp.career.status !== "amateur");

describe("player pictures", () => {
  it("gives a player the same picture every time, and nearly everyone a different one", () => {
    const p = pros[0]!.player;
    expect(portraitSpec(p)).toEqual(portraitSpec(p));
    const looks = new Set(pros.map((wp) => JSON.stringify(portraitSpec(wp.player))));
    expect(looks.size).toBeGreaterThan(pros.length * 0.95);
  });

  it("draws most players in a cap, like the tour", () => {
    const caps = pros.filter((wp) => portraitSpec(wp.player).headwear === "cap").length;
    expect(caps / pros.length).toBeGreaterThan(0.55);
    expect(caps / pros.length).toBeLessThan(0.8);
  });

  it("greys older players' hair", () => {
    const grey = (age: number) =>
      Array.from({ length: 200 }, (_, i) => portraitSpec({ id: `g${i}`, nationality: "USA", age })).filter((s) => ["#a09b94", "#c9c5bf"].includes(s.hair)).length;
    expect(grey(25)).toBe(0);
    expect(grey(48)).toBeGreaterThan(grey(40));
  });

  it("colours a player from where he's from, as a likelihood", () => {
    const specs = (nationality: string) => Array.from({ length: 300 }, (_, i) => portraitSpec({ id: `s${i}`, nationality, age: 28 }));
    // Americans cover the whole range of skin tones.
    expect(new Set(specs("USA").map((s) => s.skin)).size).toBe(8);
    const blond = (nationality: string) => specs(nationality).filter((s) => s.hair === "#c9a066").length;
    expect(blond("Sweden")).toBeGreaterThan(blond("Japan"));
  });
});

describe("nationalities", () => {
  it("follows the 2026 tour's mix: about two-thirds American, 28 other countries and territories", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 20000; i++) {
      const n = nationFromRoll(i / 20000).key;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect(counts.get("USA")! / 20000).toBeCloseTo(174 / 260, 2);
    expect([...counts.keys()].filter((k) => k !== "USA").length).toBe(28);
    expect(counts.get("England")!).toBeGreaterThan(counts.get("Canada")!);
    expect(counts.has("Spain")).toBe(false);
  });

  it("gives a new world a tour that looks like the real one", () => {
    const usa = pros.filter((wp) => wp.player.nationality === "USA").length / pros.length;
    expect(usa).toBeGreaterThan(0.55);
    expect(usa).toBeLessThan(0.78);
    expect(new Set(pros.map((wp) => wp.player.nationality)).size).toBeGreaterThan(15);
  });

  it("keeps names unique without running out", () => {
    const rng = createRng(3);
    const used = new Set<string>();
    const names = Array.from({ length: 400 }, () => generatePlayer(rng, { tier: "tour", nationality: "USA", usedNames: used }).name);
    expect(new Set(names).size).toBe(400);
    expect(names.filter((n) => /\b[A-Z]\. /.test(n)).length).toBeLessThan(40);
  });

  it("has a flag, a code and names for every country, and a sensible label for anything typed in", () => {
    for (const n of NATION_LIST) {
      expect(FLAG_CODES).toContain(n.code);
      expect(n.first.length).toBeGreaterThanOrEqual(3);
      expect(n.last.length).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(NATION_LIST.map((n) => n.code)).size).toBe(NATION_LIST.length);
    expect(nationInfo("Korea")).toEqual({ name: "South Korea", code: "KOR", known: true });
    expect(nationInfo("Wales")).toEqual({ name: "Wales", code: "WAL", known: false });
    expect(NATIONS.USA!.region).toBe("NA");
  });
});

describe("attribute potential", () => {
  it("never shows less than today, keeps personality fixed and respects the cap", () => {
    const p = Object.values(world.players)[0]!.player;
    expect(attributePotential(p, "ambition", 20)).toBe(p.attributes.ambition);
    expect(attributePotential(p, "chipping", 0)).toBe(p.attributes.chipping);
    expect(attributePotential(p, "chipping", 30)).toBeLessThanOrEqual(20);
    expect(attributePotential(p, "chipping", 30)).toBeGreaterThanOrEqual(p.attributes.chipping);
  });
});
