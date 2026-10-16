import { describe, expect, it } from "vitest";
import { createWorld, hireScout, pendingDecisions, playWeek, queueScouting, reportAccuracy, resolveDecision, scoutBlock, scoutOnTrip, scoutingWeek, sendScout, tripCostPerWeek } from "../src/season";

describe("scouting trips", () => {
  it("no scout is available once the one at home has a player waiting and the other is away", () => {
    const w = createWorld({ seed: 4, scenario: "agency" });
    w.agency.hiredScouts = [];
    expect(scoutBlock(w)).toBe("No scouts hired");
    const [a, b] = [...w.agency.scouts].sort((x, y) => y.quality - x.quality);
    hireScout(w, a!.id);
    hireScout(w, b!.id);
    expect(sendScout(w, a!.id, "NA", "amateurs", 3)).toBeNull();
    expect(scoutBlock(w)).toBeNull();
    const target = Object.values(w.players).find((wp) => !wp.client && wp.career.status === "exempt")!.player.id;
    queueScouting(w, target);
    expect(scoutBlock(w)).toBe("No scout available");
    // Still busy once he has started on the player.
    scoutingWeek(w);
    expect(w.agency.scoutingQueue).toEqual([]);
    expect(w.agency.intelJobs?.length).toBe(1);
    expect(scoutBlock(w)).toBe("No scout available");
  });

  it("send a hired scout away, sharpen his reports, and end with a report in the inbox", () => {
    const w = createWorld({ seed: 121, scenario: "agency" });
    const scout = w.agency.scouts[w.agency.scouts.length - 1]!;
    expect(sendScout(w, scout.id, "EU", "amateurs", 3)).toMatch(/Hire/);
    hireScout(w, scout.id);
    expect(sendScout(w, scout.id, "NA", "amateurs", 3)).toBeNull();
    expect(sendScout(w, scout.id, "EU", "amateurs", 3)).toMatch(/away/);
    // While he's away he doesn't work the queue at home.
    const queued = Object.values(w.players).find((wp) => !wp.client && wp.career.status === "exempt")!.player.id;
    queueScouting(w, queued);
    const spent = w.agency.ledger.scouts;
    playWeek(w);
    expect(w.agency.scoutingQueue).toContain(queued);
    const trip = scoutOnTrip(w, scout.id)!;
    expect(trip.found.length).toBeGreaterThanOrEqual(2);
    expect(w.agency.knowledge[trip.found[0]!]!.accuracy).toBeGreaterThanOrEqual(0.3);
    // The trip is paid for (the bank can still rise if a client wins that week).
    expect(w.agency.ledger.scouts - spent).toBeGreaterThanOrEqual(tripCostPerWeek("EU"));
    playWeek(w);
    playWeek(w);
    expect(scoutOnTrip(w, scout.id)).toBeUndefined();
    const report = pendingDecisions(w).find((d) => d.key.startsWith("trip-"))!;
    expect(report).toBeDefined();
    const found = report.choices.find((c) => c.id === "board")!.effects[0]! as { ids: string[] };
    for (const id of found.ids) expect(w.agency.knowledge[id]!.accuracy).toBeGreaterThanOrEqual(reportAccuracy(scout.quality, 0) - 1e-9);
    // The trip report on the Scouting page lists everyone he saw, with the scout and region.
    const tripReport = w.agency.tripReports![0]!;
    expect(tripReport.scoutName).toBe(scout.name);
    expect(tripReport.region).toBe("EU");
    expect(tripReport.found).toEqual(found.ids);
    resolveDecision(w, report.id, "board");
    for (const id of found.ids) expect(w.agency.shortlist).toContain(id);
  });
});
