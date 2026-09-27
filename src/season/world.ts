import { closeSeasonStats } from "./stats";
import {
  COURSES,
  clamp,
  createRng,
  expectedStrokesGained,
  generatePlayer,
  getCourse,
  simulateTournament,
  totalSg,
  type Player,
  type PlayerTier,
  type Rng,
} from "../engine";
import { DEV_GRADUATES, buildTour, seasonWeeks } from "./calendar";
import { newDevelopment, overall } from "./development";
import { generateCoaches, offseason, OFFSEASON_WEEKS } from "./staff";
import { STANDARD_COMMISSION, addReputation, agencySeasonEnd, clients, assignRivalAgents, emptyFinances, newAgency, newManagement } from "./agency";
import { generateScouts } from "./scouting";
import { AMATEUR_CLASS_SIZE, PRO_AGE, amateurPotential, amateurRanking, generateAmateur } from "./amateurs";
import { closeSeasonRecord, considerForHallOfFame, newHistory } from "./history";
import { databasePlayer, type DatabasePlayer } from "./editor";
import { expireSponsors } from "./sponsors";
import { canPlayDev, devPriority, courseFit, courseById, eventsInWeek, isInvitational, mixSeed, planWeek, priorityCompare, MONDAY_SPOTS } from "./entries";
import { pointsList, rankMap } from "./points";
import type { Course } from "../engine";
import { SAVE_VERSION, absWeek, type Career, type ClientSeasonSummary, type SeasonRecord, type SeasonSummary, type TourEvent, type TourStatus, type World, type WorldPlayer } from "./types";
import { playWeek } from "./week";
import { ensureTraits, seasonEndTraits } from "./traits";
import { ensureFamiliarity, fadeFamiliarity, familiarityWith } from "./familiarity";
import { generateCaddies } from "./team";
import { ensureGoals, settleGoals } from "./goals";

/** How your first client's career starts. */
export type Scenario = "rookie" | "journeyman" | "grinder" | "veteran";

export const SCENARIOS: Record<Scenario, { title: string; blurb: string }> = {
  rookie: {
    title: "The Rookie",
    blurb: "A 23-year-old just up from the developmental tour. Decent status, no margin for error: finish top 125 or lose the card.",
  },
  journeyman: {
    title: "The Journeyman",
    blurb: "A 32-year-old with conditional status. He only gets into fields when they're short, and needs a big week.",
  },
  grinder: {
    title: "The Monday Grinder",
    blurb: "A 21-year-old college standout with no status at all. Every start has to be earned in a Monday qualifier.",
  },
  veteran: {
    title: "The Fading Veteran",
    blurb: "A 45-year-old former winner on the last year of his exemption. The distance is gone; the nous isn't.",
  },
};

const POOL: [PlayerTier, number][] = [
  ["elite", 12],
  ["tour", 150],
  ["fringe", 60],
  ["fringe", 50],
  ["college", 70],
];
const TARGET_POOL_SIZE = POOL.reduce((s, [, n]) => s + n, 0);
/** Card thresholds on the season points list. */
export const FULL_CARD = 125;
export const CONDITIONAL_CARD = 150;
/** Q-School hands out this many cards. */
export const QSCHOOL_CARDS = 5;

const newCareer = (status: TourStatus): Career => ({
  status,
  exemptThrough: null,
  seasonPoints: 0,
  seasonEarnings: 0,
  seasonEvents: 0,
  seasonWins: 0,
  priorPointsRank: null,
  lastRegion: null,
  owgr: [],
  results: [],
  careerEarnings: 0,
  careerWins: 0,
  devPoints: 0,
  careerMajors: 0,
  careerEvents: 0,
  careerTop10s: 0,
  careerCuts: 0,
  pointsTitles: 0,
});

export function makeAmateur(p: Player, rng: Rng): WorldPlayer {
  const wp = makeWorldPlayer(p, "amateur", rng);
  wp.development.potential = amateurPotential(overall(p), rng);
  return wp;
}

export function makeWorldPlayer(p: Player, status: TourStatus, rng: Rng): WorldPlayer {
  return { player: p, career: newCareer(status), targetEvents: 26, development: newDevelopment(p, rng), injury: null, rebuild: null, agent: null };
}

