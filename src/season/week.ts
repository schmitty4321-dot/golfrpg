import { payBrands, recordClientWin, updateFollowers } from "./showcase";
import { recordHighlight } from "./highlights";
import { recordRivalries, recordRyderRivalries, rivalryEdge, rivalryWeek } from "./rivalries";
import { weeklyRivalMessages } from "./rivalAgents";
import { MAX_DECISIONS_PER_WEEK, autoResolve } from "./inbox";
import { weeklyDilemmas } from "./dilemmas";
import { settleBoldClaim, weeklyPress } from "./press";
import { ryderCupPromiseChecks, weeklyPromiseChecks } from "./promises";
import { payStaff } from "./market";
import { payCenter, payInterest, recordBank, recordDealCommission } from "./business";
import { COACH_PRIZE_SHARE, chargeDevelopment, coachesHired } from "./finance";
import { recordEventStats } from "./stats";
import { finalLine, simulateMatchPlay } from "./matchPlayEvent";
import { playerRecord, ryderCupWeekEnd } from "./ryderCup";
import { clamp, createRng, expectedStrokesGained, simulateTournament, startLive, totalSg, type LiveTournament, type TournamentConfig, type TournamentResult } from "../engine";
import { seasonWeeks, majorSetup } from "./calendar";
import { asSetUp, tallyRealScoring } from "./courseSetup";
import { buildFields, courseById, mixSeed, planWeek, weekContext, type AiChoice, type FieldResult } from "./entries";
import { owgrPointsFor, owgrWinnerPoints, seasonPointsFor, tieCounts } from "./points";
import { addReputation, clients, hqTier, reputationFor, updateHappiness } from "./agency";
import { scoutingWeek, weeklyScoutCost } from "./scouting";
import { sponsorBonus, sponsorWeek } from "./sponsors";
import { recordEvent } from "./history";
import { beginRebuild, endOfWeek } from "./staff";
import { familiarityWith, recordFamiliarity } from "./familiarity";
import { takePracticeRound, takePracticeTrip } from "./practice";
import { caddiePay, payJet, travelMode } from "./team";
import { ensureGoals } from "./goals";
import { EVENT_WEEK_ACTIVITIES, OFF_WEEK_ACTIVITIES, applyPlan, familiarityAfterPractice, fitPlan, trainingBoost, weekDays, type DayActivity } from "./planner";
import {
  ensureTraits,
  eventContext,
  fatigueMultiplier,
  feelsTravel,
  has,
  hotheadHeadline,
  onMajorWin,
  recoveryMultiplier,
  reputationBonus,
  settleHappiness,
  traitMood,
  weeklyTraitEvents,
} from "./traits";
import { homeRegion } from "../engine";
import { absWeek, type EventRecord, type TourEvent, type World } from "./types";

/** What a client does this week. "auto" lets him pick his own schedule. */
export type ClientChoice =
  | { kind: "enter"; eventId: string; /** A practice round there first (older saves; the planner's days replace it). */ practice?: boolean; /** Monday to Wednesday. */ days?: DayActivity[] }
  | { kind: "rest"; /** The week off, Monday to Sunday. */ days?: DayActivity[] }
  | { kind: "auto" }
  /** A week's practice trip to any course, instead of an event. */
  | { kind: "practice"; courseId: string };
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

export function caddieShare(position: number, madeCut: boolean): number {
  if (!madeCut) return 0;
  return position === 1 ? 0.1 : position <= 10 ? 0.07 : 0.05;
}

function toAiChoice(world: World, choice: ClientChoice): AiChoice | "auto" {
  if (choice.kind === "auto") return "auto";
  if (choice.kind === "rest" || choice.kind === "practice") return null;
  const e = world.schedule.find((x) => x.id === choice.eventId && x.week === world.week);
  if (!e) throw new Error(`event ${choice.eventId} is not played this week`);
  return { eventId: e.id, route: "entry" };
}

