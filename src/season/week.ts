import { recordEventStats } from "./stats";
import { clamp, createRng, expectedStrokesGained, simulateTournament, totalSg, type TournamentResult } from "../engine";
import { seasonWeeks, majorSetup } from "./calendar";
import { buildFields, courseById, mixSeed, planWeek, weekContext, type AiChoice, type FieldResult } from "./entries";
import { owgrPointsFor, owgrWinnerPoints, seasonPointsFor, tieCounts } from "./points";
import { OFFICE_COST, addReputation, clients, reputationFor, updateHappiness } from "./agency";
import { scoutingWeek, weeklyScoutCost } from "./scouting";
import { sponsorBonus, sponsorWeek } from "./sponsors";
import { recordEvent } from "./history";
import { endOfWeek } from "./staff";
import { absWeek, type EventRecord, type TourEvent, type World } from "./types";

/** What a client does this week. "auto" lets him pick his own schedule. */
export type ClientChoice = { kind: "enter"; eventId: string } | { kind: "rest" } | { kind: "auto" };
/** Choices by client id; clients without one play "auto". */
export type ClientChoices = Record<string, ClientChoice>;

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
  /** One report per client, by id. */
  clients: Record<string, ClientWeekReport>;
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
export function playWeek(world: World, choices: ClientChoices = {}): WeekReport {
  if (world.week > seasonWeeks(world)) throw new Error("the season is over; call finishSeason first");
  const ctxBefore = weekContext(world);
  const own = new Map<string, AiChoice | "auto">();
  for (const id of world.clientIds) own.set(id, toAiChoice(world, choices[id] ?? { kind: "auto" }));
  const plan = planWeek(world, own);
  const fields = buildFields(world, plan);
  const played = new Set<string>();
  const report: WeekReport = { season: world.season, week: world.week, results: [], clients: {} };
  for (const id of world.clientIds) report.clients[id] = { summary: "", record: null, result: null };
  const sgVsExpected = new Map<string, number>();

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
        seasonPoints: r.madeCut ? seasonPointsFor(f.event.tier, r.position, count, f.event.winnerPoints) : 0,
        owgrPoints: r.madeCut ? owgrPointsFor(winnerOwgr, r.position, count) : 0,
        sgPerRound: Math.round(r.sgPerRound * 100) / 100,
        madeCut: r.madeCut,
        via: f.mondayQualifiers.includes(r.player.id) ? "monday" : "field",
      };
      c.results.push(record);
      recordEventStats(c, world.season, f.event.tier, result, r, record.seasonPoints);
      // Developmental tour points go on their own list.
      if (f.event.tier === "dev") c.devPoints += record.seasonPoints;
      else c.seasonPoints += record.seasonPoints;
      c.seasonEarnings += r.earnings;
      c.careerEarnings += r.earnings;
      c.careerEvents++;
      if (r.madeCut) c.careerCuts++;
      if (r.madeCut && r.position <= 10) c.careerTop10s++;
      if (f.event.tier !== "dev") c.seasonEvents++;
      if (r.position === 1 && f.event.tier !== "dev") {
        c.seasonWins++;
        c.careerWins++;
        if (f.event.tier === "major") c.careerMajors++;
      }
      if (record.owgrPoints > 0) c.owgr.push({ absWeek: absWeek(world.season, world.week), points: record.owgrPoints });

      // Confidence follows results against expectation; fatigue follows travel and effort.
      const beat = r.sgPerRound - ((expected.get(r.player.id) ?? 0) - fieldExpected);
      sgVsExpected.set(r.player.id, beat);
      wp.player.form = clamp(wp.player.form * 0.6 + beat * 0.1, -1, 1);
      const travel = c.lastRegion !== null && c.lastRegion !== f.event.region ? TRAVEL_FATIGUE : 0;
      wp.player.condition = clamp(wp.player.condition - (f.event.tier === "major" ? MAJOR_FATIGUE : EVENT_FATIGUE) - travel, 0, 100);
      c.lastRegion = f.event.region;
      played.add(r.player.id);

      if (wp.client) {
        const m = wp.client;
        const caddie = CADDIE_WEEKLY + Math.round(r.earnings * caddieShare(r.position, r.madeCut));
        m.finances.prizeMoney += r.earnings;
        m.finances.caddie += caddie;
        m.finances.travel += TRAVEL_COST[f.event.region];
        const commission = Math.round(r.earnings * m.contract.commission);
        m.finances.commission += commission;
        world.agency.bank += commission;
        world.agency.ledger.prizeCommission += commission;
        const bonus = sponsorBonus(wp, r.position, f.event.tier === "major");
        if (bonus > 0) payEndorsement(world, wp.player.id, bonus);
        addReputation(world.agency, reputationFor(r.position, r.madeCut, f.event.tier));
        report.clients[wp.player.id] = { summary: "", record, result };
      }
    }

    recordEvent(world, f.event, result);
    const w = result.leaderboard[0]!;
    if (f.event.tier === "dev" && !world.players[w.player.id]?.client) {
      report.results.push({ event: f.event, result, field: f });
      return; // dev tour winners don't make the headlines unless they're yours
    }
    world.news.unshift(`Week ${world.week}: ${w.player.name} wins ${theEvent(f.event.name)} at ${w.toPar > 0 ? "+" : ""}${w.toPar}.`);
    report.results.push({ event: f.event, result, field: f });
  });

  // Everyone who didn't play rests.
  for (const wp of Object.values(world.players)) {
    if (played.has(wp.player.id)) continue;
    wp.player.condition = clamp(wp.player.condition + REST_RECOVERY, 0, 100);
    wp.player.form *= 0.9;
  }
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 3));
  endOfWeek(world, played, rng);

  // The agency's week: sponsors pay, moods move, scouts report, bills are paid.
  for (const wp of clients(world)) {
    const id = wp.player.id;
    const rec = report.clients[id]?.record ?? null;
    const goodWeek = !!rec && rec.madeCut && rec.position <= 5;
    const pay = sponsorWeek(world, wp, rng, goodWeek, seasonWeeks(world));
    if (pay > 0) payEndorsement(world, id, pay);
    updateHappiness(wp, { played: played.has(id), sgVsExpected: sgVsExpected.get(id) ?? null, heldOut: heldOut(plan, id, choices[id]) });
    report.clients[id]!.summary = describeClientWeek(world, id, plan.choices.get(id) ?? null, fields, rec);
  }
  // No agency exists during the silent warm-up season, so nothing to pay.
  if (world.clientIds.length > 0) {
    scoutingWeek(world);
    const costs = OFFICE_COST + weeklyScoutCost(world);
    world.agency.bank -= costs;
    world.agency.ledger.office += OFFICE_COST;
    world.agency.ledger.scouts += costs - OFFICE_COST;
  }

  world.news = world.news.slice(0, 40);
  world.week++;
  return report;
}

/** Endorsement money: the client gets it, the agency takes its cut. */
function payEndorsement(world: World, clientId: string, amount: number): void {
  const m = world.players[clientId]!.client!;
  const cut = Math.round(amount * m.contract.endorsementCommission);
  m.finances.endorsements += amount;
  m.finances.commission += cut;
  world.agency.bank += cut;
  world.agency.ledger.endorsementCommission += cut;
}

/** You kept him out of a big event he was in and wanted to play. */
function heldOut(plan: ReturnType<typeof planWeek>, id: string, choice: ClientChoice | undefined): boolean {
  if (!choice || choice.kind === "auto") return false;
  const main = plan.events[0];
  if (!main || (main.tier !== "major" && main.tier !== "signature")) return false;
  return !!plan.invited.get(main.id)?.has(id) && (choice.kind === "rest" || choice.eventId !== main.id);
}

function describeClientWeek(world: World, clientId: string, choice: AiChoice, fields: FieldResult[], record: EventRecord | null): string {
  const client = world.players[clientId];
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
  if (f.mondayPool.includes(clientId)) return `${name} didn't get through the Monday qualifier for ${theEvent(f.event.name)}.`;
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
