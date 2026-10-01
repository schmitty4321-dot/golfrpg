import { describe, expect, it } from "vitest";
import {
  autoFinishRound,
  callOdds,
  clientActive,
  createRng,
  decisionsFor,
  finishLive,
  generateTourField,
  getCourse,
  liveBoard,
  liveSnapshot,
  playLiveHole,
  simulateTournament,
  startLive,
  startLiveRound,
  traceHole,
  type TournamentConfig,
} from "../src/engine";
import { createWorld, deserializeWorld, liveEvents, playWeek, serializeWorld } from "../src/season";
import { flatPlayer } from "./helpers";

const field = generateTourField(createRng(5), 120);
const config = (seed = 9): TournamentConfig => ({ name: "Live Open", course: getCourse("tpc-sawgrass"), field, purse: 9_000_000, seed, cutTop: 65 });
const me = field[40]!.id;

describe("live tournaments", () => {
  it("play to a full result, with the client's calls recorded", () => {
    const t = startLive(config(), me);
    startLiveRound(t);
    for (let i = 0; i < 18; i++) playLiveHole(t, i === 16 ? { approach: "middle" } : null);
    expect(t.current).toBeNull();
    const r = finishLive(t);
    const row = r.leaderboard.find((x) => x.player.id === me)!;
    expect(row.rounds.length).toBe(row.madeCut ? 4 : 2);
    expect(row.holes[0]).toHaveLength(18);
    expect(row.calls![0]![16]).toEqual({ approach: "middle" });
    expect(row.calls![0]![0]).toBeNull();
    expect(r.leaderboard.map((x) => x.position)).toEqual([...r.leaderboard.map((x) => x.position)].sort((a, b) => a - b));
  });

  it("never change anyone else's rounds with the client's calls", () => {
    const a = startLive(config(), me);
    const b = startLive(config(), me);
    for (const t of [a, b]) {
      for (let r = 0; r < 2; r++) {
        startLiveRound(t);
        for (let i = 0; i < 18; i++) playLiveHole(t, t === a ? { approach: "attack", tee: "driver" } : { approach: "middle", tee: "iron" });
      }
    }
    const others = (t: typeof a) => liveSnapshot(t).leaderboard.filter((x) => x.player.id !== me).map((x) => [x.player.id, x.rounds.join()]).sort();
    expect(others(a)).toEqual(others(b));
  });

  it("score like any other tournament when you leave him to it", () => {
    let live = 0;
    let sim = 0;
    for (let s = 0; s < 12; s++) {
      const t = startLive(config(100 + s), me);
      const r = finishLive(t);
      const rows = r.leaderboard.filter((x) => x.madeCut);
      live += rows.reduce((a, x) => a + x.toPar, 0) / rows.length;
      const q = simulateTournament(config(100 + s)).leaderboard.filter((x) => x.madeCut);
      sim += q.reduce((a, x) => a + x.toPar, 0) / q.length;
    }
    // Same engine, different random draws: about a stroke at most on the cut players' average.
    expect(Math.abs(live - sim) / 12).toBeLessThan(1);
  });

  it("shows the leaderboard through the same hole as the client", () => {
    const t = startLive(config(), me);
    startLiveRound(t);
    for (let i = 0; i < 5; i++) playLiveHole(t);
    const board = liveBoard(t);
    expect(board.every((r) => r.thru === 5)).toBe(true);
    autoFinishRound(t);
    const completed = liveBoard(t);
    expect(completed.every((r) => r.thru === 18)).toBe(true);
    expect(completed.find((r) => r.player.id === me)!.toPar).toBe(
      t.entries.find((entry) => entry.player.id === me)!.rounds[0]! - t.par,
    );
    expect(clientActive(t)).toBe(true);
  });
});

describe("calls", () => {
  it("trade risk for reward the way they say", () => {
    const course = getCourse("tpc-sawgrass");
    // A tour-average player, so the test is about the call and not one golfer's irons.
    const avg = flatPlayer("avg", 12);
    const t = startLive({ ...config(), field: [...field.slice(0, 40), avg, ...field.slice(41)] }, avg.id);
    startLiveRound(t);
    for (let i = 0; i < 16; i++) playLiveHole(t);
    expect(course.holes[16]!.par).toBe(3); // the island green
    const attack = callOdds(t, { approach: "attack" });
    const middle = callOdds(t, { approach: "middle" });
    expect(attack.birdie).toBeGreaterThan(middle.birdie);
    expect(attack.bogey).toBeGreaterThan(middle.bogey);
  });

  it("come up only at key moments", () => {
    const course = getCourse("tpc-sawgrass");
    const long = flatPlayer("long", 12, { drivingDistance: 19, longIrons: 16 });
    const par5 = course.holes.find((h) => h.par === 5 && h.yards < 540)!;
    const kinds = (round: number, index: number, behind: number) => decisionsFor(par5, course, long, { round, index, behind, cutMargin: null }).map((d) => d.kind);
    expect(kinds(1, 0, 0)).toContain("second");
    expect(kinds(1, 0, 0)).not.toContain("putt");
    expect(decisionsFor(course.holes[17]!, course, long, { round: 4, index: 17, behind: 1, cutMargin: null }).map((d) => d.kind)).toContain("putt");
    expect(decisionsFor(course.holes[17]!, course, long, { round: 4, index: 17, behind: 9, cutMargin: null }).map((d) => d.kind)).not.toContain("putt");
  });

  it("show in the replay", () => {
    const course = getCourse("augusta-national");
    const p = flatPlayer("r", 12);
    const iron = traceHole({ course, hole: course.holes[0]!, score: 4, player: p, seed: 3, call: { tee: "iron" } });
    expect(iron.shots[0]!.club).toBe("Long iron");
    const par5 = course.holes.find((h) => h.par === 5)!;
    for (let seed = 0; seed < 20; seed++) {
      const lay = traceHole({ course, hole: par5, score: 4, player: p, seed, call: { second: "layup" } });
      const second = lay.shots[1]!;
      expect(second.lie === "green" || second.lie === "holed").toBe(false);
      expect(lay.shots.length).toBe(4);
    }
  });
});

describe("a live week", () => {
  it("records the live result exactly as played", () => {
    const w = deserializeWorld(serializeWorld(createWorld({ seed: 33, scenario: "rookie" })));
    // The first week he has an event to play.
    let events = liveEvents(w, {});
    for (let i = 0; i < 10 && events.length === 0; i++) {
      playWeek(w);
      events = liveEvents(w, {});
    }
    expect(events.length).toBeGreaterThan(0);
    const ev = events[0]!;
    const t = ev.tournament;
    startLiveRound(t);
    for (let i = 0; i < 18; i++) playLiveHole(t, { putt: "lag" });
    const result = finishLive(t);
    const report = playWeek(w, {}, { [ev.event.id]: result });
    const mine = result.leaderboard.find((r) => r.player.id === t.controlledId)!;
    const rec = report.clients[t.controlledId]!.record!;
    expect(rec.position).toBe(mine.position);
    expect(rec.earnings).toBe(mine.earnings);
    expect(w.players[t.controlledId]!.career.stats!.rounds).toBe(mine.rounds.length);
  });
});