/** A player's quality averaged over the reference courses (for seeding status). */
const quality = (p: Player) => COURSES.reduce((s, c) => s + totalSg(expectedStrokesGained(p, c)), 0) / COURSES.length;

function setTargets(world: World): void {
  const ranks = rankMap(world);
  for (const wp of Object.values(world.players)) {
    const r = ranks.get(wp.player.id) ?? 999;
    wp.targetEvents = r <= 30 ? 21 : wp.career.status === "exempt" ? 26 : 28;
  }
}

export interface CreateWorldOptions {
  seed: number;
  scenario: Scenario;
  agencyName?: string;
  /**
   * Players from a database file. They replace generated players: pros
   * fill the tour first (topped up with generated players if there are too
   * few for full fields), amateurs join the amateur ranks.
   */
  database?: DatabasePlayer[];
}

/**
 * Builds a golf world: a pool of about 260 pros, a tour calendar, and one
 * warm-up season played silently so world rankings, points and cards
 * exist before you arrive. Then your first client joins.
 */
export function createWorld(opts: CreateWorldOptions): World {
  const rng = createRng(opts.seed);
  const { courses, schedule } = buildTour(opts.seed);
  const usedNames = new Set<string>(opts.database?.map((p) => p.name) ?? []);
  const isDbAmateur = (p: DatabasePlayer) => p.status === "amateur" || (p.status === undefined && p.age <= 21);
  const dbPros = (opts.database ?? []).filter((p) => !isDbAmateur(p));
  const dbAmateurs = (opts.database ?? []).filter(isDbAmateur);
  const players: Player[] = dbPros.map((p, i) => databasePlayer(p, `d${i + 1}`));
  // Top up with generated players, keeping the usual mix, until fields can fill.
  const generated: Player[] = [];
  for (const [tier, n] of POOL) for (let i = 0; i < n; i++) generated.push(generatePlayer(rng, { tier, usedNames }));
  const needed = Math.max(0, TARGET_POOL_SIZE - players.length);
  // An even spread across the tiers, so a small database still gets stars, journeymen and hopefuls around it.
  const step = Math.max(1, Math.floor(generated.length / Math.max(1, needed)));
  const filler = opts.database ? generated.filter((_, i) => i % step === 0).slice(0, needed) : generated;
  prefixIds(filler, "w");
  players.push(...filler);
  const dbPotential = new Map(dbPros.map((p, i) => [`d${i + 1}`, p.potential]));

  // Seed statuses from quality, with some noise: the best 125 are exempt, and so on.
  const byQuality = [...players].sort((a, b) => quality(b) + rng.normal(0, 0.3) - (quality(a) + rng.normal(0, 0.3)));
  const statusAt = (i: number): TourStatus => (i < 125 ? "exempt" : i < 155 ? "graduate" : i < 220 ? "conditional" : "none");

  const world: World = {
    version: SAVE_VERSION,
    seed: opts.seed,
    season: 0,
    week: 1,
    players: Object.fromEntries(byQuality.map((p, i) => [p.id, makeWorldPlayer(p, statusAt(i), rng)])),
    courses,
    schedule,
    clientIds: [],
    agency: newAgency(opts.agencyName),
    pastSeasons: [],
    news: [],
    coaches: generateCoaches(opts.seed),
    caddies: generateCaddies(opts.seed),
    history: newHistory(),
  };
  for (const [id, pot] of dbPotential) if (pot !== undefined) world.players[id]!.development.potential = pot;
  // Amateurs from the database, then generated classes to fill three years' worth.
  dbAmateurs.forEach((p, i) => {
    const wp = makeAmateur(databasePlayer(p, `da${i + 1}`), rng);
    if (p.potential !== undefined) wp.development.potential = p.potential;
    world.players[wp.player.id] = wp;
  });
  for (let i = dbAmateurs.length; i < AMATEUR_CLASS_SIZE * 3; i++) {
    const p = generateAmateur(rng, `a${i + 1}`, 16 + (i % 6), usedNames);
    world.players[p.id] = makeAmateur(p, rng);
  }

  setTargets(world);
  ensureFamiliarity(world);
  while (world.week <= seasonWeeks(world)) playWeek(world);
  finishSeason(world, rng);
  world.pastSeasons = [];
  world.news = [];
  // The warm-up season stays in the history books as season 0, so records mean something from day one.
  seedCareerHistory(world, rng);

  assignRivalAgents(world, rng);
  world.agency.scouts = generateScouts(opts.seed);
  // The warm-up season brought in new amateurs and walk-ons: their names are taken too.
  for (const wp of Object.values(world.players)) usedNames.add(wp.player.name);
  const client = createClient(rng, opts.scenario, usedNames);
  client.client = newManagement(world.season, STANDARD_COMMISSION, 3);
  world.players[client.player.id] = client;
  world.clientIds = [client.player.id];
  world.agency.knowledge[client.player.id] = { accuracy: 1, reports: 99, absWeek: 0 };
  setTargets(world);
  ensureTraits(world);
  ensureFamiliarity(world);
  ensureGoals(world);
  return world;
}

