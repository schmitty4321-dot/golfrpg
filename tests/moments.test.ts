import { describe, expect, it } from "vitest";
import {
  MAX_STOPS,
  answerMoment,
  atStake,
  autoFinishRound,
  createRng,
  finishLive,
  generateTourField,
  getCourse,
  liveSnapshot,
  nextMoment,
  planCall,
  playLiveHole,
  startLive,
  startLiveRound,
  type Decision,
  type TournamentConfig,
} from "../src/engine";
import { createWorld, liveEvents, playWeek } from "../src/season";

const field = generateTourField(createRng(7), 120);
const config = (seed = 11): TournamentConfig => ({ name: "Moments Open", course: getCourse("tpc-sawgrass"), field, purse: 9_000_000, seed, cutTop: 65 });
const a = field[10]!.id;
const b = field[60]!.id;
const c = field[100]!.id;

const rows = (t: ReturnType<typeof startLive>, skip: string[]) =>
  liveSnapshot(t).leaderboard.filter((r) => !skip.includes(r.player.id)).map((r) => `${r.player.id}:${r.rounds.join()}`).sort();

describe("several clients played live", () => {
  it("each plays his own round; one client's calls change no one else's score", () => {
    const x = startLive(config(), [a, b]);
    const y = startLive(config(), [a, b]);
    for (const t of [x, y]) {
      startLiveRound(t);
      expect(Object.keys(t.live).sort()).toEqual([a, b].sort());
      for (let i = 0; i < 18; i++) playLiveHole(t, t === x ? { approach: "attack", tee: "driver" } : { approach: "middle", tee: "iron" }, a);
      autoFinishRound(t, b);
      expect(t.live).toEqual({});
    }
    // Everyone but the client whose calls differed, including your other client, shot the same.
    expect(rows(x, [a])).toEqual(rows(y, [a]));
  });

  it("the first client plays exactly as he would alone", () => {
    const solo = finishLive(startLive(config(3), a));
    const team = finishLive(startLive(config(3), [a, b]));
    expect(team.leaderboard.find((r) => r.player.id === a)!.rounds).toEqual(solo.leaderboard.find((r) => r.player.id === a)!.rounds);
  });

  it("records calls for every client and closes with a full result", () => {
    const t = startLive(config(), [a, b, c], { [b]: "attack", [c]: "protect" });
    const result = finishLive(t);
    for (const id of [a, b, c]) expect(result.leaderboard.find((r) => r.player.id === id)!.calls).toBeDefined();
    const bCalls = result.leaderboard.find((r) => r.player.id === b)!.calls!.flat().filter(Boolean);
    expect(bCalls.length).toBeGreaterThan(0);
    expect(bCalls.every((call) => Object.values(call!).every((v) => ["driver", "go", "attack", "charge"].includes(v)))).toBe(true);
  });
});

