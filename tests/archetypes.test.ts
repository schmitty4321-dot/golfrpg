import { describe, expect, it } from "vitest";
import {
  APPLIED_SKEW,
  ARCHETYPES,
  ARCHETYPE_LIST,
  ATTRIBUTE_GROUPS,
  TRAIT_BY_ID,
  createRng,
  generatePlayer,
  inferArchetype,
  type ArchetypeId,
  type AttributeKey,
} from "../src/engine";
import { archetypeCeiling, createWorld, deserializeWorld, knownArchetype, overall, serializeWorld } from "../src/season";
import { flatPlayer } from "./helpers";

const GOLF: AttributeKey[] = [...ATTRIBUTE_GROUPS.longGame, ...ATTRIBUTE_GROUPS.approach, ...ATTRIBUTE_GROUPS.shortGame, ...ATTRIBUTE_GROUPS.putting];
const world = createWorld({ seed: 17, scenario: "rookie" });

describe("archetypes", () => {
  it("has the twenty, each balanced to zero across the golf skills", () => {
    expect(ARCHETYPE_LIST).toHaveLength(20);
    expect(new Set(ARCHETYPE_LIST.map((a) => a.id)).size).toBe(20);
    for (const a of ARCHETYPE_LIST) expect(GOLF.reduce((s, k) => s + (APPLIED_SKEW[a.id][k] ?? 0), 0)).toBe(0);
  });

  it("changes the shape of a player's game, never his overall level", () => {
    const make = (archetype: ArchetypeId) => generatePlayer(createRng(99), { tier: "tour", archetype, nationality: "USA" });
    const plain = overall(make("allround"));
    for (const a of ARCHETYPE_LIST) {
      const p = make(a.id);
      if (p.age >= 40) continue; // veterans lose distance on top; covered elsewhere
      expect(Math.abs(overall(p) - plain)).toBeLessThanOrEqual(0.15);
    }
    expect(make("power").attributes.drivingDistance).toBeGreaterThan(make("precision").attributes.drivingDistance);
  });

  it("only gives age-bound archetypes to the right ages", () => {
    const rng = createRng(4);
    for (let i = 0; i < 1500; i++) {
      const tier = (["elite", "tour", "fringe", "college", "junior", "veteran"] as const)[i % 6]!;
      const p = generatePlayer(rng, { tier });
      expect(p.archetype).toBeDefined();
      if (p.archetype === "oldpro") expect(p.age).toBeGreaterThanOrEqual(38);
      if (p.archetype === "wunderkind") expect(p.age).toBeLessThanOrEqual(22);
      if (p.archetype === "athlete") expect(p.age).toBeLessThan(32);
    }
  });

  it("gives a new world a spread of archetypes", () => {
    const counts = new Map<string, number>();
    for (const wp of Object.values(world.players)) counts.set(wp.player.archetype!, (counts.get(wp.player.archetype!) ?? 0) + 1);
    expect(counts.size).toBeGreaterThanOrEqual(17);
    const total = Object.keys(world.players).length;
    for (const n of counts.values()) expect(n / total).toBeLessThan(0.2);
  });

  it("recognises a player's shape from his attributes", () => {
    expect(inferArchetype(flatPlayer("a", 12, { drivingDistance: 17, drivingAccuracy: 9, aggression: 15 }))).toBe("power");
    expect(inferArchetype(flatPlayer("b", 12, { shortPutts: 16, lagPutting: 15, greenReading: 15, speedControl: 15, longIrons: 9 }))).toBe("flatstick");
    expect(inferArchetype(flatPlayer("c", 12, { aggression: 10.5 as number, professionalism: 10, ambition: 11, coachability: 10, injuryProneness: 11 }))).toBe("allround");
  });

  it("fills in older saves from their attributes, changing nothing else", () => {
    const raw = JSON.parse(serializeWorld(world)) as { players: Record<string, { player: Record<string, unknown> }> };
    const before = Object.fromEntries(Object.entries(raw.players).map(([id, wp]) => [id, JSON.stringify(wp.player.attributes)]));
    for (const wp of Object.values(raw.players)) delete wp.player.archetype;
    const loaded = deserializeWorld(JSON.stringify(raw));
    for (const [id, wp] of Object.entries(loaded.players)) {
      expect(wp.player.archetype).toBeDefined();
      expect(JSON.stringify(wp.player.attributes)).toBe(before[id]);
    }
  });

  it("shows a player's archetype to your agency only once it's known", () => {
    const w = deserializeWorld(serializeWorld(world));
    const client = w.clientIds[0]!;
    expect(knownArchetype(w, client)).toBe(w.players[client]!.player.archetype);
    const other = Object.keys(w.players).find((id) => !w.clientIds.includes(id))!;
    delete w.agency.knowledge[other];
    expect(knownArchetype(w, other)).toBeNull();
    w.agency.knowledge[other] = { accuracy: 0.39, reports: 1, absWeek: 0 };
    expect(knownArchetype(w, other)).toBeNull();
    w.agency.knowledge[other] = { accuracy: 0.4, reports: 2, absWeek: 0 };
    expect(knownArchetype(w, other)).toBe(w.players[other]!.player.archetype);
  });

  it("gives a Wunderkind extra ceiling, and renames the two traits that shared a name", () => {
    expect(archetypeCeiling({ ...flatPlayer("w", 9), archetype: "wunderkind" })).toBe(1);
    expect(archetypeCeiling({ ...flatPlayer("x", 9), archetype: "power" })).toBe(0);
    expect(ARCHETYPES.wunderkind.ceiling).toBe(1);
    expect(TRAIT_BY_ID.get("grinder")!.name).toBe("Scrapper");
    expect(TRAIT_BY_ID.get("wedge-wizard")!.name).toBe("Inside 130");
  });
});
