import { describe, expect, it } from "vitest";
import {
  LOYALTY_DISCOUNT,
  REFERRAL_BONUS,
  alumni,
  alumnusRetires,
  coachFee,
  createWorld,
  deserializeWorld,
  eras,
  legacyScore,
  referralBonus,
  releaseClient,
  serializeWorld,
} from "../src/season";

describe("the agency's legacy", () => {
  it("remembers a departing client, inducts the greats, and brings him back as a coach when he retires", () => {
    const w = createWorld({ seed: 101, scenario: "agency" });
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    const name = wp.player.name;
    (w.agency.trophies ??= []).push({ season: w.season, kind: "major", title: "Masters Tournament", player: name }, { season: w.season, kind: "win", title: "Sony Open in Hawaii", player: name });
    releaseClient(w, id);
    const a = alumni(w).find((x) => x.id === id)!;
    expect(a.wins).toBe(2);
    expect(a.majors).toBe(1);
    expect(a.hallOfFame).toBe(true);
    expect(a.status).toBe("elsewhere");

    alumnusRetires(w, wp);
    const coach = w.coaches.find((c) => c.id === `alum-${id}`)!;
    expect(coach.formerClient).toBe(true);
    expect(coach.weeklyFee).toBe(Math.round(coachFee(coach.quality) * LOYALTY_DISCOUNT));
    expect(a.status).toBe("coaching");
    // The friend's rate survives a save and load.
    const loaded = deserializeWorld(serializeWorld(w));
    expect(loaded.coaches.find((c) => c.id === coach.id)!.weeklyFee).toBe(coach.weeklyFee);

    expect(legacyScore(w)).toBeGreaterThanOrEqual(2 + 10 + 15);
    expect(eras(w)[0]!.name).toBe(name);
  });

  it("gives a referred prospect a head start this season and next", () => {
    const w = createWorld({ seed: 102, scenario: "agency" });
    w.agency.referrals = { x1: w.season + 1 };
    expect(referralBonus(w, "x1")).toBe(REFERRAL_BONUS);
    w.season += 2;
    expect(referralBonus(w, "x1")).toBe(0);
  });
});
