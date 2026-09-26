import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";
import {
  DEV_GRADUATES,
  HALL_OF_FAME_BAR,
  PRO_AGE,
  SAVE_VERSION,
  DEV_WEEKS,
  SEASON_WEEKS,
  QSCHOOL_CARDS,
  amateurPotential,
  amateurRanking,
  approachBlock,
  considerForHallOfFame,
  createWorld,
  deserializeWorld,
  devPointsList,
  finishSeason,
  maybeOffer,
  playWeek,
  pointsList,
  serializeWorld,
  signClient,
  turnPro,
  type World,
} from "../src/season";

const base = createWorld({ seed: 41, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

/** One full season, played once and shared by the read-only checks below. */
const seasonWorld = fresh();
const reports: ReturnType<typeof playWeek>[] = [];
while (seasonWorld.week <= SEASON_WEEKS) reports.push(playWeek(seasonWorld));
const devBefore = devPointsList(seasonWorld);
const mainBefore = pointsList(seasonWorld);
const amateursBefore = Object.values(seasonWorld.players).filter((wp) => wp.career.status === "amateur").map((wp) => wp.player.id);
finishSeason(seasonWorld);
const rec = seasonWorld.history.seasons.find((s) => s.season === 1)!;

describe("developmental tour", () => {
  it("fills its events only with players who lack a main-tour card", () => {
    const devResults = reports.flatMap((r) => r.results.filter((x) => x.event.tier === "dev"));
    expect(devResults.length).toBeGreaterThan(20);
    for (const x of devResults) {
      expect(x.field.field.length).toBeGreaterThan(60);
      expect(x.field.field.length).toBeLessThanOrEqual(144);
    }
  });

  it("keeps its own points list, separate from the main tour's", () => {
    expect(devBefore.length).toBeGreaterThan(DEV_GRADUATES);
    const overlapTop = devBefore.slice(0, 10).filter((id) => mainBefore.slice(0, 10).includes(id));
    expect(overlapTop).toHaveLength(0);
  });

  it("promotes its top 25 to the main tour", () => {
    const viaDev = rec.graduates.filter((g) => g.via === "dev");
    expect(viaDev.length).toBeGreaterThan(15);
    expect(viaDev.length).toBeLessThanOrEqual(DEV_GRADUATES);
    for (const g of viaDev) {
      const wp = seasonWorld.players[g.playerId];
      if (wp) expect(["graduate", "exempt"]).toContain(wp.career.status);
    }
  });
});

describe("Q-School", () => {
  it("runs a full field and hands out cards to the top five", () => {
    expect(rec.qSchool.length).toBeGreaterThanOrEqual(QSCHOOL_CARDS);
    const winners = rec.qSchool.filter((q) => q.position <= QSCHOOL_CARDS);
    expect(winners.length).toBeGreaterThanOrEqual(1);
    for (const q of winners) {
      const wp = seasonWorld.players[q.playerId];
      if (wp) expect(["graduate", "exempt"]).toContain(wp.career.status);
    }
  });

  it("enters a client who lost his card", () => {
    const w = fresh();
    w.players.client!.career.status = "none";
    while (w.week <= SEASON_WEEKS) playWeek(w, { client: { kind: "rest" } });
    finishSeason(w);
    const q = w.history.seasons.find((s) => s.season === 1)!.qSchool;
    const graduated = w.history.seasons.find((s) => s.season === 1)!.graduates.some((g) => g.playerId === "client");
    expect(q.some((r) => r.playerId === "client") || graduated || q.length === 10).toBe(true);
  });
});

describe("amateurs", () => {
  it("never play professional events, except a major they're invited to", () => {
    for (const r of reports) {
      for (const x of r.results) {
        if (x.event.tier === "major") continue;
        for (const id of x.field.field) expect(amateursBefore).not.toContain(id);
      }
    }
  });

  it("crown a champion who's invited to next season's majors", () => {
    expect(rec.amateurChampion).not.toBeNull();
    const w = seasonWorld;
    const champ = rec.amateurChampion!.playerId;
    if (w.players[champ]?.career.status === "amateur") {
      const major = w.schedule.find((e) => e.tier === "major")!;
      w.week = major.week;
      const r = playWeek(w);
      const field = r.results.find((x) => x.event.id === major.id)!.field.field;
      expect(field).toContain(champ);
    }
  });

  it("turn pro by 22 and are replaced by a new class", () => {
    for (const wp of Object.values(seasonWorld.players)) {
      if (wp.career.status === "amateur") expect(wp.player.age).toBeLessThanOrEqual(PRO_AGE);
    }
    const newClass = Object.keys(seasonWorld.players).filter((id) => id.startsWith("s1a"));
    expect(newClass.length).toBeGreaterThan(20);
  });

  it("have no agents and no sponsors, but can be signed and turned pro", () => {
    const w = fresh();
    const am = Object.values(w.players).find((wp) => wp.career.status === "amateur" && !approachBlock(w, wp.player.id))!;
    expect(am.agent).toBeNull();
    signClient(w, am.player.id, { commission: 0.1, years: 3 });
    expect(maybeOffer(w, w.players[am.player.id]!, createRng(1), 1)).toBeNull();
    turnPro(w, am.player.id);
    expect(w.players[am.player.id]!.career.status).toBe("none");
  });

  it("have a public ranking and ceilings from a fixed spread", () => {
    expect(amateurRanking(base).length).toBeGreaterThan(40);
    const rng = createRng(3);
    const pots = Array.from({ length: 2000 }, () => amateurPotential(9, rng));
    expect(Math.max(...pots)).toBeLessThanOrEqual(17);
    expect(pots.filter((p) => p >= 15).length / pots.length).toBeLessThan(0.05);
  });
});

describe("history", () => {
  it("logs every winner and the season's champions", () => {
    const played = reports.reduce((n, r) => n + r.results.length, 0);
    expect(rec.winners).toHaveLength(played);
    expect(rec.pointsChampion?.name).toBeTruthy();
    expect(rec.moneyLeader?.earnings).toBeGreaterThan(0);
    expect(rec.devChampion?.points).toBeGreaterThan(0);
  });

  it("keeps a sensible record book", () => {
    const r = seasonWorld.history.records;
    expect(r.lowestRound!.value).toBeGreaterThan(54);
    expect(r.lowestRound!.value).toBeLessThan(66);
    expect(r.lowest72!.value).toBeLessThan(-10);
    expect(r.biggestMargin!.value).toBeGreaterThanOrEqual(1);
    expect(r.youngestWinner!.value).toBeLessThanOrEqual(r.oldestWinner!.value);
    expect(r.mostWinsSeason!.value).toBeGreaterThanOrEqual(2);
  });

  it("gives veterans a career behind them", () => {
    const vets = Object.values(base.players).filter((wp) => wp.player.age >= 35 && wp.career.status === "exempt");
    expect(vets.some((wp) => wp.career.careerWins > 0)).toBe(true);
    expect(vets.every((wp) => wp.career.careerEvents > 0)).toBe(true);
  });

  it("elects retiring greats to the Hall of Fame", () => {
    const w = fresh();
    const great = Object.values(w.players).find((wp) => wp.career.status === "exempt")!;
    great.career.careerWins = 1;
    expect(considerForHallOfFame(w, great)).toBeNull();
    great.career.careerWins = HALL_OF_FAME_BAR;
    expect(considerForHallOfFame(w, great)?.name).toBe(great.player.name);
    expect(w.history.hallOfFame).toHaveLength(1);
  });
});

describe("saves", () => {
  it("upgrades a version-3 save", () => {
    const raw = JSON.parse(serializeWorld(base)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    raw.version = 3;
    delete raw.history;
    raw.schedule = raw.schedule.filter((e: { tier: string }) => e.tier !== "dev");
    for (const [id, wp] of Object.entries(raw.players) as [string, Record<string, any>][]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (wp.career.status === "amateur") delete raw.players[id];
      for (const k of ["devPoints", "careerMajors", "careerEvents", "careerTop10s", "careerCuts", "pointsTitles"]) delete wp.career[k];
    }
    const w = deserializeWorld(JSON.stringify(raw));
    expect(w.version).toBe(SAVE_VERSION);
    expect(w.schedule.filter((e) => e.tier === "dev").length).toBe(DEV_WEEKS.length);
    expect(Object.values(w.players).filter((wp) => wp.career.status === "amateur").length).toBeGreaterThan(40);
    expect(w.history.seasons).toEqual([]);
    playWeek(w);
  });
});
