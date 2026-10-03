import { describe, expect, it } from "vitest";
import { autoFinishRound, createRng, finishLive, generateTourField, getCourse, liveSnapshot, startLive, startLiveRound, type TournamentConfig } from "../src/engine";
import { answerRoundCall, createWorld, liveEvents, roundCallsFor, settleRoundCalls, type LiveEvent, type RoundCall, type World } from "../src/season";

const field = generateTourField(createRng(9), 120);
const config = (seed: number): TournamentConfig => ({ name: "Calls Open", course: getCourse("tpc-sawgrass"), field, purse: 9_000_000, seed, cutTop: 65 });
const me = field[30]!.id;
const other = field[80]!.id;

/** A world and an event with a call on offer after some round. */
function withCall(): { w: World; ev: LiveEvent; call: RoundCall } {
  for (let seed = 1; seed < 40; seed++) {
    const w = createWorld({ seed, scenario: "agency" });
    for (const ev of liveEvents(w)) {
      const t = ev.tournament;
      for (let r = 0; r < 3; r++) {
        startLiveRound(t);
        autoFinishRound(t);
        const call = roundCallsFor(w, ev)[0];
        if (call) return { w, ev, call };
      }
    }
  }
  throw new Error("no seed produced a call");
}

describe("calls between rounds", () => {
  it("a lift on his form shows in his next round and changes no one else's score", () => {
    let mine = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const plain = startLive(config(seed), [me, other]);
      const lifted = startLive(config(seed), [me, other]);
      lifted.boosts[`${me}:2`] = 1.5;
      finishLive(plain);
      finishLive(lifted);
      const r2 = (t: typeof plain) => liveSnapshot(t).leaderboard.find((r) => r.player.id === me)!.rounds[1]!;
      mine += r2(plain) - r2(lifted);
      const rest = (t: typeof plain) => liveSnapshot(t).leaderboard.filter((r) => r.player.id !== me).map((r) => `${r.player.id}:${r.rounds.slice(0, 2).join()}`).sort();
      expect(rest(lifted)).toEqual(rest(plain));
    }
    expect(mine / 8).toBeGreaterThan(0.5);
  });

  it("offer at most one call per client, never after the final round, each with a default that does nothing", () => {
    for (const seed of [3, 4, 5]) {
      const w = createWorld({ seed, scenario: "agency" });
      for (const ev of liveEvents(w)) {
        const t = ev.tournament;
        for (let r = 0; r < 4; r++) {
          startLiveRound(t);
          autoFinishRound(t);
          const calls = roundCallsFor(w, ev);
          if (t.round === 4) expect(calls).toEqual([]);
          expect(new Set(calls.map((c) => c.clientId)).size).toBe(calls.length);
          for (const c of calls) {
            const d = c.choices.find((x) => x.id === c.defaultChoice)!;
            expect(d.edge ?? 0).toBe(0);
            expect(d.plan).toBeUndefined();
            expect(d.effects ?? []).toEqual([]);
            expect(d.gamble).toBeUndefined();
          }
        }
      }
    }
  });

  it("the default leaves the week exactly as it was", () => {
    const { w, ev, call } = withCall();
    const plan = ev.tournament.plans[call.clientId];
    const a = answerRoundCall(w, ev, call, call.defaultChoice);
    expect(a.edge).toBe(0);
    expect(ev.tournament.boosts).toEqual({});
    expect(ev.tournament.plans[call.clientId]).toBe(plan);
    const news = w.news.length;
    settleRoundCalls(w, [ev]);
    expect(w.news.length).toBe(news);
  });

  it("a real call sets tomorrow's form now and lands the rest when the week closes", () => {
    const { w, ev, call } = withCall();
    const choice = call.choices.find((c) => c.id !== call.defaultChoice && (c.edge || c.gamble))!;
    const a = answerRoundCall(w, ev, call, choice.id);
    // Answering again changes nothing.
    expect(answerRoundCall(w, ev, call, call.defaultChoice)).toBe(a);
    if (a.edge) expect(ev.tournament.boosts[`${call.clientId}:${call.round + 1}`]).toBe(a.edge);
    const news = w.news.length;
    settleRoundCalls(w, [ev]);
    expect(w.news.length).toBe(news + 1);
    expect(w.news[0]).toContain(choice.label);
  });

  it("a gamble comes out the same way every time", () => {
    const one = withCall();
    const two = withCall();
    const gamble = one.call.choices.find((c) => c.gamble);
    if (!gamble) return;
    expect(answerRoundCall(one.w, one.ev, one.call, gamble.id)).toEqual(answerRoundCall(two.w, two.ev, two.call, gamble.id));
  });
});
