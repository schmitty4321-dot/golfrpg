import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  brandLift,
  brandOffers,
  createWorld,
  eventBlock,
  followerLift,
  followers,
  holdEvent,
  playWeek,
  recordClientWin,
  signBrand,
  trophiesSeasonEnd,
  updateFollowers,
} from "../src/season";

describe("brand partnerships", () => {
  it("come with reputation, pay weekly and lift their category", () => {
    const world = createWorld({ seed: 3, scenario: "rookie" });
    world.agency.reputation = 10;
    expect(brandOffers(world)).toEqual([]);
    delete world.agency.brandOffers;
    world.agency.reputation = 45;
    const offers = brandOffers(world);
    expect(offers.length).toBe(3);
    const deal = offers[0]!;
    signBrand(world, deal.id);
    expect(brandLift(world, deal.category)).toBeCloseTo(1 + deal.lift, 5);
    expect(brandOffers(world).some((o) => o.category === deal.category)).toBe(false);
    playWeek(world);
    expect(world.agency.ledger.brands).toBe(Math.round(deal.annual / 41));
  });
});

describe("events and following", () => {
  it("holds each event once a season and grows clients' following", () => {
    const world = createWorld({ seed: 3, scenario: "rookie" });
    const wp = world.players[world.clientIds[0]!]!;
    expect(eventBlock(world, "exhibition")).toMatch(/top 50/);
    const before = followers(world, wp);
    const net = holdEvent(world, "clinic", createRng(1));
    expect(world.agency.ledger.events).toBe(net);
    expect(eventBlock(world, "clinic")).toMatch(/Already/);
    expect(followers(world, wp)).toBeGreaterThan(before);
    const f = followers(world, wp);
    updateFollowers(world, wp, { position: 1, madeCut: true }, 0);
    expect(followers(world, wp)).toBeGreaterThan(f * 1.1);
    expect(followerLift(world, wp)).toBeGreaterThanOrEqual(0.9);
  });
});

describe("trophy cabinet", () => {
  it("records client wins and the reputation history", () => {
    const world = createWorld({ seed: 3, scenario: "rookie" });
    const wp = world.players[world.clientIds[0]!]!;
    recordClientWin(world, wp, "The Masters", true);
    expect(world.agency.trophies).toEqual([{ season: world.season, kind: "major", title: "The Masters", player: wp.player.name }]);
    trophiesSeasonEnd(world);
    expect(world.agency.repHistory!.at(-1)!.season).toBe(world.season);
  });
});
