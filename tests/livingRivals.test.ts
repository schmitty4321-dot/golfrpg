import { describe, expect, it } from "vitest";
import { createWorld, ensureRivals, rivalCapacity, rosterLimit, signClient, RIVAL_PROFILES, RIVAL_STYLES } from "../src/season";

describe("rival agencies grow and shrink", () => {
  it("a rival's list grows with its reputation and shrinks with it", () => {
    const w = createWorld({ seed: 7, scenario: "agency" });
    const r = ensureRivals(w)[0]!;
    const start = RIVAL_PROFILES.find((p) => p.name === r.name)!.reputation;
    const base = RIVAL_STYLES[r.style].capacity;
    r.reputation = start;
    expect(rivalCapacity(r)).toBe(base);
    r.reputation = start + 40;
    expect(rivalCapacity(r)).toBe(Math.round(base * 1.25));
    r.reputation = start - 40;
    expect(rivalCapacity(r)).toBe(Math.round(base * 0.75));
  });

  it("signing a rival's player costs it places, and the loss fades", () => {
    const w = createWorld({ seed: 7, scenario: "agency" });
    const wp = Object.values(w.players).find((p) => p.agent && !p.client)!;
    const r = ensureRivals(w).find((x) => x.name === wp.agent!.agency)!;
    const before = rivalCapacity(r);
    signClient(w, wp.player.id, { commission: 0.1, years: 2 });
    expect(r.lostToYou).toBe(1);
    expect(rivalCapacity(r)).toBe(before - 2);
    expect(r.moves[0]).toMatch(/Loses/);
  });

  it("your list goes past 8 at the very top", () => {
    expect(rosterLimit(84)).toBe(7);
    expect(rosterLimit(85)).toBe(8);
    expect(rosterLimit(90)).toBe(9);
    expect(rosterLimit(95)).toBe(10);
    expect(rosterLimit(95, 3)).toBe(13);
  });
});