function prefixIds(players: Player[], prefix: string): void {
  players.forEach((p, i) => (p.id = `${prefix}${i + 1}`));
}

function createClient(rng: Rng, scenario: Scenario, usedNames: Set<string>): WorldPlayer {
  const make = (tier: PlayerTier, age: number, status: TourStatus, boost = 0, room = 0): WorldPlayer => {
    const p = generatePlayer(rng, { tier, usedNames, nationality: "USA" });
    for (const k of Object.keys(p.attributes) as (keyof Player["attributes"])[]) {
      p.attributes[k] = Math.max(1, Math.min(20, p.attributes[k] + boost));
    }
    p.id = "client";
    p.age = age;
    p.form = 0;
    p.condition = 95;
    const wp = makeWorldPlayer(p, status, rng);
    // How much he can still grow, by scenario (hidden from the player).
    wp.development.potential = Math.round(Math.min(18.5, overall(p) + room + clamp(rng.normal(0, 0.5), -0.5, 0.5)) * 10) / 10;
    wp.targetEvents = 27;
    return wp;
  };
  switch (scenario) {
    // Pitched so each start is a fight for a card, not a cruise.
    case "rookie":
      return make("fringe", 23, "graduate", 1, 2);
    case "journeyman":
      return make("fringe", 32, "conditional", 0, 0.3);
    case "grinder":
      // A standout: near the top of what college players are, but still raw.
      return make("college", 21, "none", 1, 3.5);
    case "veteran": {
      const wp = make("veteran", 45, "exempt", 0, 0);
      wp.career.exemptThrough = 1;
      wp.career.careerWins = 4;
      wp.career.careerEarnings = 21_400_000;
      return wp;
    }
  }
}

/**
 * Closes the season: hands out cards from the points list, brings up
 * developmental-tour graduates, retires some players and adds new ones,
 * ages everyone a year and resets the season's numbers.
 */
