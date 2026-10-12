// Plays one week with a client on a hole-by-hole practice trip, then the rest of the week.
import { createWorld, liveEvents, playWeek } from "../../src/season";
import { finishLive } from "../../src/engine";
const world = createWorld({ seed: 7, scenario: "rookie" });
const id = world.clientIds[0]!;
const course = world.courses[0]!.id;
const choices = { [id]: { kind: "practice" as const, courseId: course, live: true } };
const before = world.players[id]!.career.familiarity?.[course] ?? 0;
const events = liveEvents(world, choices);
console.log("live events:", events.map((e) => `${e.event.name} (${e.clientIds.length} client, ${e.tournament.round} round so far)`).join("; ") || "none");
const played = Object.fromEntries(events.map((e) => [e.event.id, finishLive(e.tournament)]));
const report = playWeek(world, choices, played);
const after = world.players[id]!.career.familiarity?.[course] ?? 0;
console.log("familiarity", before.toFixed(1), "->", after.toFixed(1), "| week reports:", report.results.length, "events");