/** An event this week with your clients in it, set up to be played live (round by round, or hole by hole). */
export interface LiveEvent {
  event: TourEvent;
  field: FieldResult;
  clientIds: string[];
  /** The client walked hole by hole (the first of yours in the field). */
  tournament: LiveTournament;
}

function weekPlan(world: World, choices: ClientChoices) {
  const own = new Map<string, AiChoice | "auto">();
  const now = absWeek(world.season, world.week);
  for (const id of world.clientIds) {
    // Sitting out a week he was given off (an inbox decision).
    const rest = (world.players[id]?.client?.restUntil ?? -1) >= now;
    own.set(id, rest ? null : toAiChoice(world, choices[id] ?? { kind: "auto" }));
  }
  const plan = planWeek(world, own);
  honourPromises(world, plan, own);
  return { plan, fields: buildFields(world, plan) };
}

/**
 * A client left to pick his own schedule keeps your promises: no
 * opposite-field events, every major he's invited to, and the event cap.
 */
function honourPromises(world: World, plan: ReturnType<typeof planWeek>, own: Map<string, AiChoice | "auto">): void {
  for (const id of world.clientIds) {
    if (own.get(id) !== "auto") continue;
    const wp = world.players[id];
    const open = (wp?.client?.promises ?? []).filter((p) => p.status === "open" && p.season === world.season);
    if (!wp || !open.length || wp.injury) continue;
    const choice = plan.choices.get(id) ?? null;
    const event = choice ? plan.events.find((e) => e.id === choice.eventId) : undefined;
    const major = plan.events.find((e) => e.tier === "major");
    if (open.some((p) => p.kind === "majors") && major && plan.invited.get(major.id)?.has(id)) plan.choices.set(id, { eventId: major.id, route: "entry" });
    else if (event?.tier === "opposite" && open.some((p) => p.kind === "noOpposite")) plan.choices.set(id, null);
    else if (event && open.some((p) => p.kind === "maxEvents" && wp.career.seasonEvents >= (p.limit ?? 22)) && event.tier !== "major") plan.choices.set(id, null);
  }
}

/** Practice rounds each client has planned at his event this week. */
function practising(choices: ClientChoices): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, c] of Object.entries(choices)) {
    if (c.kind !== "enter") continue;
    const n = (c.practice ? 1 : 0) + (c.days ? c.days.filter((d) => d === "practice").length : 0);
    if (n) out.set(id, n);
  }
  return out;
}

/** Each client's planned days, fitted to the days he actually has this week. */
export function weekPlans(world: World, choices: ClientChoices): Map<string, DayActivity[]> {
  const out = new Map<string, DayActivity[]>();
  for (const id of world.clientIds) {
    const c = choices[id];
    const wp = world.players[id];
    if (!wp || !c || (c.kind !== "enter" && c.kind !== "rest")) continue;
    const event = c.kind === "enter" ? world.schedule.find((e) => e.id === c.eventId) : undefined;
    const { days, travel } = weekDays(world, wp, event?.region ?? null);
    out.set(id, fitPlan(c.days, days.length - travel, event ? EVENT_WEEK_ACTIVITIES : OFF_WEEK_ACTIVITIES));
  }
  return out;
}

