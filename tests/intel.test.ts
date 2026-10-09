import { describe, expect, it } from "vitest";
import { createWorld, hireScout, intelRegionOf, intelWeeks, queueScouting, ratingsFullyKnown, revealedRatings, scoutedAttribute, scoutingWeek, setHqRegion, type World, type WorldPlayer } from "../src/season";

/** A fresh world with the best scout hired, and the first six non-client players picked out. */
function setup(): { w: World; ps: WorldPlayer[] } {
  const w = createWorld({ seed: 77, scenario: "agency" });
  const best = [...w.agency.scouts].sort((a, b) => b.quality - a.quality)[0]!;
  // Only the best scout on the payroll, so the caps are his alone.
  w.agency.hiredScouts = [];
  hireScout(w, best.id);
  const ps = Object.values(w.players).filter((p) => !p.client).slice(0, 6);
  return { w, ps };
}
const inState = (wp: WorldPlayer, state: string): void => {
  wp.player.nationality = "USA";
  wp.school = { kind: "high", state };
};
const abroad = (wp: WorldPlayer): void => {
  wp.player.nationality = "ENG";
};

describe("intel by distance", () => {
  it("places a player by his state's quarter, or overseas", () => {
    const { ps } = setup();
    inState(ps[0]!, "Michigan");
    inState(ps[1]!, "Texas");
    abroad(ps[2]!);
    expect(intelRegionOf(ps[0]!)).toBe("North");
    expect(intelRegionOf(ps[1]!)).toBe("South");
    expect(intelRegionOf(ps[2]!)).toBe("overseas");
  });

  it("takes a week at home, two elsewhere in the USA, and three overseas, and follows the HQ", () => {
    const { w, ps } = setup();
    inState(ps[0]!, "Michigan");
    inState(ps[1]!, "Texas");
    abroad(ps[2]!);
    expect(intelWeeks(w, ps[0]!)).toBe(1);
    expect(intelWeeks(w, ps[1]!)).toBe(2);
    expect(intelWeeks(w, ps[2]!)).toBe(3);
    setHqRegion(w, "South");
    expect(intelWeeks(w, ps[0]!)).toBe(2);
    expect(intelWeeks(w, ps[1]!)).toBe(1);
  });

  it("lets a scout work on two players in the same region at once, and no more", () => {
    const { w, ps } = setup();
    for (const p of ps.slice(0, 3)) inState(p, "Michigan");
    for (const p of ps.slice(0, 3)) queueScouting(w, p.player.id);
    scoutingWeek(w);
    expect(w.agency.intelJobs).toHaveLength(2);
    expect(w.agency.scoutingQueue).toEqual([ps[2]!.player.id]);
  });

  it("lets a scout work on three overseas players at once", () => {
    const { w, ps } = setup();
    for (const p of ps.slice(0, 4)) abroad(p);
    for (const p of ps.slice(0, 4)) queueScouting(w, p.player.id);
    scoutingWeek(w);
    expect(w.agency.intelJobs).toHaveLength(3);
    expect(w.agency.intelJobs!.every((j) => j.weeksLeft === 3)).toBe(true);
    expect(w.agency.scoutingQueue).toEqual([ps[3]!.player.id]);
  });

  it("files the report when the weeks run out, and frees the scout for the next player", () => {
    const { w, ps } = setup();
    for (const p of ps.slice(0, 3)) inState(p, "Michigan");
    for (const p of ps.slice(0, 3)) queueScouting(w, p.player.id);
    scoutingWeek(w);
    const done = scoutingWeek(w);
    expect(done.sort()).toEqual([ps[0]!.player.id, ps[1]!.player.id].sort());
    expect(w.agency.knowledge[ps[0]!.player.id]!.accuracy).toBeGreaterThan(0);
    expect(w.agency.intelJobs!.map((j) => j.playerId)).toEqual([ps[2]!.player.id]);
    expect(w.agency.scoutingQueue).toEqual([]);
  });
});

describe("ratings come into view by trip", () => {
  it("reveals ten ratings a trip, and all of them by the third", () => {
    const { w, ps } = setup();
    const id = ps[0]!.player.id;
    w.agency.knowledge[id] = { accuracy: 0.5, reports: 1, absWeek: 0 };
    expect(revealedRatings(w, id)).toHaveLength(10);
    expect(scoutedAttribute(w, id, revealedRatings(w, id)[0]!)).not.toBeNull();
    w.agency.knowledge[id] = { accuracy: 0.8, reports: 3, absWeek: 0 };
    expect(ratingsFullyKnown(w, id)).toBe(true);
    w.agency.knowledge[id] = { accuracy: 0.5, reports: 1, absWeek: 0 };
    expect(ratingsFullyKnown(w, id)).toBe(false);
  });
});