describe("round plans", () => {
  const decisions: Decision[] = [
    { kind: "tee", question: "", options: [] },
    { kind: "approach", question: "", options: [] },
  ];
  it("steady leaves the call to him; attack and protect take every risk or none", () => {
    expect(planCall("steady", decisions)).toBeNull();
    expect(planCall("attack", decisions)).toEqual({ tee: "driver", approach: "attack" });
    expect(planCall("protect", decisions)).toEqual({ tee: "3-wood", approach: "middle" });
    expect(planCall("attack", [])).toBeNull();
  });

  it("steady plays exactly like his own calls", () => {
    const x = startLive(config(), [a, b]);
    const y = startLive(config(), [a, b]);
    const rx = finishLive(x);
    startLiveRound(y);
    while (y.live[a]) playLiveHole(y, null, a);
    while (y.live[b]) playLiveHole(y, null, b);
    const ry = finishLive(y);
    expect(rx.leaderboard.map((r) => r.total)).toEqual(ry.leaderboard.map((r) => r.total));
  });

  it("a plan other than steady is played on simulated weeks too", () => {
    const w = createWorld({ seed: 31, scenario: "agency" });
    for (const id of w.clientIds) w.players[id]!.client!.roundPlan = "protect";
    let found = false;
    for (let i = 0; i < 6 && !found; i++) {
      const report = playWeek(w);
      for (const id of w.clientIds) {
        const row = report.clients[id]?.result?.leaderboard.find((r) => r.player.id === id);
        if (row?.calls) found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe("key moments", () => {
  it("stop only when something is at stake", () => {
    expect(atStake({ round: 1, index: 16, behind: 0, cutMargin: null })).toBe(false);
    expect(atStake({ round: 2, index: 12, behind: 9, cutMargin: -1 })).toBe(true);
    expect(atStake({ round: 2, index: 12, behind: 9, cutMargin: 3 })).toBe(false);
    expect(atStake({ round: 2, index: 5, behind: 9, cutMargin: 0 })).toBe(false);
    expect(atStake({ round: 4, index: 8, behind: 0, cutMargin: null })).toBe(false);
    expect(atStake({ round: 4, index: 12, behind: 3, cutMargin: null })).toBe(true);
    expect(atStake({ round: 3, index: 12, behind: 4, cutMargin: null })).toBe(false);
  });

  it("take at most a few stops per client per round, and play the week out", () => {
    let stops = 0;
    for (const seed of [21, 22, 23, 24]) {
      const t = startLive(config(seed), [a, b, c]);
      const seen: Record<string, number> = {};
      while (t.round < 4 || Object.keys(t.live).length) {
        if (!Object.keys(t.live).length) startLiveRound(t);
        for (;;) {
          const { moment } = nextMoment(t);
          if (!moment || moment.playoff) break;
          expect(atStake(moment.situation)).toBe(true);
          expect(moment.decisions.length).toBeGreaterThan(0);
          const key = `${moment.id}:${moment.round}`;
          seen[key] = (seen[key] ?? 0) + 1;
          stops++;
          answerMoment(t, moment, { [moment.decisions[0]!.kind]: moment.decisions[0]!.options[1]!.value });
        }
      }
      for (const n of Object.values(seen)) expect(n).toBeLessThanOrEqual(MAX_STOPS);
      expect(finishLive(t).leaderboard).toHaveLength(field.length);
    }
    expect(stops).toBeGreaterThan(0);
  });

  it("asking again without answering gives the same moment", () => {
    for (const seed of [41, 42, 43, 44, 45]) {
      const t = startLive(config(seed), [a, b, c]);
      for (let r = 0; r < 4; r++) {
        startLiveRound(t);
        const first = nextMoment(t).moment;
        if (first && !first.playoff) {
          expect(nextMoment(t)).toEqual({ ticker: [], moment: first });
          return;
        }
        autoFinishRound(t);
      }
    }
    throw new Error("no seed produced a key moment");
  });

  it("accepting every plan call plays exactly like simulating the week (Quick)", () => {
    for (const seed of [51, 52, 53]) {
      const plans = { [a]: "attack", [b]: "steady", [c]: "protect" } as const;
      const quick = finishLive(startLive(config(seed), [a, b, c], plans));
      const t = startLive(config(seed), [a, b, c], plans);
      while (t.round < 4 || Object.keys(t.live).length) {
        if (!Object.keys(t.live).length) startLiveRound(t);
        for (let m = nextMoment(t).moment; m; m = nextMoment(t).moment) answerMoment(t, m, planCall(t.plans[m.id]!, m.decisions));
      }
      const moments = finishLive(t);
      expect(moments.leaderboard.map((r) => `${r.player.id}:${r.rounds.join()}`)).toEqual(quick.leaderboard.map((r) => `${r.player.id}:${r.rounds.join()}`));
    }
  });
});

describe("live weeks", () => {
  it("walk every client in an event, not just the first", () => {
    for (const seed of [61, 62, 63, 64, 65, 66]) {
      const w = createWorld({ seed, scenario: "agency" });
      const shared = liveEvents(w).find((e) => e.clientIds.length > 1);
      if (!shared) continue;
      expect(shared.tournament.controlledIds).toEqual(shared.clientIds);
      return;
    }
    throw new Error("no seed put two clients in one event");
  });
});
