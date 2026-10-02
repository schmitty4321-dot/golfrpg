import { describe, expect, it } from "vitest";
import { absWeek, acceptCounter, acceptChance, createWorld, makeOffer, startNegotiation, termsChance, type World } from "../src/season";

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

describe("the negotiation table", () => {
  it("accepts an offer exactly when its odds clear his hidden bar", () => {
    const { w, id } = setup(61);
    expect(startNegotiation(w, id, "sign")).toBeNull();
    const n = w.negotiation!;
    const terms = { commission: 0.1, years: 2, promises: [] };
    const clears = termsChance(w, n, terms) >= n.bar;
    makeOffer(w, terms);
    expect(w.negotiation!.status === "agreed").toBe(clears);
    if (clears) expect(w.players[id]!.client).toBeDefined();
  });

  it("counters with terms that would get it done, and accepting them closes the deal", () => {
    for (const seed of [62, 63, 64, 65, 66]) {
      const { w, id } = setup(seed);
      startNegotiation(w, id, "sign");
      const n = w.negotiation!;
      n.bar = Math.min(0.95, termsChance(w, n, { commission: 0.2, years: 2, promises: [] }) + 0.05); // a 20% offer falls short
      makeOffer(w, { commission: 0.2, years: 2, promises: [] });
      if (n.status !== "open" || !n.counter) continue;
      if (termsChance(w, n, n.counter) >= n.bar) {
        acceptCounter(w);
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
    const n = w.negotiation!;
    n.bar = 0.99;
    makeOffer(w, { commission: 0.2, years: 1, promises: [] });
    makeOffer(w, { commission: 0.2, years: 1, promises: [] });
    if (n.status === "open") makeOffer(w, { commission: 0.2, years: 1, promises: [] });
    expect(n.status).toBe("walked");
    expect(w.agency.cooldowns[id]!).toBeGreaterThan(absWeek(w.season, w.week));
    expect(startNegotiation(w, id, "sign")).toMatch(/turned you down|recently|a few weeks/i);
  });

  it("extends a client on the agreed terms", () => {
    const w = createWorld({ seed: 68, scenario: "agency" });
    const id = w.clientIds[0]!;
    expect(startNegotiation(w, id, "extend")).toBeNull();
    w.negotiation!.bar = 0; // he'll take anything
    makeOffer(w, { commission: 0.12, years: 3, promises: ["camp"] });
    expect(w.negotiation!.status).toBe("agreed");
    expect(w.players[id]!.client!.contract.untilSeason).toBe(w.season + 3);
    expect(w.players[id]!.client!.contract.commission).toBeCloseTo(0.12);
    expect(w.players[id]!.client!.promises!.some((p) => p.kind === "camp")).toBe(true);
  });
});
