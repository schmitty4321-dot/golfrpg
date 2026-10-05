import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import { INVESTMENTS, academyIntake, buyInvestment, createWorld, investBlock, owns, rivalBids, sponsorPicks, titleEvent } from "../src/season";

describe("new investments", () => {
  it("run from reputation 5 to 90", () => {
    const reps = Object.values(INVESTMENTS).map((d) => d.reputation);
    expect(Math.min(...reps)).toBe(5);
    expect(reps.filter((r) => r === 75)).toHaveLength(2);
    expect(Math.max(...reps)).toBe(90);
    const w = createWorld({ seed: 71, scenario: "agency" });
    w.agency.reputation = 6;
    w.agency.bank = 1_000_000;
    expect(investBlock(w, "academy")).toBeNull();
    expect(investBlock(w, "media")).toMatch(/reputation 10/);
  });

  it("the academy finds a junior who's yours to approach first", () => {
    const w = createWorld({ seed: 72, scenario: "agency" });
    w.agency.reputation = 30;
    w.agency.bank = 1_000_000;
    buyInvestment(w, "academy");
    w.season += 4; // a well-established academy: 50% a winter
    let junior = null;
    for (let i = 0; i < 20 && !junior; i++) junior = academyIntake(w, createRng(i), (age) => ({ ...Object.values(w.players).find((p) => p.career.status === "amateur")!, player: { ...Object.values(w.players).find((p) => p.career.status === "amateur")!.player, id: `acad${i}`, age } }));
    expect(junior).not.toBeNull();
    expect(junior!.academy).toBe(true);
    expect(w.agency.shortlist).toContain(junior!.player.id);
    expect(w.agency.knowledge[junior!.player.id]!.accuracy).toBe(1);
    expect(rivalBids(w, junior!.player.id)).toEqual([]);
  });

  it("a title partnership invites clients without status into its event", () => {
    const w = createWorld({ seed: 73, scenario: "agency" });
    w.agency.reputation = 80;
    w.agency.bank = 50_000_000;
    buyInvestment(w, "titleEvent");
    expect(owns(w, "titleEvent")).toBe(true);
    const event = w.schedule.find((e) => e.id === titleEvent(w))!;
    const client = w.players[w.clientIds[0]!]!;
    client.career.status = "none";
    expect(sponsorPicks(w, event, [client.player.id], 2)).toContain(client.player.id);
  });
});
