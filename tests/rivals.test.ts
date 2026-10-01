import { describe, expect, it } from "vitest";
import {
  RIVAL_PROFILES,
  RIVAL_STYLES,
  acceptChance,
  competingBid,
  createWorld,
  deserializeWorld,
  finishSeason,
  impliedStaff,
  playWeek,
  rankMap,
  rivalBids,
  rivalCoaching,
  rivalSummaries,
  seasonWeeks,
  serializeWorld,
  type World,
} from "../src/season";

const playSeason = (w: World) => {
  while (w.week <= seasonWeeks(w)) playWeek(w);
  finishSeason(w);
};

describe("rival agencies", () => {
  const world = createWorld({ seed: 11, scenario: "agency" });

  it("sign the tour within their list sizes, nearly all of the top 50 included", () => {
    const rows = rivalSummaries(world);
    expect(rows.map((r) => r.rival.name)).toEqual(RIVAL_PROFILES.map((r) => r.name));
    for (const r of rows) expect(r.players).toBeLessThanOrEqual(r.style.capacity);
    const ranks = rankMap(world);
    const top = Object.values(world.players).filter((wp) => !wp.client && (ranks.get(wp.player.id) ?? 999) <= 50);
    expect(top.filter((wp) => wp.agent).length / top.length).toBeGreaterThan(0.85);
    for (const wp of Object.values(world.players)) if (wp.career.status === "amateur") expect(wp.agent).toBeNull();
  });

  it("coach their players by style, and fund deals only for young players with room to grow", () => {
    const pick = (style: keyof typeof RIVAL_STYLES) =>
      Object.values(world.players).find((wp) => !wp.client && wp.agent && !wp.agent.deal && wp.player.age > 25 && world.rivals!.find((r) => r.name === wp.agent!.agency)!.style === style)!;
    const boutique = pick("boutique");
    const volume = pick("volume");
    expect(rivalCoaching(world, boutique).swing! - impliedStaff(boutique).swing!).toBeGreaterThan(rivalCoaching(world, volume).swing! - impliedStaff(volume).swing!);
    const deals = Object.values(world.players).filter((wp) => wp.agent?.deal);
    expect(deals.length).toBeGreaterThan(0);
    for (const wp of deals) {
      expect(wp.player.age).toBeLessThanOrEqual(24);
      expect(wp.agent!.winter).toBe("camp");
    }
  });

  it("bid the same way every time they are asked, and a bid makes your offer harder", () => {
    // A player in the last season of his deal: on the market, and his agency wants to keep him.
    const free = Object.values(world.players).find((wp) => !wp.client && wp.agent?.untilSeason === world.season && competingBid(world, wp.player.id) && acceptChance(world, wp.player.id, { commission: 0.1, years: 2 }) > 0.1)!;
    expect(free).toBeDefined();
    expect(rivalBids(world, free.player.id)).toEqual(rivalBids(world, free.player.id));
    const withBid = acceptChance(world, free.player.id, { commission: 0.1, years: 2 });
    const saved = world.rivals;
    world.rivals = world.rivals!.map((r) => ({ ...r, reputation: -100 })); // nobody can chase him now
    expect(competingBid(world, free.player.id)).toBeNull();
    expect(acceptChance(world, free.player.id, { commission: 0.1, years: 2 })).toBeGreaterThan(withBid);
    world.rivals = saved;
  });

  it("run the winter market: lists stay within limits, reputations move, moves are logged", () => {
    const w = createWorld({ seed: 12, scenario: "agency" });
    const repBefore = w.rivals!.map((r) => r.reputation);
    playSeason(w);
    for (const r of rivalSummaries(w)) expect(r.players).toBeLessThanOrEqual(r.style.capacity);
    expect(w.rivals!.map((r) => r.reputation)).not.toEqual(repBefore);
    expect(w.rivals!.some((r) => r.moves.some((m) => m.startsWith("Signs ")))).toBe(true);
    for (const r of w.rivals!) for (const m of r.moves) expect(m).not.toMatch(/\.\.$/);
    // Every contract runs into next season at least.
    for (const wp of Object.values(w.players)) if (wp.agent) expect(wp.agent.untilSeason).toBeGreaterThanOrEqual(w.season - 1);
  });

  it("come back with an old save that has none", () => {
    const raw = JSON.parse(serializeWorld(world));
    delete raw.rivals;
    const loaded = deserializeWorld(JSON.stringify(raw));
    expect(loaded.rivals!.map((r) => r.name)).toEqual(RIVAL_PROFILES.map((r) => r.name));
  });
});
