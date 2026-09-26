import { describe, expect, it } from "vitest";
import { coursePar, createRng, generateCourse, simulateTournament, generateTourField } from "../src/engine";
import {
  CONDITIONAL_CARD,
  OFFICE_COST,
  STARTING_BANK,
  FULL_CARD,
  MONDAY_SPOTS,
  SEASON_WEEKS,
  WINNER_POINTS,
  buildTour,
  clientOptions,
  createWorld,
  deserializeWorld,
  eventsInWeek,
  finishSeason,
  ordinal,
  owgrPointsFor,
  owgrWinnerPoints,
  playWeek,
  pointsList,
  seasonPointsFor,
  serializeWorld,
  theEvent,
  worldRanking,
  absWeek,
  type World,
} from "../src/season";

describe("tour calendar", () => {
  const { courses, schedule } = buildTour(1);

  it("has four majors, a finale, and at most two main-tour events a week", () => {
    expect(schedule.filter((e) => e.tier === "major")).toHaveLength(4);
    expect(schedule.filter((e) => e.tier === "finale").map((e) => e.week)).toEqual([SEASON_WEEKS]);
    for (let w = 1; w <= SEASON_WEEKS; w++) {
      expect(schedule.filter((e) => e.week === w && e.tier === "dev").length).toBeLessThanOrEqual(1);
      const n = schedule.filter((e) => e.week === w && e.tier !== "dev").length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("pairs every opposite-field event with a major or signature event", () => {
    for (const e of schedule.filter((x) => x.tier === "opposite")) {
      const main = schedule.find((x) => x.week === e.week && x !== e)!;
      expect(["major", "signature"]).toContain(main.tier);
    }
  });

  it("gives every event a unique name and a real venue", () => {
    expect(new Set(schedule.map((e) => e.name)).size).toBe(schedule.length);
    for (const e of schedule) expect(courses.some((c) => c.id === e.courseId)).toBe(true);
  });

  it("is the same for the same seed", () => {
    expect(buildTour(1).schedule).toEqual(schedule);
  });
});

describe("course generator", () => {
  it("builds valid 18-hole courses", () => {
    const rng = createRng(3);
    for (const style of ["links", "parkland", "desert", "resort"] as const) {
      for (let i = 0; i < 20; i++) {
        const c = generateCourse(rng, "x", "X", style);
        expect(c.holes).toHaveLength(18);
        expect([70, 71, 72]).toContain(coursePar(c));
        expect(c.holes[0]!.par).not.toBe(3);
      }
    }
  });

  it("produces courses that play like tour venues", () => {
    const rng = createRng(4);
    const field = generateTourField(rng, 120);
    for (const style of ["links", "parkland", "desert", "resort"] as const) {
      const course = generateCourse(rng, style, style, style);
      let total = 0;
      let rounds = 0;
      for (let seed = 0; seed < 4; seed++) {
        for (const r of simulateTournament({ name: "t", course, field, purse: 1, seed, cutTop: 65 }).leaderboard) {
          for (const x of r.rounds) {
            total += x - coursePar(course);
            rounds++;
          }
        }
      }
      expect(total / rounds).toBeGreaterThan(-2.5);
      expect(total / rounds).toBeLessThan(3);
    }
  });
});

describe("points", () => {
  it("gives the winner the tier's points and splits ties", () => {
    expect(seasonPointsFor("standard", 1, 1)).toBe(WINNER_POINTS.standard);
    expect(seasonPointsFor("standard", 2, 2)).toBe(Math.round(500 * ((0.6 + 0.38) / 2) * 10) / 10);
    expect(seasonPointsFor("finale", 1, 1)).toBe(0);
  });

  it("rates majors at 100 world ranking points and weak fields low", () => {
    expect(owgrWinnerPoints("major", [500, 600])).toBe(100);
    const strong = owgrWinnerPoints("signature", Array.from({ length: 72 }, (_, i) => i + 1));
    const weak = owgrWinnerPoints("opposite", Array.from({ length: 120 }, (_, i) => i + 150));
    expect(strong).toBeGreaterThan(60);
    expect(weak).toBeLessThan(20);
    expect(owgrPointsFor(50, 1, 1)).toBe(50);
    expect(owgrPointsFor(50, 70, 1)).toBe(0);
  });
});

/** A world shared by the read-only checks (building one takes a few hundred ms). */
const base = createWorld({ seed: 11, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

describe("createWorld", () => {
  it("starts in season 1 week 1 with a client of the chosen scenario", () => {
    expect(base.season).toBe(1);
    expect(base.week).toBe(1);
    expect(base.players.client!.career.status).toBe("graduate");
    expect(base.players.client!.player.age).toBe(23);
    expect(createWorld({ seed: 11, scenario: "grinder" }).players.client!.career.status).toBe("none");
  });

  it("carries a warm-up season: rankings, last season's points ranks and a spread of statuses", () => {
    const counts = { exempt: 0, graduate: 0, conditional: 0, none: 0, amateur: 0 };
    for (const wp of Object.values(base.players)) counts[wp.career.status]++;
    expect(counts.exempt).toBeGreaterThanOrEqual(FULL_CARD);
    expect(counts.graduate).toBeGreaterThanOrEqual(30);
    expect(counts.conditional).toBeGreaterThan(0);
    expect(counts.none).toBeGreaterThan(0);
    expect(worldRanking(base)[0]!.average).toBeGreaterThan(1);
    expect(Object.values(base.players).filter((wp) => wp.career.priorPointsRank === 1)).toHaveLength(1);
  });

  it("is reproducible from a seed", () => {
    const again = createWorld({ seed: 11, scenario: "rookie" });
    expect(again.players.client!.player.name).toBe(base.players.client!.player.name);
    expect(playWeek(again).results.map((r) => r.result.leaderboard[0]!.player.id)).toEqual(
      playWeek(fresh()).results.map((r) => r.result.leaderboard[0]!.player.id),
    );
  });
});

describe("playWeek", () => {
  it("fills fields within their size, with nobody in two events", () => {
    const w = fresh();
    for (let i = 0; i < 12; i++) {
      const report = playWeek(w);
      const seen = new Set<string>();
      for (const { event, field } of report.results) {
        expect(field.field.length).toBeLessThanOrEqual(event.fieldSize);
        expect(field.mondayQualifiers.length).toBeLessThanOrEqual(MONDAY_SPOTS);
        for (const id of field.field) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
    }
  });

  it("keeps players without status out of fields except through Monday or leftover spots", () => {
    const w = fresh();
    const report = playWeek(w);
    const main = report.results[0]!;
    const noStatus = main.field.field.filter((id) => w.players[id]!.career.status === "none");
    const exemptEntrants = main.field.alternates.filter((id) => w.players[id]!.career.status === "exempt");
    // A player without status never takes a spot while an exempt player waits outside.
    if (exemptEntrants.length > 0) expect(noStatus.every((id) => main.field.mondayQualifiers.includes(id))).toBe(true);
  });

  it("only lets invited players into majors and signature events", () => {
    const w = fresh();
    while (w.week <= 14) {
      const report = playWeek(w);
      for (const { event, field } of report.results) {
        if (event.tier === "signature") expect(field.field.length).toBeLessThanOrEqual(72);
        if (event.tier === "major") expect(field.field).toHaveLength(156);
      }
    }
  });

  it("rests the client when asked, and they recover", () => {
    const w = fresh();
    w.players.client!.player.condition = 60;
    const report = playWeek(w, { client: { kind: "rest" } });
    expect(report.clients.client!.record).toBeNull();
    expect(report.clients.client!.summary).toMatch(/rested/);
    expect(w.players.client!.player.condition).toBeGreaterThan(60);
  });

  it("enters the client and books the money", () => {
    const w = fresh();
    const [opt] = clientOptions(w, "client");
    expect(opt!.access).toBe("in");
    const report = playWeek(w, { client: { kind: "enter", eventId: opt!.event.id } });
    const rec = report.clients.client!.record!;
    expect(rec.eventId).toBe(opt!.event.id);
    expect(w.players.client!.client!.finances.prizeMoney).toBe(rec.earnings);
    const m = w.players.client!.client!;
    expect(m.finances.commission).toBe(Math.round(rec.earnings * m.contract.commission));
    // The agency banks the commission and pays its weekly office costs.
    expect(w.agency.bank).toBe(STARTING_BANK + m.finances.commission - OFFICE_COST);
    expect(w.agency.ledger.prizeCommission).toBe(m.finances.commission);
    expect(w.players.client!.client!.finances.travel).toBeGreaterThan(0);
  });

  it("refuses an event from another week", () => {
    const w = fresh();
    const later = eventsInWeek(w, 5)[0]!;
    expect(() => playWeek(w, { client: { kind: "enter", eventId: later.id } })).toThrow();
  });

  it("sends a player with no status to the Monday qualifier", () => {
    const w = createWorld({ seed: 11, scenario: "grinder" });
    const [opt] = clientOptions(w, "client");
    expect(opt!.access).toBe("monday");
    const report = playWeek(w, { client: { kind: "enter", eventId: opt!.event.id } });
    const played = report.clients.client!.record !== null;
    expect(played ? report.results[0]!.field.field.includes("client") : /Monday qualifier/.test(report.clients.client!.summary)).toBe(true);
  });
});

describe("finishSeason", () => {
  const w = fresh();
  while (w.week <= SEASON_WEEKS) playWeek(w);
  const order = pointsList(w);
  const winners = Object.values(w.players).filter((wp) => wp.career.seasonWins > 0).map((wp) => wp.player.id);
  const ageBefore = w.players.client!.player.age;
  const summary = finishSeason(w)!;

  it("hands out cards from the points list", () => {
    for (const [i, id] of order.entries()) {
      const wp = w.players[id];
      if (!wp) continue; // retired
      if (i < FULL_CARD) expect(wp.career.status).toBe("exempt");
      // 126-150 get conditional status, unless Q-School or a win gave them more.
      else if (i < CONDITIONAL_CARD && !winners.includes(id)) expect(["conditional", "graduate", "exempt"]).toContain(wp.career.status);
    }
  });

  it("gives winners a two-season exemption", () => {
    for (const id of winners) {
      expect(w.players[id]!.career.status).toBe("exempt");
      expect(w.players[id]!.career.exemptThrough).toBe(3);
    }
  });

  it("brings up graduates and starts a fresh season", () => {
    expect(Object.values(w.players).filter((wp) => wp.career.status === "graduate").length).toBeGreaterThanOrEqual(20);
    expect(w.season).toBe(2);
    expect(w.week).toBe(1);
    expect(w.players.client!.player.age).toBe(ageBefore + 1);
    expect(Object.values(w.players).every((wp) => wp.career.seasonPoints === 0 && wp.career.seasonEvents === 0)).toBe(true);
    expect(w.players.client!.client!.finances.prizeMoney).toBe(0);
  });

  it("summarises the client's season", () => {
    expect(summary.season).toBe(1);
    expect(summary.majors).toHaveLength(4);
    expect(summary.pointsLeaders[0]!.points).toBeGreaterThan(summary.pointsLeaders[4]!.points);
    expect(w.pastSeasons).toHaveLength(1);
  });

  it("drops world ranking points older than two years", () => {
    const oldest = Math.min(...Object.values(w.players).flatMap((wp) => wp.career.owgr.map((e) => e.absWeek)));
    expect(oldest).toBeGreaterThan(absWeek(w.season, 1) - 104);
  });
});

describe("saves", () => {
  it("round-trips a world", () => {
    const w = fresh();
    playWeek(w);
    expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  });

  it("rejects an unknown save version", () => {
    const json = JSON.stringify({ ...base, version: 99 });
    expect(() => deserializeWorld(json)).toThrow(/version/);
  });
});

describe("wording", () => {
  it("writes places and event names naturally", () => {
    expect(ordinal("1")).toBe("1st");
    expect(ordinal("T2")).toBe("T2nd");
    expect(ordinal("T13")).toBe("T13th");
    expect(ordinal("MC")).toBe("MC");
    expect(theEvent("The Links Championship")).toBe("The Links Championship");
    expect(theEvent("Crestline Bank Classic")).toBe("the Crestline Bank Classic");
  });
});
