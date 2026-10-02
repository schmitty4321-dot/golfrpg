import { describe, expect, it } from "vitest";
import {
  RIVAL_AGENTS,
  RIVAL_PROFILES,
  bidPressure,
  competitionPenalty,
  createWorld,
  ensureRivals,
  pendingDecisions,
  relationshipOf,
  resolveDecision,
  rivalMessage,
  rivalRelationshipsSeasonEnd,
} from "../src/season";

describe("rival head agents", () => {
  it("every rival has a named agent", () => {
    for (const r of RIVAL_PROFILES) expect(RIVAL_AGENTS[r.name]?.agent).toBeTruthy();
  });

  it("send messages whose replies move the relationship", () => {
    const w = createWorld({ seed: 51, scenario: "agency" });
    const agency = RIVAL_PROFILES[0]!.name;
    expect(rivalMessage(w, agency, "beatYours", "Test Player")).toBe(true);
    // One message a month per agent.
    expect(rivalMessage(w, agency, "beatYours", "Test Player")).toBe(false);
    const msg = pendingDecisions(w).find((d) => d.kind === "message")!;
    expect(msg.from).toBe(agency);
    resolveDecision(w, msg.id, "fire");
    expect(relationshipOf(w, agency)).toBe(-12);
  });

  it("bid harder when hostile and ease off when friendly", () => {
    const w = createWorld({ seed: 52, scenario: "agency" });
    const agency = RIVAL_PROFILES[1]!.name;
    const wp = Object.values(w.players).find((x) => !x.client && x.career.status === "exempt")!;
    const neutral = competitionPenalty(w, wp, { agency, commission: 0.08 });
    ensureRivals(w).find((r) => r.name === agency)!.relationship = -80;
    expect(bidPressure(w, agency)).toBeCloseTo(1.4);
    expect(competitionPenalty(w, wp, { agency, commission: 0.08 })).toBeGreaterThan(neutral);
    ensureRivals(w).find((r) => r.name === agency)!.relationship = 80;
    expect(competitionPenalty(w, wp, { agency, commission: 0.08 })).toBeLessThan(neutral);
    rivalRelationshipsSeasonEnd(w);
    expect(relationshipOf(w, agency)).toBe(68);
  });
});
