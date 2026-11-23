import { describe, expect, it } from "vitest";
import {
  BASE_ASKS,
  askBlock,
  askExemption,
  asksAllowed,
  asksLeft,
  buildFields,
  createWorld,
  deserializeWorld,
  exemptionBoard,
  exemptionOdds,
  exemptionSpots,
  hasExemption,
  planWeek,
  playWeek,
  serializeWorld,
  type World,
} from "../src/season";

const base = createWorld({ seed: 77, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
const clientOf = (w: World) => w.players[w.clientIds[0]!]!;
const firstOf = (w: World, tier: string) => w.schedule.filter((e) => e.tier === tier && e.format !== "matchplay").sort((a, b) => a.week - b.week)[0]!;

describe("sponsor exemptions", () => {
  it("gives 4 a regular event, 2 a signature event, none at majors, playoffs, match play or the dev tour", () => {
    const w = fresh();
    expect(exemptionSpots(firstOf(w, "standard"))).toBe(4);
    expect(exemptionSpots(firstOf(w, "opposite"))).toBe(4);
    expect(exemptionSpots(firstOf(w, "signature"))).toBe(2);
    expect(exemptionSpots(firstOf(w, "major"))).toBe(0);
    expect(exemptionSpots(firstOf(w, "playoff"))).toBe(0);
    expect(exemptionSpots(firstOf(w, "dev"))).toBe(0);
    expect(exemptionSpots(w.schedule.find((e) => e.format === "matchplay")!)).toBe(0);
  });

  it("odds rise with reputation, Q rating and developmental wins; signature events are harder; the title event is near certain", () => {
    const w = fresh();
    const c = clientOf(w);
    const ev = w.schedule.find((e) => e.tier === "standard" && e.week > 1)!;
    w.agency.reputation = 10;
    const low = exemptionOdds(w, c, ev).chance;
    w.agency.reputation = 80;
    const high = exemptionOdds(w, c, ev).chance;
    expect(high).toBeGreaterThan(low);
    c.client!.qRating = 75;
    const famous = exemptionOdds(w, c, ev).chance;
    expect(famous).toBeGreaterThan(high);
    c.client!.qRating = 40;
    const before = exemptionOdds(w, c, ev).chance;
    c.career.results.push({ eventId: "dev-x", eventName: "Dev", tier: "dev", season: w.season, week: 1, position: 1, label: "1", toPar: -10, earnings: 1, seasonPoints: 0, owgrPoints: 0, sgPerRound: 0, madeCut: true, via: "field" });
    expect(exemptionOdds(w, c, ev).chance).toBeGreaterThan(before);
    expect(exemptionOdds(w, c, firstOf(w, "signature")).chance).toBeLessThan(exemptionOdds(w, c, ev).chance);
    w.agency.investments = [{ kind: "titleEvent", since: w.season, stake: 1, eventId: ev.id }];
    expect(exemptionOdds(w, c, ev).read).toBe("Nearly certain");
  });

  it("limits asks per season: 3, more with reputation, and a no uses one up", () => {
    const w = fresh();
    const c = clientOf(w);
    c.career.status = "none";
    w.agency.reputation = 10;
    expect(asksAllowed(w)).toBe(BASE_ASKS);
    w.agency.reputation = 85;
    expect(asksAllowed(w)).toBe(BASE_ASKS + 2);
    w.agency.reputation = 10;
    const events = w.schedule.filter((e) => e.tier === "standard" && e.week > 2).slice(0, 4);
    for (const e of events.slice(0, 3)) expect(askBlock(w, c.player.id, e.id)).toBeNull(), askExemption(w, c.player.id, e.id);
    expect(asksLeft(w)).toBe(0);
    expect(askBlock(w, c.player.id, events[3]!.id)).toMatch(/No asks left/);
    expect(askBlock(w, c.player.id, events[0]!.id)).toMatch(/asked/);
    expect(askBlock(w, c.player.id, firstOf(w, "major").id)).toMatch(/Majors/);
    // Play to the first event's week: the answer arrives in the inbox by the Monday, and still counts.
    while (w.week < events[0]!.week) playWeek(w);
    const ask = w.agency.exemptions!.find((a) => a.eventId === events[0]!.id)!;
    expect(ask.answer).toMatch(/yes|no/);
    expect((w.inbox ?? []).some((d) => d.key === `exemption-${events[0]!.id}`)).toBe(true);
    expect(asksLeft(w)).toBe(0);
  });

  it("answers the same way every time (seeded)", () => {
    const run = () => {
      const w = fresh();
      const c = clientOf(w);
      c.career.status = "none";
      const e = w.schedule.find((x) => x.tier === "standard" && x.week === w.week) ?? w.schedule.find((x) => x.tier === "standard")!;
      while (w.week < e.week) playWeek(w);
      askExemption(w, c.player.id, e.id);
      return w.agency.exemptions!.map((a) => a.answer).join();
    };
    expect(run()).toBe(run());
  });

  it("puts an exempted client in the field, fills the rest with computer picks, and keeps field sizes", () => {
    const w = fresh();
    const c = clientOf(w);
    c.career.status = "none";
    c.injury = null;
    c.player.condition = 95;
    const e = w.schedule.find((x) => x.tier === "standard" && x.week > 1 && x.region === "NA")!;
    while (w.week < e.week) playWeek(w);
    w.agency.exemptions = [{ playerId: c.player.id, eventId: e.id, season: w.season, week: 1, answer: "yes" }];
    expect(hasExemption(w, c.player.id, e.id)).toBe(true);
    const plan = planWeek(w, new Map());
    const exempt = plan.exemptions!.get(e.id)!;
    expect(exempt[0]).toBe(c.player.id);
    expect(exempt).toHaveLength(4);
    const fields = buildFields(w, plan);
    const f = fields.find((x) => x.event.id === e.id)!;
    expect(f.field).toContain(c.player.id);
    expect(f.sponsorInvites).toContain(c.player.id);
    expect(f.sponsorInvites!.length).toBe(4);
    expect(f.field.length).toBeLessThanOrEqual(e.fieldSize);
    expect(new Set(f.field).size).toBe(f.field.length);
    // Nobody plays two events.
    const all = fields.flatMap((x) => x.field);
    expect(new Set(all).size).toBe(all.length);
    const report = playWeek(w);
    expect(report.clients[c.player.id]!.record?.via).toBe("sponsor");
  });

  it("signature events take 2 exemptions and stay at or under their field size", () => {
    const w = fresh();
    const e = firstOf(w, "signature");
    while (w.week < e.week) playWeek(w);
    const plan = planWeek(w, new Map());
    expect(plan.exemptions!.get(e.id)!.length).toBeLessThanOrEqual(2);
    const f = buildFields(w, plan).find((x) => x.event.id === e.id)!;
    expect(f.field.length).toBeLessThanOrEqual(e.fieldSize);
  });

  it("exemptions come off the bottom of the status order: an oversubscribed field stays at its size", () => {
    const w = fresh();
    const e = w.schedule.find((x) => x.tier === "standard" && x.week === w.week)!;
    const plan = planWeek(w, new Map());
    const exempt = new Set(plan.exemptions!.get(e.id)!);
    for (const wp of Object.values(w.players)) {
      if (exempt.has(wp.player.id) || wp.injury || wp.career.status === "none" || wp.career.status === "amateur") continue;
      plan.choices.set(wp.player.id, { eventId: e.id, route: "entry" });
    }
    const f = buildFields(w, plan).find((x) => x.event.id === e.id)!;
    expect(f.field.length).toBe(e.fieldSize);
    expect(f.sponsorInvites).toHaveLength(4);
    // Status players are pushed down to alternates (they can still try Monday).
    expect(f.alternates.length).toBeGreaterThan(0);
  });

  it("never plays a week's empty extra event just for exemptions", () => {
    const w = fresh();
    const mp = w.schedule.find((x) => x.format === "matchplay")!;
    while (w.week < mp.week) playWeek(w);
    const plan = planWeek(w, new Map());
    const other = plan.events.find((x) => x.id !== mp.id && x.tier === "standard");
    if (other) {
      const n = [...plan.choices.values()].filter((c) => c?.eventId === other.id).length;
      expect(n === 0 || n > 4).toBe(true);
    }
  });

  it("loads an old save without the new field and shows the schedule board", () => {
    const w = fresh();
    const raw = JSON.parse(serializeWorld(w));
    delete raw.agency.exemptions;
    const loaded = deserializeWorld(JSON.stringify(raw));
    expect(loaded.agency.exemptions).toEqual([]);
    clientOf(loaded).career.status = "none";
    const board = exemptionBoard(loaded);
    const row = board.get(w.schedule.find((e) => e.tier === "standard" && e.week >= loaded.week)!.id)?.[0];
    expect(row?.state).toBe("ask");
    expect(row?.odds.read.length).toBeGreaterThan(0);
  });
});