export function finishSeason(world: World, rngIn?: Rng): SeasonSummary | null {
  const rng = rngIn ?? createRng(mixSeed(world.seed, world.season, 99));
  const season = world.season;
  const order = pointsList(world);
  // Season goals: met or missed, judged on the final points list and results.
  for (const line of settleGoals(world)) world.news.unshift(line);
  const rankOf = new Map(order.map((id, i) => [id, i + 1]));
  const owgr = rankMap(world);
  const statusBefore = new Map(world.clientIds.map((id) => [id, world.players[id]!.career.status]));
  const repBefore = world.agency.reputation;

  const seasonRec = closeSeasonRecord(world);
  const devOrder = devPointsList(world);

  // Cards from the main tour's points list; winners are exempt for two more seasons.
  for (const wp of Object.values(world.players)) {
    const c = wp.career;
    if (c.status === "amateur") continue;
    const r = rankOf.get(wp.player.id) ?? null;
    if (c.seasonWins > 0) c.exemptThrough = Math.max(c.exemptThrough ?? 0, season + 2);
    const exemptByWin = (c.exemptThrough ?? -1) >= season + 1;
    if ((r !== null && r <= FULL_CARD) || exemptByWin) c.status = "exempt";
    else if (r !== null && r <= CONDITIONAL_CARD) c.status = "conditional";
    else c.status = "none";
    c.priorPointsRank = r;
  }

  // The developmental tour's top 25 move up.
  const promote = (wp: WorldPlayer, via: "dev" | "qschool") => {
    if (wp.career.status === "exempt" || wp.career.status === "graduate") return;
    wp.career.status = "graduate";
    seasonRec.graduates.push({ playerId: wp.player.id, name: wp.player.name, via });
  };
  for (const id of devOrder.slice(0, DEV_GRADUATES)) promote(world.players[id]!, "dev");

  // Q-School: one last chance for everyone else.
  const q = runQSchool(world, rng, rankOf, devOrder);
  seasonRec.qSchool = q.slice(0, 10);
  for (const row of q.filter((x) => x.position <= QSCHOOL_CARDS)) promote(world.players[row.playerId]!, "qschool");
  if (seasonRec.graduates.length) world.news.unshift(`${seasonRec.graduates.length} players earn main-tour cards: ${DEV_GRADUATES} from the developmental tour and the rest through Q-School.`);

  // Amateurs: crown a champion, some turn pro, and a new class arrives.
  const amRanking = amateurRanking(world);
  const champ = amRanking[0] ? world.players[amRanking[0]] : undefined;
  if (champ) seasonRec.amateurChampion = { playerId: champ.player.id, name: champ.player.name };
  amRanking.forEach((id, i) => {
    const wp = world.players[id]!;
    const ready = wp.player.age + 1 >= PRO_AGE || (!wp.client && wp.player.age + 1 >= 20 && i < 10 && rng.chance(0.5));
    if (ready && !(wp.client && wp.player.age + 1 < PRO_AGE)) {
      wp.career.status = "none";
      if (i < 10) world.news.unshift(`Top amateur ${wp.player.name} turns professional.`);
    }
  });
  const usedNames = new Set(Object.values(world.players).map((wp) => wp.player.name));
  for (let i = 0; i < AMATEUR_CLASS_SIZE; i++) {
    const p = generateAmateur(rng, `s${season}a${i + 1}`, rng.pick([16, 17, 17, 18, 18, 19]), usedNames);
    world.players[p.id] = makeAmateur(p, rng);
  }

  // Retirements: players without status drift away, and the old guard hangs it up.
  for (const wp of Object.values(world.players)) {
    if (wp.client || wp.career.status === "amateur") continue;
    const age = wp.player.age;
    const retire =
      age >= 50 ||
      (wp.career.status === "none" && (age >= 42 || rng.chance(0.2))) ||
      (age >= 46 && (wp.career.exemptThrough ?? 0) <= season && rng.chance(0.3));
    if (retire) {
      if (wp.career.careerWins > 0) world.news.unshift(`${wp.player.name} retires at ${age}, with ${wp.career.careerWins} career win${wp.career.careerWins === 1 ? "" : "s"}.`);
      considerForHallOfFame(world, wp);
      delete world.players[wp.player.id];
    }
  }
  // Late developers and walk-ons keep the professional ranks full.
  const pros = () => Object.values(world.players).filter((wp) => wp.career.status !== "amateur").length;
  let n = 0;
  while (pros() < TARGET_POOL_SIZE) {
    const p = generatePlayer(rng, { tier: "fringe", usedNames });
    p.id = `s${season}w${++n}`;
    p.age = rng.int(22, 28);
    world.players[p.id] = makeWorldPlayer(p, "none", rng);
  }

  const clientSummaries = world.clientIds.map((id) => summariseClient(world, world.players[id]!, statusBefore.get(id) ?? "none", rankOf.get(id) ?? null, owgr.get(id) ?? 999));
  // A season's body of work counts too: every client who keeps a card, more for the elite.
  for (const c of clientSummaries) {
    const r = c.pointsRank ?? 999;
    addReputation(world.agency, r <= 10 ? 8 : r <= 30 ? 5 : r <= FULL_CARD ? 2.5 : r <= CONDITIONAL_CARD ? 1 : 0);
  }
  const ledger = { ...world.agency.ledger };
  for (const wp of Object.values(world.players)) expireSponsors(world, wp);
  const departures = world.clientIds.length ? agencySeasonEnd(world, rng) : [];
  const summary: SeasonSummary | null = world.clientIds.length || clientSummaries.length
    ? { ...seasonHeadlines(world), clients: clientSummaries, agency: { reputationBefore: repBefore, reputationAfter: world.agency.reputation, ledger, departures } }
    : null;
  if (summary) world.pastSeasons.push(summary);

  for (const wp of Object.values(world.players)) {
    const c = wp.career;
    c.seasonPoints = 0;
    c.seasonEarnings = 0;
    c.seasonEvents = 0;
    c.seasonWins = 0;
    c.devPoints = 0;
    closeSeasonStats(c, world.season);
    c.lastRegion = null;
    wp.player.age++;
    wp.player.condition = Math.max(wp.player.condition, 90);
    wp.player.form *= 0.5;
  }
  // Coaches cure a demon or two over the winter; the odd veteran's stroke goes.
  seasonEndTraits(world, rng);
  // The winter: ten weeks of practice with no events, then a new season's baseline.
  offseason(world, OFFSEASON_WEEKS, rng);
  for (const wp of Object.values(world.players)) wp.development.seasonStart = { ...wp.player.attributes };
  fadeFamiliarity(world);
  pruneHistory(world);
  world.season++;
  world.week = 1;
  adoptRealTour(world);
  for (const wp of clients(world)) wp.client!.finances = emptyFinances();
  world.agency.ledger = { prizeCommission: 0, endorsementCommission: 0, office: 0, scouts: 0 };
  setTargets(world);
  ensureTraits(world);
  ensureFamiliarity(world);
  ensureGoals(world);
  return summary;
}

