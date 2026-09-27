import { describe, expect, it } from "vitest";
import { createWorld, deserializeWorld, eventsInWeek, familiarityWith, playWeek, practiceCourses, practiceTripCost, serializeWorld, clientOptions, type World } from "../src/season";

const base = createWorld({ seed: 44, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

describe("practice", () => {
  it("a practice trip takes the week, costs travel and fees, and teaches him the course", () => {
    const rested = fresh();
    const trip = fresh();
    const id = trip.clientIds[0]!;
    const course = practiceCourses(trip).find((c) => c.courseId !== eventsInWeek(trip)[0]!.courseId)!.courseId;
    const before = familiarityWith(trip.players[id]!, course);
    playWeek(rested, { [id]: { kind: "rest" } });
    const report = playWeek(trip, { [id]: { kind: "practice", courseId: course } });
    const wp = trip.players[id]!;
    expect(familiarityWith(wp, course)).toBeGreaterThan(before);
    expect(wp.client!.finances.travel).toBe(practiceTripCost(trip, course));
    expect(wp.player.condition).toBeLessThan(rested.players[id]!.player.condition);
    expect(report.clients[id]!.summary).toMatch(/practising at/);
    expect(report.clients[id]!.record).toBeNull();
  }, 60_000);

  it("a practice round before the event adds to what the event itself teaches him", () => {
    const plain = fresh();
    const practised = fresh();
    const id = plain.clientIds[0]!;
    const option = clientOptions(plain, id).find((o) => o.access === "in" || o.access === "invited");
    if (!option) return; // no event he can enter this week in this world
    playWeek(plain, { [id]: { kind: "enter", eventId: option.event.id } });
    playWeek(practised, { [id]: { kind: "enter", eventId: option.event.id, practice: true } });
    const c = option.event.courseId;
    expect(familiarityWith(practised.players[id]!, c)).toBeGreaterThan(familiarityWith(plain.players[id]!, c));
    expect(practised.players[id]!.client!.finances.travel).toBeGreaterThan(plain.players[id]!.client!.finances.travel);
  }, 60_000);
});
