import { describe, expect, it } from "vitest";
import {
  HIDDEN_REVEAL_ACCURACY,
  SEASON_WEEKS,
  acceptChance,
  acceptSponsor,
  approachBlock,
  createWorld,
  declineSponsor,
  deserializeWorld,
  extendContract,
  finishSeason,
  hireScout,
  knowsHidden,
  marketability,
  maybeOffer,
  offerRepresentation,
  playWeek,
  queueScouting,
  rankMap,
  releaseClient,
  rosterLimit,
  scoutedAttribute,
  revealedRatings,
  serializeWorld,
  signClient,
  sponsorBonus,
  type World,
} from "../src/season";
import { createRng, VISIBLE_ATTRIBUTES } from "../src/engine";

const base = createWorld({ seed: 31, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));
const freeAgents = (w: World) => Object.values(w.players).filter((wp) => !wp.client && !wp.agent);

describe("starting agency", () => {
  it("has one client on standard terms, money in the bank and scouts to hire", () => {
    expect(base.clientIds).toEqual(["client"]);
    const m = base.players.client!.client!;
    expect(m.contract.commission).toBe(0.1);
    expect(m.contract.endorsementCommission).toBe(0.2);
    expect(base.agency.bank).toBeGreaterThan(0);
    expect(base.agency.scouts.length).toBeGreaterThanOrEqual(5);
    expect(rosterLimit(base.agency.reputation)).toBe(3);
  });

  it("leaves most tour players with rival agencies and some free", () => {
    const pros = Object.values(base.players).filter((wp) => !wp.client && wp.career.status === "exempt");
    const represented = pros.filter((wp) => wp.agent).length / pros.length;
    expect(represented).toBeGreaterThan(0.6);
    expect(freeAgents(base).length).toBeGreaterThan(10);
  });
});

describe("signing players", () => {
  it("won't let you poach a player mid-contract", () => {
    const w = fresh();
    const ranks = rankMap(w);
    const locked = Object.values(w.players).find((wp) => wp.agent && wp.agent.untilSeason > w.season && (ranks.get(wp.player.id) ?? 999) > 150)!;
    expect(approachBlock(w, locked.player.id)).toMatch(/under contract/);
    expect(offerRepresentation(w, locked.player.id, { commission: 0.1, years: 2 }).accepted).toBe(false);
  });

  it("finds unknowns easier to sign than stars, and lower commission helps", () => {
    const w = fresh();
    const ranks = rankMap(w);
    const free = freeAgents(w).sort((a, b) => (ranks.get(a.player.id) ?? 999) - (ranks.get(b.player.id) ?? 999));
    const best = free[0]!.player.id;
    const worst = free[free.length - 1]!.player.id;
    expect(acceptChance(w, worst, { commission: 0.1, years: 2 })).toBeGreaterThan(acceptChance(w, best, { commission: 0.1, years: 2 }));
    // A star won't look at a brand-new agency whatever the terms...
    const star = Object.values(w.players).find((wp) => (ranks.get(wp.player.id) ?? 999) <= 5)!.player.id;
    expect(acceptChance(w, star, { commission: 0.05, years: 2 })).toBeLessThan(0.1);
    // ...but for a player within reach, a lower commission makes the difference.
    const mid = free.find((wp) => {
      const c = acceptChance(w, wp.player.id, { commission: 0.1, years: 2 });
      return c > 0.1 && c < 0.9;
    })!.player.id;
    expect(acceptChance(w, mid, { commission: 0.06, years: 2 })).toBeGreaterThan(acceptChance(w, mid, { commission: 0.15, years: 2 }) + 0.2);
  });

  it("adds a signed player as a client, fully known", () => {
    const w = fresh();
    const id = freeAgents(w)[0]!.player.id;
    signClient(w, id, { commission: 0.12, years: 1 });
    expect(w.clientIds).toContain(id);
    expect(w.players[id]!.client!.contract).toMatchObject({ commission: 0.12, untilSeason: w.season });
    expect(w.agency.knowledge[id]!.accuracy).toBe(1);
  });

  it("caps the roster by reputation", () => {
    const w = fresh();
    const open = freeAgents(w).filter((wp) => approachBlock(w, wp.player.id) === null);
    for (const wp of open.slice(0, 2)) signClient(w, wp.player.id, { commission: 0.1, years: 1 });
    const next = open[2]!.player.id;
    expect(approachBlock(w, next)).toMatch(/clients at its reputation/);
  });

  it("makes a rejected player wait before hearing another offer", () => {
    const w = fresh();
    const offer = { commission: 0.2, years: 1 };
    const unlikely = freeAgents(w).find((wp) => !approachBlock(w, wp.player.id) && acceptChance(w, wp.player.id, offer) < 0.3)!.player.id;
    const r = offerRepresentation(w, unlikely, offer);
    if (!r.accepted) expect(approachBlock(w, unlikely)).toMatch(/turned you down/);
  });

  it("won't let a star even take the meeting with a tiny agency", () => {
    const w = fresh();
    w.agency.reputation = 5;
    const ranks = rankMap(w);
    const star = Object.values(w.players).find((wp) => (ranks.get(wp.player.id) ?? 999) <= 10)!.player.id;
    w.players[star]!.agent = null;
    expect(approachBlock(w, star)).toMatch(/bigger name/);
  });
});