/**
 * Careers started before the tour went real switch to the real schedule and
 * venues at the start of their next season. Their old venues stay in the
 * save (history and the editor still know them).
 */
export function adoptRealTour(world: World): void {
  if (world.schedule.some((e) => e.id.startsWith("r"))) return;
  const tour = buildTour(world.seed);
  const replaced = new Set(tour.courses.map((c) => c.id));
  world.courses = [...world.courses.filter((c) => !replaced.has(c.id)), ...tour.courses];
  world.schedule = tour.schedule;
  world.news.unshift("The tour moves to the real schedule: real events on their real courses, from the Sony Open to the RSM Classic.");
}

function seasonHeadlines(world: World): Pick<SeasonSummary, "season" | "pointsLeaders" | "majors"> {
  const season = world.season;
  const leaders = pointsList(world)
    .slice(0, 5)
    .map((id) => world.players[id])
    .filter((wp): wp is WorldPlayer => wp !== undefined)
    .map((wp) => ({ name: wp.player.name, points: Math.round(wp.career.seasonPoints), wins: wp.career.seasonWins }));
  const majors: SeasonSummary["majors"] = [];
  for (const e of world.schedule.filter((x) => x.tier === "major")) {
    for (const wp of Object.values(world.players)) {
      const r = wp.career.results.find((x) => x.season === season && x.eventId === e.id && x.position === 1);
      if (r) majors.push({ event: e.name, winner: wp.player.name, toPar: r.toPar });
    }
  }
  return { season, pointsLeaders: leaders, majors };
}

function summariseClient(world: World, client: WorldPlayer, statusBefore: TourStatus, pointsRank: number | null, owgrRank: number): ClientSeasonSummary {
  const results = client.career.results.filter((r) => r.season === world.season);
  return {
      id: client.player.id,
      name: client.player.name,
      statusBefore,
      statusAfter: client.career.status,
      pointsRank,
      points: Math.round(client.career.seasonPoints),
      events: results.length,
      wins: results.filter((r) => r.position === 1).length,
      top10s: results.filter((r) => r.madeCut && r.position <= 10).length,
      cutsMade: results.filter((r) => r.madeCut).length,
      earnings: client.career.seasonEarnings,
      owgrRank,
      finances: { ...client.client!.finances },
  };
}

