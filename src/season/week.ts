import { clamp, expectedStrokesGained, simulateTournament, totalSg, type TournamentResult } from "../engine";
import { SEASON_WEEKS, majorSetup } from "./calendar";
import { buildFields, courseById, mixSeed, planWeek, weekContext, type AiChoice, type FieldResult } from "./entries";
import { owgrPointsFor, owgrWinnerPoints, seasonPointsFor, tieCounts } from "./points";
import { absWeek, type EventRecord, type TourEvent, type World } from "./types";

/** What the client does this week. */
export type ClientChoice = { kind: "enter"; eventId: string } | { kind: "rest" } | { kind: "auto" };

export interface ClientWeekReport {
  /** What happened to the client this week, in plain words. */
  summary: string;
  record: EventRecord | null;
  /** The client's own event, for showing its leaderboard. */
  result: TournamentResult | null;
}

export interface WeekReport {
  season: number;
  week: number;
  results: { event: TourEvent; result: TournamentResult; field: FieldResult }[];
  client: ClientWeekReport;
}

/** Conditioning lost per event played, plus extra for a trip to another region. */
const EVENT_FATIGUE = 7;
const MAJOR_FATIGUE = 10;
const TRAVEL_FATIGUE = 6;
const REST_RECOVERY = 15;

/** Player expenses per event played, by region. */
const TRAVEL_COST = { NA: 5_000, EU: 9_000, ASIA: 10_000, AUS: 10_000 } as const;
const CADDIE_WEEKLY = 2_000;

export function caddieShare(position: number, madeCut: boolean): number {
  if (!madeCut) return 0;
  return position === 1 ? 0.1 : position <= 10 ? 0.07 : 0.05;
}

function toAiChoice(world: World, choice: ClientChoice): AiChoice | "auto" {
  if (choice.kind === "auto") return "auto";
  if (choice.kind === "rest") return null;
  const e = world.schedule.find((x) => x.id === choice.eventId && x.week === world.week);
  if (!e) throw new Error(`event ${choice.eventId} is not played this week`);
  return { eventId: e.id, route: "entry" };
}

