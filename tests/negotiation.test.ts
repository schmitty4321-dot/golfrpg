import { describe, expect, it } from "vitest";
import { absWeek, acceptCounter, acceptChance, answerDelay, clearTalks, createWorld, makeOffer, offerBlock, startNegotiation, talksWeek, termsChance, windowWeek, type Negotiation, type World } from "../src/season";

/** A world with room on the roster and a player you could sign. */
function setup(seed: number): { w: World; id: string } {
  const w = createWorld({ seed, scenario: "agency" });
  w.agency.reputation = 60; // room for more clients
  const target = Object.values(w.players).find((wp) => {
    if (wp.client || wp.career.status === "amateur" || (wp.agent && wp.agent.untilSeason > w.season)) return false;
    const c = acceptChance(w, wp.player.id, { commission: 0.1, years: 2 });
    return c > 0.15 && c < 0.85;
  })!;
  return { w, id: target.player.id };
}

/** Moves the clock on to the week he answers, and lets him answer. */
function waitForAnswer(w: World, id: string): void {
  const n = w.talks![id]!;
  if (n.pending) w.week = n.pending.answerAbsWeek - w.season * 52;
  talksWeek(w);
}

describe("the negotiation table", () => {
  it("accepts an offer exactly when its odds clear his hidden bar, after thinking it over", () => {
    const { w, id } = setup(61);
    expect(startNegotiation(w, id, "sign")).toBeNull();
    const n = w.talks![id]!;
    const terms = { commission: 0.1, years: 2, promises: [] };
    const clears = termsChance(w, n, terms) >= n.bar;
    makeOffer(w, terms, id);
    waitForAnswer(w, id);
    expect(n.status === "agreed").toBe(clears);
    if (clears) expect(w.players[id]!.client).toBeDefined();
  });

  it("takes two to four weeks over a first offer, usually; now and then at once or longer", () => {
    const delays: number[] = [];
    const w = createWorld({ seed: 61, scenario: "agency" });
    for (let seed = 1; seed <= 400; seed++) {
      w.week = 1 + (seed % 30);
      w.seed = seed;
      delays.push(answerDelay(w, { playerId: `p${seed}`, kind: "sign", round: 1 } as Negotiation));
    }
    const share = (f: (d: number) => boolean) => delays.filter(f).length / delays.length;
    expect(share((d) => d >= 2 && d <= 4)).toBeGreaterThan(0.6);
    expect(share((d) => d === 0)).toBeGreaterThan(0.02); // some say yes or no on the spot
    expect(share((d) => d > 4)).toBeGreaterThan(0.02); // some keep you waiting
    expect(Math.max(...delays)).toBeLessThanOrEqual(8);
  });

  it("one offer a week: the next has to wait", () => {
    const { w, id } = setup(62);
    startNegotiation(w, id, "sign");
    const n = w.talks![id]!;
    n.bar = 0.99;
    makeOffer(w, { commission: 0.2, years: 2, promises: [] }, id);
    if (n.pending) expect(offerBlock(w, n)).toMatch(/thinking/);
    waitForAnswer(w, id);
    if (n.status === "open") {
      expect(offerBlock(w, n)).toBeNull(); // a later week
      w.agency.offerWeek = absWeek(w.season, w.week);
      expect(offerBlock(w, n)).toMatch(/this week's offer/);
    }
  });

  it("counters with terms that would get it done, and accepting them closes the deal", () => {
    for (const seed of [62, 63, 64, 65, 66]) {
      const { w, id } = setup(seed);
      startNegotiation(w, id, "sign");
      const n = w.talks![id]!;
      n.bar = Math.min(0.95, termsChance(w, n, { commission: 0.2, years: 2, promises: [] }) + 0.05); // a 20% offer falls short
      makeOffer(w, { commission: 0.2, years: 2, promises: [] }, id);
      waitForAnswer(w, id);
      if (n.status !== "open" || !n.counter) continue;
      if (termsChance(w, n, n.counter) >= n.bar) {
        acceptCounter(w, id);
        expect(n.status).toBe("agreed");
        expect(w.players[id]!.client!.contract.commission).toBeCloseTo(n.lines.at(-1)!.terms!.commission);
        return;
      }
    }
    throw new Error("no seed produced an acceptable counter");
  });

  it("walks after lowballs, and won't talk again for a while", () => {
    const { w, id } = setup(67);
    startNegotiation(w, id, "sign");
    const n = w.talks![id]!;
    n.bar = 0.99;
    for (let i = 0; i < 4 && n.status === "open"; i++) {
      w.agency.offerWeek = undefined;
      makeOffer(w, { commission: 0.2, years: 1, promises: [] }, id);
      waitForAnswer(w, id);
    }
    expect(n.status).toBe("walked");
    expect(w.agency.cooldowns[id]!).toBeGreaterThan(absWeek(w.season, w.week));
    clearTalks(w, id);
    expect(startNegotiation(w, id, "sign")).toMatch(/turned you down|recently|a few weeks/i);
  });

  it("extends a client on the agreed terms", () => {
    const w = createWorld({ seed: 68, scenario: "agency" });
    const id = w.clientIds[0]!;
    // His final season, past the halfway point: the window is open.
    w.players[id]!.client!.contract.untilSeason = w.season;
    w.week = windowWeek(w);
    expect(startNegotiation(w, id, "extend")).toBeNull();
    const n = w.talks![id]!;
    n.bar = 0; // he'll take anything
    makeOffer(w, { commission: 0.12, years: 3, promises: ["camp"] }, id);
    // He answers on the spot or within two weeks.
    w.week += 2;
    talksWeek(w);
    expect(n.status).toBe("agreed");
    expect(w.players[id]!.client!.contract.untilSeason).toBe(w.season + 3);
    expect(w.players[id]!.client!.contract.commission).toBeCloseTo(0.12);
    expect(w.players[id]!.client!.promises!.some((p) => p.kind === "camp")).toBe(true);
  });
});