export type EntryAccess = "invited" | "not-invited" | "in" | "alternate" | "monday" | "injured";

export interface EntryOption {
  event: TourEvent;
  course: Course;
  access: EntryAccess;
  /** Plain-words explanation for the player. */
  detail: string;
  /** Strokes per round better (+) or worse (-) than the client's usual on this course. */
  fit: number;
  /** His familiarity with the course, 0-100 (0 and never played: a debut). */
  familiarity: number;
  debut: boolean;
}

/** A client's options for this week, with a projection of whether he'd get in. */
export function clientOptions(world: World, clientId: string): EntryOption[] {
  const client = world.players[clientId]!;
  return eventsInWeek(world).map((event) => {
    const course = courseById(world, event.courseId);
    const fit = Math.round(courseFit(client, course) * 100) / 100;
    const base = { event, course, fit, familiarity: familiarityWith(client, course.id), debut: client.career.familiarity?.[course.id] === undefined };
    if (client.injury) {
      return { ...base, access: "injured" as const, detail: `Injured (${client.injury.name.toLowerCase()}), out for about ${client.injury.weeksLeft} more week${client.injury.weeksLeft === 1 ? "" : "s"}.` };
    }
    const plan = planWeek(world, new Map([[clientId, { eventId: event.id, route: "entry" as const }]]));
    if (client.career.status === "amateur" && !(event.tier === "major" && plan.invited.get(event.id)!.has(clientId))) {
      return { ...base, access: "not-invited" as const, detail: "Amateurs don't play professional events. Turn him pro first." };
    }
    if (event.tier === "dev") {
      if (!canPlayDev(client)) return { ...base, access: "not-invited" as const, detail: "The developmental tour is for pros without a main-tour card." };
      const entrants = [...plan.choices.entries()]
        .filter(([, c]) => c?.eventId === event.id)
        .map(([id]) => world.players[id]!)
        .filter(canPlayDev)
        .sort(devPriority);
      const pos = entrants.findIndex((wp) => wp.player.id === clientId) + 1;
      return pos <= event.fieldSize
        ? { ...base, access: "in" as const, detail: `Developmental tour: in (priority ${pos} of ${event.fieldSize}). Top ${DEV_GRADUATES} on its points list earn cards.` }
        : { ...base, access: "alternate" as const, detail: `Developmental tour: alternate (priority ${pos} of ${event.fieldSize}).` };
    }
    if (isInvitational(event.tier)) {
      const invited = plan.invited.get(event.id)!.has(clientId);
      return {
        ...base,
        access: invited ? "invited" : "not-invited",
        detail: invited ? "You're in the field." : `Invitation only (${inviteRule(event)}).`,
      };
    }
    if (client.career.status === "none") {
      return { ...base, access: "monday", detail: `No status: needs a Monday qualifier (${MONDAY_SPOTS} spots).` };
    }
    const direct = [...plan.choices.entries()]
      .filter(([id, c]) => c?.eventId === event.id && c.route === "entry" && world.players[id]!.career.status !== "none")
      .map(([id]) => world.players[id]!)
      .sort(priorityCompare);
    const pos = direct.findIndex((wp) => wp.player.id === clientId) + 1;
    const spots = event.fieldSize - MONDAY_SPOTS;
    return pos <= spots
      ? { ...base, access: "in", detail: `In on status (priority ${pos} of ${spots} spots).` }
      : { ...base, access: "alternate", detail: `Alternate (priority ${pos}, ${spots} spots): would go to the Monday qualifier.` };
  });
}

/** The event a client would pick on his own this week (null = rest). */
export function clientPreference(world: World, clientId: string): string | null {
  return planWeek(world, new Map()).choices.get(clientId)?.eventId ?? null;
}

function inviteRule(e: TourEvent): string {
  if (e.tier === "major") return "top 80 in the world, recent winners, last season's top 50";
  if (e.tier === "signature") return "top 50 on the points list, this or last season, or a winner this season";
  return `top ${e.fieldSize} on the points list`;
}