function tournamentConfig(world: World, f: FieldResult, i: number, practice: Map<string, number> = new Map()): TournamentConfig {
  const venue = courseById(world, f.event.courseId);
  const context = Object.fromEntries(f.field.map((id) => [id, eventContext(world, f.event, id)]));
  // A practice round counts already: he knows the course a little better, and it's no longer a debut.
  for (const id of f.field) {
    if (!practice.has(id)) continue;
    context[id] = { ...context[id]!, familiarity: familiarityAfterPractice(world.players[id]!, f.event.courseId, practice.get(id)!), debut: false };
  }
  // Local knowledge counts against the field's: the week's average familiarity with the course.
  const all = Object.values(context);
  const fieldFamiliarity = all.reduce((s, c) => s + (c.familiarity ?? 0), 0) / Math.max(1, all.length);
  for (const c of all) c.fieldFamiliarity = fieldFamiliarity;
  // A hot rival in the field gets to your clients.
  const fieldSet = new Set(f.field);
  for (const id of f.field) {
    const wp = world.players[id]!;
    if (!wp.client) continue;
    const edge = rivalryEdge(world, wp, fieldSet);
    if (edge) context[id] = { ...context[id]!, rivalry: edge };
  }
  return {
    name: f.event.name,
    course: asSetUp(world, f.event.tier === "major" ? majorSetup(venue) : venue),
    field: f.field.map((id) => world.players[id]!.player),
    purse: f.event.purse,
    seed: mixSeed(world.seed, world.season, world.week, 10 + i),
    cutTop: f.event.cutTop ?? undefined,
    tier: f.event.tier,
    context,
  };
}

/**
 * This week's events with your clients in the field, as live tournaments,
 * before anything is played. Play them (see startLiveRound, playLiveHole,
 * finishLive), then pass the results to playWeek, which plays the rest of
 * the week exactly as it would have anyway.
 */
export function liveEvents(world: World, choices: ClientChoices = {}): LiveEvent[] {
  if (world.week > seasonWeeks(world)) return [];
  ensureTraits(world);
  const { fields } = weekPlan(world, choices);
  const out: LiveEvent[] = [];
  fields.forEach((f, i) => {
    const clientIds = f.field.filter((id) => world.clientIds.includes(id));
    // Match play is simulated: its draw and bracket are shown afterwards.
    if (!clientIds.length || f.field.length < 2 || f.event.format === "matchplay") return;
    out.push({ event: f.event, field: f, clientIds, tournament: startLive(tournamentConfig(world, f, i, practising(choices)), clientIds[0]!) });
  });
  return out;
}

/**
 * Simulates one week of the season for the whole world and moves on. Events
 * already played live come in `played`, by event id, and are used as they are.
 */