describe("contracts and happiness", () => {
  it("loses a client whose contract runs out unextended", () => {
    const w = fresh();
    const id = freeAgents(w)[0]!.player.id;
    signClient(w, id, { commission: 0.1, years: 1 });
    while (w.week <= SEASON_WEEKS) playWeek(w);
    const summary = finishSeason(w)!;
    expect(w.clientIds).not.toContain(id);
    expect(summary.agency.departures).toContain(w.players[id]?.player.name ?? summary.agency.departures[0]);
    expect(w.clientIds).toContain("client"); // two-year deal still running
  });

  it("keeps a happy client who agrees to an extension", () => {
    const w = fresh();
    w.players.client!.client!.happiness = 100;
    const before = w.players.client!.client!.contract.untilSeason;
    const r = extendContract(w, "client", { commission: 0.1, years: 2 });
    expect(r.chance).toBeGreaterThan(0.9);
    // The new seasons go on the end of the deal he has.
    if (r.accepted) expect(w.players.client!.client!.contract.untilSeason).toBe(Math.max(w.season, before) + 2);
  });

  it("moves happiness each week and keeps it in range", () => {
    const w = fresh();
    for (let i = 0; i < 6; i++) playWeek(w);
    const h = w.players.client!.client!.happiness;
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(100);
  });

  it("can release a client", () => {
    const w = fresh();
    releaseClient(w, "client");
    expect(w.clientIds).toEqual([]);
    expect(w.players.client!.client).toBeUndefined();
  });
});