/** Simulates one week of the season for the whole world and moves on. */
export function playWeek(world: World, choice: ClientChoice = { kind: "auto" }): WeekReport {
  if (world.week > SEASON_WEEKS) throw new Error("the season is over; call finishSeason first");
  const ctxBefore = weekContext(world);
  const plan = planWeek(world, toAiChoice(world, choice));
  const fields = buildFields(world, plan);
  const played = new Set<string>();
  const report: WeekReport = { season: world.season, week: world.week, results: [], client: { summary: "", record: null, result: null } };

  fields.forEach((f, i) => {
    if (f.field.length < 2) return;
    const venue = courseById(world, f.event.courseId);
    const course = f.event.tier === "major" ? majorSetup(venue) : venue;
    const players = f.field.map((id) => world.players[id]!.player);
    const expected = new Map(players.map((p) => [p.id, totalSg(expectedStrokesGained(p, course))]));
    const fieldExpected = [...expected.values()].reduce((s, x) => s + x, 0) / players.length;

    const result = simulateTournament({
      name: f.event.name,
      course,
      field: players,
      purse: f.event.purse,
      seed: mixSeed(world.seed, world.season, world.week, 10 + i),
      cutTop: f.event.cutTop ?? undefined,
    });
    const ties = tieCounts(result);
    const winnerOwgr = owgrWinnerPoints(f.event.tier, f.field.map((id) => ctxBefore.owgrRank.get(id) ?? 9999));

    for (const r of result.leaderboard) {
      const wp = world.players[r.player.id]!;
      const c = wp.career;
      const count = ties.get(r.position) ?? 1;
      const record: EventRecord = {
        eventId: f.event.id,
        eventName: f.event.name,
        tier: f.event.tier,
        season: world.season,
        week: world.week,
        position: r.position,
        label: r.positionLabel,
        toPar: r.toPar,
        earnings: r.earnings,
        seasonPoints: r.madeCut ? seasonPointsFor(f.event.tier, r.position, count) : 0,
        owgrPoints: r.madeCut ? owgrPointsFor(winnerOwgr, r.position, count) : 0,
        sgPerRound: Math.round(r.sgPerRound * 100) / 100,
        madeCut: r.madeCut,
        via: f.mondayQualifiers.includes(r.player.id) ? "monday" : "field",
      };
      c.results.push(record);
      c.seasonPoints += record.seasonPoints;
      c.seasonEarnings += r.earnings;
      c.careerEarnings += r.earnings;
      c.seasonEvents++;
      if (r.position === 1) {
        c.seasonWins++;
        c.careerWins++;
      }
      if (record.owgrPoints > 0) c.owgr.push({ absWeek: absWeek(world.season, world.week), points: record.owgrPoints });

      // Confidence follows results against expectation; fatigue follows travel and effort.
      const beat = r.sgPerRound - ((expected.get(r.player.id) ?? 0) - fieldExpected);
      wp.player.form = clamp(wp.player.form * 0.6 + beat * 0.1, -1, 1);
      const travel = c.lastRegion !== null && c.lastRegion !== f.event.region ? TRAVEL_FATIGUE : 0;
      wp.player.condition = clamp(wp.player.condition - (f.event.tier === "major" ? MAJOR_FATIGUE : EVENT_FATIGUE) - travel, 0, 100);
      c.lastRegion = f.event.region;
      played.add(r.player.id);

      if (r.player.id === world.clientId) {
        const caddie = CADDIE_WEEKLY + Math.round(r.earnings * caddieShare(r.position, r.madeCut));
        world.finances.prizeMoney += r.earnings;
        world.finances.caddie += caddie;
        world.finances.travel += TRAVEL_COST[f.event.region];
        const commission = Math.round(r.earnings * world.commissionRate);
        world.finances.commission += commission;
        world.agencyBank += commission;
        report.client.record = record;
        report.client.result = result;
      }
    }

    const w = result.leaderboard[0]!;
    world.news.unshift(`Week ${world.week}: ${w.player.name} wins ${theEvent(f.event.name)} at ${w.toPar > 0 ? "+" : ""}${w.toPar}.`);
    report.results.push({ event: f.event, result, field: f });
  });

  // Everyone who didn't play rests.
  for (const wp of Object.values(world.players)) {
    if (played.has(wp.player.id)) continue;
    wp.player.condition = clamp(wp.player.condition + REST_RECOVERY, 0, 100);
    wp.player.form *= 0.9;
  }

  report.client.summary = describeClientWeek(world, plan.choices.get(world.clientId) ?? null, fields, report.client.record);
  world.news = world.news.slice(0, 30);
  world.week++;
  return report;
}

function describeClientWeek(world: World, choice: AiChoice, fields: FieldResult[], record: EventRecord | null): string {
  const client = world.players[world.clientId];
  if (!client) return "";
  const name = client.player.name;
  if (!choice) return `${name} rested this week.`;
  const f = fields.find((x) => x.event.id === choice.eventId);
  if (!f) return `${name} rested this week.`;
  if (record) {
    const via = record.via === "monday" ? " (Monday qualifier)" : "";
    const toPar = record.toPar === 0 ? "E" : record.toPar > 0 ? `+${record.toPar}` : `${record.toPar}`;
    if (!record.madeCut) return `${name} missed the cut at ${theEvent(f.event.name)}${via}, ${toPar}.`;
    return `${name} finished ${ordinal(record.label)} at ${theEvent(f.event.name)}${via}, ${toPar}, $${record.earnings.toLocaleString("en-US")} and ${record.seasonPoints} points.`;
  }
  if (f.mondayPool.includes(world.clientId)) return `${name} didn't get through the Monday qualifier for ${theEvent(f.event.name)}.`;
  return `${name} wasn't eligible for ${theEvent(f.event.name)}.`;
}

/** "the Crestline Bank Classic", but "The Harrow Invitational" stays as it is. */
export const theEvent = (name: string): string => (name.startsWith("The ") ? name : `the ${name}`);

/** "1" → "1st", "T3" → "T3rd". */
export function ordinal(label: string): string {
  const m = /^(T?)(\d+)$/.exec(label);
  if (!m) return label;
  const n = Number(m[2]);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${m[1]}${n}${suffix}`;
}