/**
 * Keeps saves small: world ranking points older than two years never count
 * again, and computer players keep only their last two seasons of results
 * (their win and money totals are kept on the career). The client keeps everything.
 */
function pruneHistory(world: World): void {
  // Called before the season number moves on: next season's week 1 is when these stop counting.
  const cutoff = absWeek(world.season + 1, 1) - 104;
  for (const wp of Object.values(world.players)) {
    wp.career.owgr = wp.career.owgr.filter((e) => e.absWeek > cutoff);
    if (!wp.client) wp.career.results = wp.career.results.filter((r) => r.season >= world.season - 1);
  }
}

/** Developmental tour points list, best first. */
export function devPointsList(world: World): string[] {
  return Object.values(world.players)
    .filter((wp) => wp.career.devPoints > 0)
    .sort((a, b) => b.career.devPoints - a.career.devPoints)
    .map((wp) => wp.player.id);
}

/** Q-School runs here, at the desert course that's hosted it for years. */
const QSCHOOL_COURSE = "saguaro-wells";
const QSCHOOL_FIELD = 156;

/**
 * Q-School: players who missed out on the main tour (points 126-200), the
 * developmental tour's next tier, your clients without a card, and a
 * handful of hopefuls. 72 holes; the top five earn cards.
 */
export function runQSchool(world: World, rng: Rng, rankOf: Map<string, number>, devOrder: string[]): SeasonRecord["qSchool"] {
  const eligible = (wp: WorldPlayer) => (wp.career.status === "none" || wp.career.status === "conditional") && wp.player.age < 45 && !wp.injury;
  const picked = new Set<string>();
  const add = (id: string | undefined) => {
    const wp = id ? world.players[id] : undefined;
    if (wp && eligible(wp) && picked.size < QSCHOOL_FIELD) picked.add(wp.player.id);
  };
  for (const id of world.clientIds) add(id);
  for (const [id, r] of [...rankOf.entries()].sort((a, b) => a[1] - b[1])) if (r > FULL_CARD && r <= 200) add(id);
  for (const id of devOrder.slice(DEV_GRADUATES, 100)) add(id);
  for (const wp of Object.values(world.players).sort((a, b) => a.player.id.localeCompare(b.player.id))) if (rng.chance(0.3)) add(wp.player.id);
  if (picked.size < 10) return [];
  const course = getCourse(QSCHOOL_COURSE);
  const result = simulateTournament({
    name: "Q-School",
    course,
    field: [...picked].map((id) => world.players[id]!.player),
    purse: 0,
    seed: mixSeed(world.seed, world.season, 777),
    cutTop: 65,
  });
  return result.leaderboard.filter((r) => r.madeCut).map((r) => ({ playerId: r.player.id, name: r.player.name, toPar: r.toPar, position: r.position }));
}

/**
 * The world didn't start the day you arrived: give established pros the
 * wins, majors and starts a career of their standing would have produced,
 * so veterans look like veterans and the Hall of Fame has contenders.
 */
function seedCareerHistory(world: World, rng: Rng): void {
  for (const wp of Object.values(world.players)) {
    if (wp.career.status === "amateur") continue;
    const years = Math.max(0, wp.player.age - 23);
    if (years === 0) continue;
    const q = quality(wp.player);
    const winsPerYear = q > 2 ? 1.6 : q > 1.2 ? 0.7 : q > 0.5 ? 0.25 : q > 0 ? 0.08 : 0.01;
    let wins = 0;
    for (let y = 0; y < years; y++) wins += rng.next() < winsPerYear % 1 ? Math.ceil(winsPerYear) : Math.floor(winsPerYear);
    const c = wp.career;
    c.careerWins += wins;
    c.careerMajors += Math.round(wins * (0.1 + rng.next() * 0.15));
    c.careerEvents += years * 24;
    c.careerCuts += Math.round(years * 24 * Math.min(0.9, 0.5 + q * 0.12));
    c.careerTop10s += Math.round(years * 24 * Math.min(0.4, Math.max(0.02, 0.06 + q * 0.07)));
    c.careerEarnings += Math.round(years * Math.max(150_000, 1_200_000 + q * 1_800_000));
  }
}
