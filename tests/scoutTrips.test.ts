import { describe, expect, it } from "vitest";
import { createWorld, hireScout, pendingDecisions, playWeek, queueScouting, reportAccuracy, resolveDecision, scoutOnTrip, sendScout } from "../src/season";

describe("scouting trips", () => {
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
    const bank = w.agency.bank;
    playWeek(w);
    expect(w.agency.scoutingQueue).toContain(queued);
    const trip = scoutOnTrip(w, scout.id)!;
    expect(trip.found.length).toBeGreaterThanOrEqual(2);
    expect(w.agency.knowledge[trip.found[0]!]!.accuracy).toBeGreaterThanOrEqual(0.3);
    expect(w.agency.bank).toBeLessThan(bank);
    playWeek(w);
    playWeek(w);
    expect(scoutOnTrip(w, scout.id)).toBeUndefined();
    const report = pendingDecisions(w).find((d) => d.key.startsWith("trip-"))!;
    expect(report).toBeDefined();
    const found = report.choices.find((c) => c.id === "board")!.effects[0]! as { ids: string[] };
    for (const id of found.ids) expect(w.agency.knowledge[id]!.accuracy).toBeGreaterThanOrEqual(reportAccuracy(scout.quality, 0) - 1e-9);
    resolveDecision(w, report.id, "board");
    for (const id of found.ids) expect(w.agency.shortlist).toContain(id);
  });
});