export function playWeek(world: World, choices: ClientChoices = {}, played: Record<string, TournamentResult> = {}): WeekReport {
  if (world.week > seasonWeeks(world)) throw new Error("the season is over; call finishSeason first");
  ensureTraits(world);
  ensureGoals(world);
  // Anything left in the inbox takes its default choice.
  autoResolve(world);
  const ctxBefore = weekContext(world);
  const { plan, fields } = weekPlan(world, choices);
  const playedIds = new Set<string>();
  const report: WeekReport = { season: world.season, week: world.week, results: [], clients: {} };
  for (const id of world.clientIds) report.clients[id] = { summary: "", record: null, result: null };
  const sgVsExpected = new Map<string, number>();
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 3));
  // Where each client played this week, for the traits that care who else was there.
  const eventOf = new Map<string, TourEvent>();
  const tripTo = new Map<string, string>();
  // The planner: fitted before anyone travels (travel days depend on where he's coming from).
  const plans = weekPlans(world, choices);
  const practice = practising(choices);

  fields.forEach((f, i) => {
    if (f.field.length < 2) return;
    const config = tournamentConfig(world, f, i, practising(choices));
    const { course, field: players } = config;
    const expected = new Map(players.map((p) => [p.id, totalSg(expectedStrokesGained(p, course))]));
    const fieldExpected = [...expected.values()].reduce((s, x) => s + x, 0) / players.length;

    const result = played[f.event.id] ?? (f.event.format === "matchplay" ? simulateMatchPlay(config, ctxBefore.owgrRank) : simulateTournament(config));
    // Main-tour scoring on real courses sets next winter's course setup (stroke play only).
    if (f.event.tier !== "dev" && !result.bracket) tallyRealScoring(world, course, result);
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
      // Season shot stats are stroke play's: partial match-play rounds would skew them.
      if (!result.bracket) recordEventStats(c, world.season, f.event.tier, result, r, record.seasonPoints);
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
        if (f.event.tier === "major") {
          c.careerMajors++;
          onMajorWin(world, wp);
        }
      }
      if (record.owgrPoints > 0) c.owgr.push({ absWeek: absWeek(world.season, world.week), points: record.owgrPoints });

      // Confidence follows results against expectation; fatigue follows travel and effort.
      const beat = r.sgPerRound - ((expected.get(r.player.id) ?? 0) - fieldExpected);
      sgVsExpected.set(r.player.id, beat);
      wp.player.form = clamp(wp.player.form * 0.6 + beat * 0.1, -1, 1);
      // A perfectionist takes a missed cut harder than most.
      if (!r.madeCut && has(wp, "perfectionist")) wp.player.form = clamp(wp.player.form - 0.1, -1, 1);
      const mode = travelMode(world, wp);
      const travel = c.lastRegion !== null && c.lastRegion !== f.event.region && feelsTravel(wp) ? TRAVEL_FATIGUE * mode.fatigue : 0;
      const effort = (f.event.tier === "major" ? MAJOR_FATIGUE : EVENT_FATIGUE) * fatigueMultiplier(world, wp);
      wp.player.condition = clamp(wp.player.condition - effort - travel, 0, 100);
      c.lastRegion = f.event.region;
      const pc = choices[wp.player.id];
      if (wp.client && pc?.kind === "enter" && pc.eventId === f.event.id) for (let n = practice.get(wp.player.id) ?? 0; n > 0; n--) takePracticeRound(wp, f.event.courseId);
      recordFamiliarity(wp, f.event.courseId, r.rounds.length, r.position, r.madeCut);
      playedIds.add(r.player.id);

      if (wp.client) {
        const m = wp.client;
        const caddie = caddiePay(world, wp, r.earnings, caddieShare(r.position, r.madeCut));
        m.finances.prizeMoney += r.earnings;
        chargeDevelopment(world, wp.player.id, Math.round(r.earnings * COACH_PRIZE_SHARE * coachesHired(world, wp.player.id)), "coaching");
        m.finances.caddie += caddie;
        m.finances.travel += Math.round(TRAVEL_COST[f.event.region] * mode.cost);
        const commission = Math.round(r.earnings * m.contract.commission);
        m.finances.commission += commission;
        recordDealCommission(world, wp.player.id, commission);
        world.agency.bank += commission;
        world.agency.ledger.prizeCommission += commission;
        const bonus = sponsorBonus(wp, r.position, f.event.tier === "major");
        if (bonus > 0) payEndorsement(world, wp.player.id, bonus);
        addReputation(world.agency, reputationFor(r.position, r.madeCut, f.event.tier) + (f.event.tier === "dev" ? 0 : reputationBonus(wp, r.position, r.madeCut)));
        if (!r.madeCut) hotheadHeadline(world, wp, rng);
        updateFollowers(world, wp, { position: r.position, madeCut: r.madeCut }, 0);
        if (r.position === 1 && f.event.tier !== "dev") recordClientWin(world, wp, f.event.name, f.event.tier === "major");
        eventOf.set(wp.player.id, f.event);
        report.clients[wp.player.id] = { summary: "", record, result };
        const eaten = settleBoldClaim(wp, record);
        if (eaten) world.news.unshift(eaten);
      }
    }

    recordEvent(world, f.event, result);
    recordRivalries(world, f.event, result);
    if (result.bracket) {
      world.lastBracket = {
        season: world.season,
        week: world.week,
        eventId: f.event.id,
        name: f.event.name,
        venue: course.name,
        bracket: result.bracket,
        names: Object.fromEntries(result.leaderboard.map((r) => [r.player.id, r.player.name])),
      };
    }
    const w = result.leaderboard[0]!;
    if (f.event.tier === "dev" && !world.players[w.player.id]?.client) {
      report.results.push({ event: f.event, result, field: f });
      return; // dev tour winners don't make the headlines unless they're yours
    }
    const mp = finalLine(result);
    world.news.unshift(mp ? `Week ${world.week}: ${mp} to win ${theEvent(f.event.name)}.` : `Week ${world.week}: ${w.player.name} wins ${theEvent(f.event.name)} at ${w.toPar > 0 ? "+" : ""}${w.toPar}.`);
    report.results.push({ event: f.event, result, field: f });
  });

  // The Ryder Cup, in its week: its players count as having played.
  const ryder = ryderCupWeekEnd(world);
  if (ryder) for (const id of Object.keys(ryder.names)) playedIds.add(id);
  if (ryder) ryderCupPromiseChecks(world, new Set(Object.keys(ryder.names)));
  if (ryder) recordRyderRivalries(world, ryder);
  rivalryWeek(world);
  // Promises: an opposite-field start, a skipped major, too many events, no elite coach.
  const majorThisWeek = plan.events.find((e) => e.tier === "major");
  weeklyPromiseChecks(
    world,
    new Map(world.clientIds.map((id) => [id, eventOf.get(id)?.tier ?? null])),
    new Set(majorThisWeek ? [...(plan.invited.get(majorThisWeek.id) ?? [])].filter((id) => world.clientIds.includes(id)) : []),
  );

  // Everyone who didn't play rests.
  for (const wp of Object.values(world.players)) {
    if (playedIds.has(wp.player.id)) continue;
    wp.player.condition = clamp(wp.player.condition + REST_RECOVERY * recoveryMultiplier(world, wp), 0, 100);
    wp.player.form *= 0.9;
  }
  // Practice trips: the week at another course instead of resting.
  for (const id of world.clientIds) {
    const c = choices[id];
    const wp = world.players[id];
    if (c?.kind !== "practice" || !wp || wp.injury || playedIds.has(id)) continue;
    takePracticeTrip(world, wp, c.courseId);
    tripTo.set(id, c.courseId);
  }
  endOfWeek(world, playedIds, rng, new Map([...plans].map(([id, p]) => [id, trainingBoost(p)])));
  // A week longer together: the caddie and his player get to know each other.
  for (const id of world.clientIds) {
    const m = world.players[id]?.client;
    if (m?.caddieId) m.caddieWeeks = (m.caddieWeeks ?? 0) + 1;
  }
  if (world.clientIds.length > 0) payJet(world);
  weeklyTraitEvents(world, rng, beginRebuild);

  // The agency's week: sponsors pay, moods move, scouts report, bills are paid.
  for (const wp of clients(world)) {
    const id = wp.player.id;
    const rec = report.clients[id]?.record ?? null;
    const goodWeek = !!rec && rec.madeCut && rec.position <= 5;
    const dayPlan = plans.get(id) ?? [];
    const pay = sponsorWeek(world, wp, rng, goodWeek, seasonWeeks(world), 0.1 * dayPlan.filter((d) => d === "sponsor").length);
    if (pay > 0) payEndorsement(world, id, pay);
    const before = wp.client!.happiness;
    updateHappiness(wp, { played: playedIds.has(id), sgVsExpected: sgVsExpected.get(id) ?? null, heldOut: heldOut(plan, id, choices[id]) });
    const ev = eventOf.get(id);
    const mood = traitMood(world, wp, {
      played: playedIds.has(id),
      madeCut: rec ? rec.madeCut : null,
      earnings: rec?.earnings ?? 0,
      sentToOpposite: choices[id]?.kind === "enter" && ev?.tier === "opposite",
      stablemates: ev ? world.clientIds.filter((o) => o !== id && eventOf.get(o) === ev).length : 0,
      stablemateWon: world.clientIds.some((o) => o !== id && report.clients[o]?.record?.position === 1 && report.clients[o]?.record?.tier !== "dev"),
      playedAtHome: !!ev && homeRegion(wp.player.nationality) === ev.region,
    });
    // He likes playing a course he knows well.
    const loves = ev && familiarityWith(wp, ev.courseId) >= 70 ? 2 : 0;
    const planned = applyPlan(world, wp, dayPlan);
    wp.client!.happiness = clamp(wp.client!.happiness + mood + loves + planned, 0, 100);
    settleHappiness(wp, before, world);
    const rc = ryder && ryder.names[id] ? playerRecord(ryder, id) : null;
    report.clients[id]!.summary = rc
      ? `${wp.player.name} played in the Ryder Cup: ${rc.w} won, ${rc.l} lost, ${rc.h} halved.`
      : tripTo.has(id)
        ? `${wp.player.name} spent the week practising at ${courseById(world, tripTo.get(id)!).name}.`
        : describeClientWeek(world, id, plan.choices.get(id) ?? null, fields, rec);
  }
  // No agency exists during the silent warm-up season, so nothing to pay.
  if (world.clientIds.length > 0) {
    scoutingWeek(world);
    const office = hqTier(world.agency).office;
    const costs = office + weeklyScoutCost(world);
    world.agency.bank -= costs;
    world.agency.ledger.office += office;
    world.agency.ledger.scouts += costs - office;
    payCenter(world);
    payStaff(world);
    payBrands(world);
    payInterest(world);
    recordBank(world);
  }

  // The shot of the week.
  if (world.clientIds.length > 0) recordHighlight(world, report.results);
  // Sponsor buzz from the press fades week by week.
  for (const wp of clients(world)) if (wp.client!.buzz) wp.client!.buzz = Math.round(wp.client!.buzz * 0.9 * 1000) / 1000 || 0;

  world.news = world.news.slice(0, 40);
  world.week++;
  // The inbox for the coming week: press conferences about this one, then a dilemma or two.
  if (world.clientIds.length > 0) {
    const records = new Map(world.clientIds.map((id) => [id, report.clients[id]?.record ?? null]));
    const pressed = weeklyPress(world, records, new Set(ryder ? Object.keys(ryder.names) : []));
    const messages = weeklyRivalMessages(world, report, createRng(mixSeed(world.seed, world.season, world.week, 1803)), MAX_DECISIONS_PER_WEEK - pressed);
    weeklyDilemmas(world, records, createRng(mixSeed(world.seed, world.season, world.week, 1802)), MAX_DECISIONS_PER_WEEK - pressed - messages);
  }
  return report;
}

