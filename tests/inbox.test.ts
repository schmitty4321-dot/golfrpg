import { describe, expect, it } from "vitest";
import {
  DILEMMA_KEYS,
  START_TRUST,
  acceptChance,
  addDecision,
  createWorld,
  finishSeason,
  makePromises,
  pendingDecisions,
  playWeek,
  resolveDecision,
  seasonEndPromiseChecks,
  seasonWeeks,
  settleBoldClaim,
  shouldPause,
  trustOf,
  weeklyPress,
  weeklyPromiseChecks,
  type EventRecord,
  type World,
} from "../src/season";

const record = (over: Partial<EventRecord>): EventRecord => ({
  eventId: "r01",
  eventName: "Sony Open in Hawaii",
  tier: "standard",
  season: 1,
  week: 1,
  position: 1,
  label: "1",
  toPar: -18,
  earnings: 1_000_000,
  seasonPoints: 500,
  owgrPoints: 30,
  sgPerRound: 3,
  madeCut: true,
  via: "field",
  ...over,
});

describe("the inbox", () => {
  it("applies a choice's effects once, and takes the default when you play on", () => {
    const w = createWorld({ seed: 41, scenario: "agency" });
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    const before = wp.client!.happiness;
    const d = addDecision(w, {
      kind: "dilemma",
      key: "test",
      clientId: id,
      title: "t",
      text: "t",
      choices: [
        { id: "a", label: "Yes", detail: "", effects: [{ k: "mood", v: 5 }, { k: "agencyCost", v: 1000 }] },
        { id: "b", label: "No", detail: "", effects: [{ k: "mood", v: -5 }] },
      ],
      defaultChoice: "b",
      big: true,
    });
    expect(shouldPause(w)).toBe(true);
    w.agency.pauseOnDecisions = false;
    expect(shouldPause(w)).toBe(false);
    const bank = w.agency.bank;
    resolveDecision(w, d.id, "a");
    resolveDecision(w, d.id, "a"); // a second answer does nothing
    expect(wp.client!.happiness).toBeCloseTo(Math.min(100, before + 5));
    expect(w.agency.bank).toBe(bank - 1000);
    expect(w.agency.ledger.clientCare).toBe(1000);
    const d2 = addDecision(w, { kind: "dilemma", key: "test2", clientId: id, title: "t", text: "t", choices: [{ id: "x", label: "Rest", detail: "", effects: [{ k: "rest", v: 1 }] }], defaultChoice: "x", big: false });
    playWeek(w);
    expect(w.inbox!.find((x) => x.id === d2.id)!.resolved?.auto).toBe(true);
  });

  it("brings a handful of decisions over a season, never more than three a week", () => {
    const w: World = createWorld({ seed: 42, scenario: "agency" });
    let seen = 0;
    while (w.week <= seasonWeeks(w)) {
      playWeek(w);
      const now = pendingDecisions(w);
      expect(now.length).toBeLessThanOrEqual(3);
      seen += now.length;
      for (const d of now) {
        expect(d.choices.some((c) => c.id === d.defaultChoice)).toBe(true);
        expect(d.kind === "press" || d.kind === "message" || DILEMMA_KEYS.includes(d.key)).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(5);
  });

  it("rests a client who was given the week off", () => {
    const w = createWorld({ seed: 43, scenario: "agency" });
    const id = w.clientIds[0]!;
    const d = addDecision(w, { kind: "dilemma", key: "t", clientId: id, title: "t", text: "t", choices: [{ id: "x", label: "Off", detail: "", effects: [{ k: "rest", v: 0 }] }], defaultChoice: "x", big: false });
    resolveDecision(w, d.id, "x");
    const rep = playWeek(w, { [id]: { kind: "auto" } });
    for (const r of rep.results) expect(r.field.field).not.toContain(id);
  });
});

describe("press conferences", () => {
  it("follow a win, and a bold claim backfires on a missed cut", () => {
    const w = createWorld({ seed: 44, scenario: "agency" });
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    expect(weeklyPress(w, new Map([[id, record({})]]), new Set())).toBe(1);
    const press = pendingDecisions(w).find((d) => d.kind === "press")!;
    expect(press.choices.map((c) => c.id)).toEqual(expect.arrayContaining(["humble", "bold", "deflect"]));
    resolveDecision(w, press.id, "bold");
    expect(wp.client!.boldClaim).toBeDefined();
    const form = wp.player.form;
    const line = settleBoldClaim(wp, record({ season: w.season, week: w.week, madeCut: false, position: 80, label: "MC" }));
    expect(line).toMatch(/eats his words/);
    expect(wp.player.form).toBeLessThan(form);
    expect(wp.client!.boldClaim).toBeUndefined();
  });
});

describe("promises", () => {
  it("make a signing more likely, and are kept or broken by what happens", () => {
    const w = createWorld({ seed: 45, scenario: "agency" });
    const target = Object.values(w.players).find((wp) => !wp.client && wp.career.status !== "amateur" && acceptChance(w, wp.player.id, { commission: 0.1, years: 2 }) > 0.1 && acceptChance(w, wp.player.id, { commission: 0.1, years: 2 }) < 0.8)!;
    const plain = acceptChance(w, target.player.id, { commission: 0.1, years: 2 });
    expect(acceptChance(w, target.player.id, { commission: 0.1, years: 2, promises: ["eliteCoach", "camp"] })).toBeGreaterThan(plain);

    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    makePromises(w, wp, ["noOpposite", "camp"]);
    expect(trustOf(wp)).toBe(START_TRUST);
    weeklyPromiseChecks(w, new Map([[id, "opposite"]]), new Set());
    expect(wp.client!.promises!.find((p) => p.kind === "noOpposite")!.status).toBe("broken");
    expect(trustOf(wp)).toBe(START_TRUST - 20);
    wp.client!.training.winter = "camp";
    seasonEndPromiseChecks(w);
    expect(wp.client!.promises!.find((p) => p.kind === "camp")!.status).toBe("kept");
    expect(trustOf(wp)).toBe(START_TRUST - 12);
  });

  it("are kept by a client left to choose his own schedule", () => {
    const w = createWorld({ seed: 46, scenario: "agency" });
    const id = w.clientIds[0]!;
    makePromises(w, w.players[id]!, ["noOpposite"]);
    while (w.week <= seasonWeeks(w)) playWeek(w);
    expect(w.players[id]!.career.results.some((r) => r.season === w.season && r.tier === "opposite")).toBe(false);
    finishSeason(w);
    expect(w.players[id]?.client?.promises?.[0]?.status ?? "kept").toBe("kept");
  });
});
