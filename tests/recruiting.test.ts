import { describe, expect, it } from "vitest";
import { publicRead, acceptChance, hoursFor, proProspects, rivalInterest, rivalMoves, rivalRecruitingWeek, MAX_READ, PRO_AGE, agencyList, createWorld, dealbreaker, groupRange, hoursLeft, interestIn, prospects, readOf, recruit, recruitBlock, signingDay, weeklyHours } from "../src/season";

describe("recruiting", () => {
  it("spends a weekly budget of hours, refilled each week", () => {
    const w = createWorld({ seed: 101, scenario: "agency" });
    const id = prospects(w)[0]!;
    const total = weeklyHours(w);
    recruit(w, id, "event");
    expect(hoursLeft(w)).toBe(total - 8);
    expect(() => recruit(w, id, "visit")).not.toThrow();
    expect(() => recruit(w, id, "visit")).toThrow(/this season/);
    w.week += 1;
    expect(hoursLeft(w)).toBe(total);
  });

  it("builds interest, and the read sharpens but is never exact", () => {
    const w = createWorld({ seed: 102, scenario: "agency" });
    const id = prospects(w)[1]!;
    const before = interestIn(w, id);
    recruit(w, id, "call");
    recruit(w, id, "visit");
    expect(interestIn(w, id)).toBeGreaterThan(before);
    for (let i = 0; i < 12; i++) { w.week += 1; recruit(w, id, "event"); }
    expect(readOf(w, id)).toBeLessThanOrEqual(MAX_READ);
    const r = groupRange(w, id, "putting")!;
    expect(r.high).toBeGreaterThan(r.low);
  });

  it("a prospect turning pro names three agencies, and signs on signing day with the top one", () => {
    const w = createWorld({ seed: 103, scenario: "agency" });
    w.agency.reputation = 70;
    const id = prospects(w).find((x) => w.players[x]!.player.age + 1 >= PRO_AGE && dealbreaker(w, x) === null)!;
    const wp = w.players[id]!;
    recruit(w, id, "call");
    w.agency.prospects![id]!.interest = 2;
    if (!agencyList(w, id).slice(0, 3).some((a) => a.you)) expect(recruitBlock(w, id)).toMatch(/narrowed/);
    w.agency.prospects![id]!.interest = 100;
    expect(recruitBlock(w, id)).toBeNull();
    const msg = signingDay(w, wp);
    expect(msg).toMatch(/commits to|roster is full/);
    if (/commits to/.test(msg!)) expect(wp.client).toBeDefined();
  });

  it("the rival agencies work the prospects every week", () => {
    const w = createWorld({ seed: 104, scenario: "agency" });
    const top = prospects(w)[0]!;
    const before = Object.values(rivalInterest(w, top)).reduce((a, b) => a + b, 0);
    for (let i = 0; i < 8; i++) { rivalRecruitingWeek(w); w.week += 1; }
    const after = Object.values(rivalInterest(w, top)).reduce((a, b) => a + b, 0);
    expect(after).toBeGreaterThan(before);
    expect(rivalMoves(w, top).length).toBeGreaterThan(0);
  });

  it("pros share the same hours, with their own activities, a public read, and interest that helps an offer", () => {
    const w = createWorld({ seed: 105, scenario: "agency" });
    w.agency.reputation = 50;
    const pro = proProspects(w, 120).slice(40).find((id) => !w.players[id]!.agent || w.players[id]!.agent!.untilSeason <= w.season)!;
    // Pros have their own activities, and their public numbers give a read before any scouting.
    expect(() => recruit(w, pro, "call")).toThrow(/amateurs/);
    expect(publicRead(w, pro)).toBeGreaterThanOrEqual(0.25);
    expect(groupRange(w, pro, "putting")).not.toBeNull();
    const left = hoursLeft(w);
    recruit(w, pro, "camp");
    expect(hoursLeft(w)).toBe(left - hoursFor(w, pro, "camp"));
    const offer = { commission: 0.1, years: 2 };
    w.agency.prospects![pro]!.interest = 10;
    const cold = acceptChance(w, pro, offer);
    w.agency.prospects![pro]!.interest = 90;
    expect(acceptChance(w, pro, offer)).toBeGreaterThan(cold);
  });
});