/** Endorsement money: the client gets it, the agency takes its cut. */
function payEndorsement(world: World, clientId: string, amount: number): void {
  const m = world.players[clientId]!.client!;
  const cut = Math.round(amount * m.contract.endorsementCommission);
  m.finances.endorsements += amount;
  m.finances.commission += cut;
  world.agency.bank += cut;
  recordDealCommission(world, clientId, cut);
  world.agency.ledger.endorsementCommission += cut;
}

/** You kept him out of a big event he was in and wanted to play. */
function heldOut(plan: ReturnType<typeof planWeek>, id: string, choice: ClientChoice | undefined): boolean {
  if (!choice || choice.kind === "auto") return false;
  const main = plan.events[0];
  if (!main || (main.tier !== "major" && main.tier !== "signature")) return false;
  return !!plan.invited.get(main.id)?.has(id) && (choice.kind !== "enter" || choice.eventId !== main.id);
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
    if (f.event.format === "matchplay") {
      const stage = record.position === 1 ? "won it" : record.position <= 4 ? "reached the semi-finals" : record.position <= 8 ? "reached the quarter-finals" : record.position <= 16 ? "won his group" : "went out in the groups";
      return `${name} ${stage} at ${theEvent(f.event.name)}: ${ordinal(record.label)}, $${record.earnings.toLocaleString("en-US")} and ${record.seasonPoints} points.`;
    }
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