describe("sponsors", () => {
  it("values better players more", () => {
    const w = fresh();
    const ranks = rankMap(w);
    const byRank = Object.values(w.players).sort((a, b) => (ranks.get(a.player.id) ?? 999) - (ranks.get(b.player.id) ?? 999));
    expect(marketability(w, byRank[0]!)).toBeGreaterThan(marketability(w, byRank[200]!));
  });

  it("pays an accepted deal weekly, with the agency taking its cut, and pays win bonuses", () => {
    const w = fresh();
    const wp = w.players.client!;
    const offer = maybeOffer(w, wp, createRng(1), 1)!;
    expect(offer).not.toBeNull();
    acceptSponsor(w, "client", offer.id);
    expect(wp.client!.sponsors).toHaveLength(1);
    const bank = w.agency.bank;
    playWeek(w, { client: { kind: "rest" } });
    const m = wp.client!;
    expect(m.finances.endorsements).toBeGreaterThan(0);
    expect(w.agency.ledger.endorsementCommission).toBe(Math.round(m.finances.endorsements * 0.2));
    expect(w.agency.bank).toBeLessThan(bank + m.finances.endorsements); // only the cut, minus office
    expect(sponsorBonus(wp, 1, true)).toBe(offer.winBonus + offer.majorBonus);
    expect(sponsorBonus(wp, 2, true)).toBe(0);
  });

  it("allows one deal per category and lets offers be declined", () => {
    const w = fresh();
    const wp = w.players.client!;
    const rng = createRng(2);
    const offers = Array.from({ length: 10 }, () => maybeOffer(w, wp, rng, 1)).filter(Boolean);
    const cats = offers.map((o) => o!.category);
    expect(new Set(cats).size).toBe(cats.length);
    declineSponsor(w, "client", offers[0]!.id);
    expect(wp.client!.offers.some((o) => o.id === offers[0]!.id)).toBe(false);
  });
});

describe("scouting", () => {
  it("knows nothing about a player until he's scouted", () => {
    const other = Object.values(base.players).find((wp) => !wp.client)!.player.id;
    expect(scoutedAttribute(base, other, "midIrons")).toBeNull();
    expect(knowsHidden(base, other)).toBe(false);
  });

  it("files reports from the queue, and every range contains the truth", () => {
    const w = fresh();
    const best = w.agency.scouts.sort((a, b) => b.quality - a.quality)[0]!;
    hireScout(w, best.id);
    const targets = Object.values(w.players).filter((wp) => !wp.client).slice(0, 3).map((wp) => wp.player.id);
    for (const id of targets) queueScouting(w, id);
    // Intel takes one to three weeks by distance, so four weeks covers the farthest player.
    for (let i = 0; i < 4; i++) playWeek(w);
    for (const id of targets) {
      expect(w.agency.knowledge[id]!.accuracy).toBeGreaterThan(0.5);
      for (const k of revealedRatings(w, id)) {
        const v = scoutedAttribute(w, id, k)!;
        const truth = w.players[id]!.player.attributes[k];
        expect(v.low).toBeLessThanOrEqual(truth);
        expect(v.high).toBeGreaterThanOrEqual(truth);
      }
    }
    expect(w.agency.ledger.scouts).toBe(best.weeklyFee * 4);
  });

  it("reveals hidden traits only from a good enough report", () => {
    const w = fresh();
    const id = Object.values(w.players).find((wp) => !wp.client)!.player.id;
    w.agency.knowledge[id] = { accuracy: HIDDEN_REVEAL_ACCURACY - 0.05, reports: 1, absWeek: 0 };
    expect(knowsHidden(w, id)).toBe(false);
    w.agency.knowledge[id] = { accuracy: HIDDEN_REVEAL_ACCURACY, reports: 2, absWeek: 0 };
    expect(knowsHidden(w, id)).toBe(true);
  });

  it("shows clients' attributes exactly", () => {
    const v = scoutedAttribute(base, "client", "wedges")!;
    expect(v.low).toBe(v.high);
    expect(v.value).toBe(base.players.client!.player.attributes.wedges);
  });
});

describe("reputation", () => {
  it("rises when a client wins", () => {
    const w = fresh();
    const before = w.agency.reputation;
    // Make the client untouchable for a week.
    for (const k of VISIBLE_ATTRIBUTES) w.players.client!.player.attributes[k] = 20;
    const opt = eventIdsThisWeek(w)[0]!;
    playWeek(w, { client: { kind: "enter", eventId: opt } });
    const rec = w.players.client!.career.results.at(-1);
    if (rec?.position === 1) expect(w.agency.reputation).toBeGreaterThan(before);
  });
});

function eventIdsThisWeek(w: World): string[] {
  return w.schedule.filter((e) => e.week === w.week).map((e) => e.id);
}
