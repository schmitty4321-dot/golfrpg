import { chargeWinterPrograms } from "./finance";
import { checkChallenge } from "./challenges";
import { alumniReferrals, alumnusRetires } from "./legacy";
import { checkAchievements } from "./achievements";
import { rivalRelationshipsSeasonEnd } from "./rivalAgents";
import { seasonEndPromiseChecks } from "./promises";
import { closeSeasonStats } from "./stats";
import { logSeason } from "./charts";
import {
  APPLIED_SKEW,
  ATTRIBUTE_GROUPS,
  COURSES,
  clamp,
  createRng,
  NATION_LIST,
  traceSeed,
  expectedStrokesGained,
  generatePlayer,
  getCourse,
  simulateTournament,
  totalSg,
  type Player,
  type PlayerTier,
  type Rng,
} from "../engine";
import { DEV_EXEMPT_THROUGH, DEV_GRADUATES, addFullDevTour, buildTour, matchPlayEvent, seasonWeeks } from "./calendar";
import { MAX_POTENTIAL, archetypeCeiling, newDevelopment, overall } from "./development";
import { asSetUp, nextCourseSetup } from "./courseSetup";
import { generateCoaches, offseason, OFFSEASON_WEEKS } from "./staff";
import { rivalSeasonEnd } from "./rivals";
import { EUROPE, ensureRyderCup } from "./ryderCup";
import { STAFF_LABELS, contractFee, hiredStaffer, staffContract, staffSeasonEnd, stafferFee } from "./market";
import { addDecision } from "./inbox";
import { STANDARD_COMMISSION, addReputation, agencySeasonEnd, clients, assignRivalAgents, emptyFinances, newAgency, newManagement } from "./agency";
import { generateScouts } from "./scouting";
import { AMATEUR_CLASS_SIZE, PRO_AGE, amateurPotential, amateurRanking, generateAmateur } from "./amateurs";
import { closeSeasonRecord, considerForHallOfFame, newHistory } from "./history";
import { databasePlayer, type DatabasePlayer } from "./editor";
import { expireSponsors } from "./sponsors";
import { canPlayDev, devExempt, devPriority, finalsEligible, sponsorChance, courseFit, courseById, eventsInWeek, isInvitational, mixSeed, planWeek, priorityCompare, MONDAY_SPOTS } from "./entries";
import { pointsList, rankMap, worldRanking, type RankingRow } from "./points";
import type { Course } from "../engine";
import type { StaffRole } from "./types";
import { SAVE_VERSION, absWeek, type Career, type ClientSeasonSummary, type SeasonRecord, type SeasonSummary, type TourEvent, type TourStatus, type World, type WorldPlayer, type WorldStyle } from "./types";
import { playWeek } from "./week";
import { ensureTraits, seasonEndTraits } from "./traits";
import { ensureFamiliarity, fadeFamiliarity, familiarityWith } from "./familiarity";
import { generateCaddies } from "./team";
import { ensureGoals, settleGoals } from "./goals";
import { investmentsSeasonEnd } from "./investments";
import { setObjectives, settleBoard } from "./board";
import { bloomsAndBusts, developmentReports } from "./progression";

/** How your first client's career starts. */
export type Scenario = "agency" | "rookie" | "journeyman" | "grinder" | "veteran";

export const SCENARIOS: Record<Scenario, { title: string; blurb: string }> = {
  agency: {
    title: "Your first three clients",
    blurb: "A rookie fighting for his card, a 25-year-old who needs to kick on, and a veteran on the last year of his exemption. Three careers, one bank account.",
  },
  rookie: {
    title: "The Rookie",
    blurb: "A 23-year-old just up from the developmental tour. Decent status, no margin for error: finish top 100 or lose the card.",
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
/**
 * Mini-tour pros: a deeper bench below the fringe (a point weaker), so the
 * developmental tour and the main tour's short fields fill most weeks.
 */
const MINI_TOUR = 100;
const TARGET_POOL_SIZE = POOL.reduce((s, [, n]) => s + n, 0) + MINI_TOUR;
/** Card thresholds on the season points list. Full cards go to the top 100 on the points list (the PGA TOUR's rule from 2026; it was 125). */
export const FULL_CARD = 100;
export const CONDITIONAL_CARD = 150;
/** Q-School hands out this many cards. */
export const QSCHOOL_CARDS = 5;
/** How much better than an average fringe pro a walk-on joining the developmental tour is. */
export const WALK_ON_EDGE = 0;

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

/**
 * Europeans on this tour are the pick of a deeper home tour (the DP World Tour
 * isn't in the game), so they come stronger than the average player: enough
 * that Europe's Ryder Cup team matches the United States' (see ryderCup.ts).
 * Golf skills for generated pros and walk-ons, the ceiling for amateurs.
 *
 * The tour's talent as a whole stays where the realism report has it: everyone
 * else gives up the same amount on average (about a fifth of a point a skill),
 * so the field doesn't get deeper at the top.
 */
export const EUROPE_EDGE = 1;
const isEuropean = (p: Player) => EUROPE.has(p.nationality);
let offset: number | null = null;
/** What everyone else gives up, per skill, to pay for Europe's edge (worked out on first use: module order). */
export function nonEuropeOffset(): number {
  if (offset === null) {
    const total = NATION_LIST.reduce((t, n) => t + n.weight, 0);
    const share = NATION_LIST.filter((n) => EUROPE.has(n.key)).reduce((t, n) => t + n.weight, 0) / total;
    offset = (EUROPE_EDGE * share) / (1 - share);
  }
  return offset;
}

function europeanEdge(p: Player): void {
  if (isEuropean(p)) {
    for (const k of GOLF_SKILLS) p.attributes[k] = clamp(Math.round(p.attributes[k] + EUROPE_EDGE), 1, 20);
    return;
  }
  // Drawn from the player's own stream, so the world's shared one is untouched.
  const rng = createRng(traceSeed("europe-offset", p.name, p.age, p.nationality));
  for (const k of GOLF_SKILLS) if (rng.chance(nonEuropeOffset())) p.attributes[k] = clamp(p.attributes[k] - 1, 1, 20);
}

/** An amateur's ceiling, adjusted the same way. */
const ceilingEdge = (p: Player) => (isEuropean(p) ? EUROPE_EDGE : -nonEuropeOffset());

export function makeAmateur(p: Player, rng: Rng): WorldPlayer {
  const wp = makeWorldPlayer(p, "amateur", rng);
  wp.development.potential = Math.min(Math.max(MAX_POTENTIAL, overall(p)), amateurPotential(overall(p), rng) + archetypeCeiling(p) + ceilingEdge(p));
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
  /** Realism setting: realistic (default) or lively. */
  style?: WorldStyle;
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
  for (let i = 0; i < MINI_TOUR; i++) {
    const p = generatePlayer(rng, { tier: "fringe", usedNames });
    for (const k of GOLF_SKILLS) p.attributes[k] = clamp(p.attributes[k] - 1, 1, 20);
    generated.push(p);
  }
  for (const p of generated) europeanEdge(p);
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
    ...(opts.style && opts.style !== "realistic" ? { style: opts.style } : {}),
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
  // The agency opens with its first clients: one, or the usual three (a rookie, a 25-year-old and a
  // veteran) on staggered contracts, so money and decisions bite from the first week.
  const shapeRng = createRng(mixSeed(opts.seed, 23));
  const starters: { scenario: StarterKind; id: string; years: number }[] =
    opts.scenario === "agency"
      ? [
          { scenario: "rookie", id: "client", years: 3 },
          { scenario: "prospect", id: "client2", years: 2 },
          { scenario: "veteran", id: "client3", years: 1 },
        ]
      : [{ scenario: opts.scenario, id: "client", years: 3 }];
  const rankingBenchmarks = worldRanking(world);
  world.clientIds = [];
  for (const s of starters) {
    const client = createClient(rng, s.scenario, usedNames, shapeRng, s.id);
    seedStarterRanking(client, s.scenario, rankingBenchmarks, world);
    usedNames.add(client.player.name);
    client.client = newManagement(world.season, STANDARD_COMMISSION, s.years);
    world.players[client.player.id] = client;
    world.clientIds.push(client.player.id);
    world.agency.knowledge[client.player.id] = { accuracy: 1, reports: 99, absWeek: 0 };
  }
  setTargets(world);
  ensureTraits(world);
  ensureFamiliarity(world);
  ensureGoals(world);
  // Every world has a Ryder Cup record, as a loaded save does.
  ensureRyderCup(world);
  setObjectives(world);
  return world;
}

/**
 * New clients arrive with careers that predate the agency. Give that prior
 * work an OWGR baseline instead of leaving every starter tied on zero points.
 */
function seedStarterRanking(wp: WorldPlayer, scenario: StarterKind, benchmarks: RankingRow[], world: World): void {
  const targetRank: Record<StarterKind, number> = {
    rookie: 300,
    prospect: 125,
    veteran: 215,
    journeyman: 240,
    grinder: 360,
  };
  const benchmark = benchmarks[Math.min(targetRank[scenario] - 1, benchmarks.length - 1)];
  const average = Math.max(0.03, benchmark?.average ?? 0);
  const totalPoints = average * 40;
  const now = absWeek(world.season, world.week);
  wp.career.owgr = Array.from({ length: 6 }, (_, i) => ({
    absWeek: now - 2 * i,
    points: totalPoints / 6,
  }));
}

function prefixIds(players: Player[], prefix: string): void {
  players.forEach((p, i) => (p.id = `${prefix}${i + 1}`));
}

/** The kinds of player an agency can start with (a scenario's single client, or one of the three). */
type StarterKind = Exclude<Scenario, "agency"> | "prospect";

function createClient(rng: Rng, scenario: StarterKind, usedNames: Set<string>, shapeRng: Rng, id = "client"): WorldPlayer {
  const make = (tier: PlayerTier, age: number, status: TourStatus, boost = 0, room = 0, shape?: (p: Player) => void): WorldPlayer => {
    const p = generatePlayer(rng, { tier, usedNames, nationality: "USA" });
    // His ceiling comes from the player as drawn (with any boost), before reshaping.
    let before = overall(p) + boost;
    if (shape) shape(p);
    else {
      for (const k of Object.keys(p.attributes) as (keyof Player["attributes"])[]) {
        p.attributes[k] = Math.max(1, Math.min(20, p.attributes[k] + boost));
      }
      before = overall(p);
    }
    p.id = id;
    p.age = age;
    p.form = 0;
    p.condition = 95;
    const wp = makeWorldPlayer(p, status, rng);
    // How much he can still grow, by scenario (hidden from the player).
    wp.development.potential = Math.round(Math.min(18.5, before + room + clamp(rng.normal(0, 0.5), -0.5, 0.5)) * 10) / 10;
    wp.targetEvents = 27;
    return wp;
  };
  switch (scenario) {
    // Pitched so each start is a fight for a card, not a cruise.
    case "rookie": {
      const wp = make("fringe", 23, "graduate", 1, 2, (p) => shapeRookie(p, shapeRng));
      wp.development.potential = rookieCeiling(overall(wp.player), shapeRng);
      return wp;
    }
    case "journeyman":
      return make("fringe", 32, "conditional", 0, 0.3);
    // Kept his card last season, just: a little below tour average, with a couple of years to grow.
    case "prospect":
      return make("fringe", 25, "exempt", 1, 1.5, (p) => {
        // Around tour average, never a ready-made star: between 11.2 and 12.8.
        const target = clamp(overall(p) + 1, 11.2, 12.8);
        const shift = Math.round(target - overall(p));
        for (const k of GOLF_SKILLS) p.attributes[k] = clamp(p.attributes[k] + shift, 1, 20);
        // Whole-point shifts can round him under the range: one more point if so.
        if (overall(p) < 11.2) for (const k of GOLF_SKILLS) p.attributes[k] = clamp(p.attributes[k] + 1, 1, 20);
      });
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

const GOLF_SKILLS = [...ATTRIBUTE_GROUPS.longGame, ...ATTRIBUTE_GROUPS.approach, ...ATTRIBUTE_GROUPS.shortGame, ...ATTRIBUTE_GROUPS.putting];
const ROOKIE_MENTAL = ATTRIBUTE_GROUPS.mental.filter((k) => k !== "aggression");

/**
 * The Rookie's ceiling, from a bell curve as real careers are: Data Golf's
 * 1990-2014 PGA TOUR rookies peaked in a normal spread (sd about 1 stroke a
 * round, about 2 of overall here). Centred so roughly 3% have a legend's
 * ceiling (16.3+), 13% a star's, 19% a top-25 player's, a third an average
 * pro's and the rest below; some can't grow at all. Reaching it is up to you.
 */
export const ROOKIE_CEILING = { mean: 12.8, sd: 1.8 };

export function rookieCeiling(now: number, rng: Rng): number {
  return Math.round(clamp(rng.normal(ROOKIE_CEILING.mean, ROOKIE_CEILING.sd), now, MAX_POTENTIAL) * 10) / 10;
}

/**
 * A developmental-tour graduate: one real strength (14-16), two or three
 * clear weaknesses (7-9), the rest 10-12, and an unproven head (8-11).
 * About 3.5-4 points of overall behind the world's top 20, so early weeks
 * are won by scheduling and strategy. His archetype picks where the
 * strength and weaknesses fall; a separate RNG keeps the rest of the world unchanged.
 */
export function shapeRookie(p: Player, rng: Rng): void {
  const a = p.attributes;
  const skew: Partial<Record<string, number>> = p.archetype ? APPLIED_SKEW[p.archetype] : {};
  const strong = GOLF_SKILLS.filter((k) => (skew[k] ?? 0) > 0);
  const specialty = rng.pick(strong.length ? strong : GOLF_SKILLS);
  // Weaknesses: his archetype's weak spots first, then whatever he's worst at.
  const others = GOLF_SKILLS.filter((k) => k !== specialty).sort((x, y) => (skew[x] ?? 0) - (skew[y] ?? 0) || a[x] - a[y]);
  const weak = new Set(others.slice(0, rng.int(2, 3)));
  const rest = others.filter((k) => !weak.has(k));
  const mid = [...rest].map((k) => a[k]).sort((x, y) => x - y)[Math.floor(rest.length / 2)]!;
  for (const k of rest) a[k] = clamp(Math.round(11 + (a[k] - mid) / 2), 10, 12);
  for (const k of weak) a[k] = rng.int(7, 9);
  a[specialty] = rng.int(14, 16);
  for (const k of ROOKIE_MENTAL) a[k] = clamp(Math.round(a[k] - 2.5), 8, 11);
}

/**
 * Generations vary: each new amateur class has a strength that carries over
 * partly from the last (Data Golf finds generations peak at different ages
 * and rates). Some worlds get a golden era, some a weak spell. Drawn from
 * its own stream so the rest of the world's luck is untouched.
 */
export function nextGeneration(world: World): number {
  const rng = createRng(mixSeed(world.seed, world.season, 1301));
  const st = styleOf(world);
  const g = clamp(0.6 * (world.generation ?? 0) + rng.normal(0, st.generationSd), -st.generationCap, st.generationCap);
  world.generation = Math.round(g * 100) / 100;
  if (g >= 0.45) world.news.unshift("Scouts call the new amateur class the strongest in years.");
  else if (g <= -0.45) world.news.unshift("This year's amateur class looks thin.");
  return world.generation;
}

/** Share of pros who have a breakout season, and who slump, each year (realistic worlds). */
export const BREAKOUT_CHANCE = 0.04;
export const SLUMP_CHANCE = 0.04;
/** How far a breakout or slump moves him, strokes gained a round. */
export const SEASON_FORM_SG = 0.5;

/**
 * The Realism setting. Realistic is tuned to Data Golf (see realism.ts);
 * Lively turns up the drama: rounds scatter more, more players break out or
 * slump and by more, and generations swing further.
 */
export const STYLES: Record<WorldStyle, { label: string; blurb: string; scatter: number; seasonFormChance: number; seasonFormSg: number; generationSd: number; generationCap: number }> = {
  realistic: { label: "Realistic", blurb: "Tuned to real PGA TOUR data: rounds, careers and winners behave like the real thing.", scatter: 1, seasonFormChance: BREAKOUT_CHANCE, seasonFormSg: SEASON_FORM_SG, generationSd: 0.35, generationCap: 0.9 },
  lively: { label: "Lively", blurb: "More upsets, hot streaks and slumps, and wilder generations. Less predictable, more drama.", scatter: 1.15, seasonFormChance: 0.08, seasonFormSg: 0.7, generationSd: 0.5, generationCap: 1.2 },
};

export const styleOf = (world: World) => STYLES[world.style ?? "realistic"];

/**
 * Each winter a few players find something and a few lose it: a season-long
 * lift or drag on their golf, on top of their level. Your coaches can tell
 * you which way a client is heading; everyone else you see in the results.
 */
export function drawSeasonForm(world: World): void {
  const rng = createRng(mixSeed(world.seed, world.season, 1302));
  for (const wp of Object.values(world.players)) {
    delete wp.seasonForm;
    if (wp.career.status === "amateur") continue;
    const u = rng.next();
    const st = styleOf(world);
    const sg = u < st.seasonFormChance ? st.seasonFormSg : u < 2 * st.seasonFormChance ? -st.seasonFormSg : 0;
    if (!sg) continue;
    wp.seasonForm = { season: world.season, sg };
    if (wp.client) world.news.unshift(sg > 0 ? `${wp.player.name}'s coaches say he has found something this winter.` : `${wp.player.name} doesn't look himself in practice this winter.`);
  }
}

/**
 * The chance a player without a card gives it up this winter. Real careers
 * are short for most (Data Golf: about a third of PGA TOUR rookies last ten
 * full seasons): each season off the main tour makes quitting likelier, more
 * so once he's past 30.
 */
export function retireChance(seasonsWithoutCard: number, age: number): number {
  return clamp(0.1 + 0.15 * (seasonsWithoutCard - 1) + 0.03 * Math.max(0, age - 30), 0, 0.85);
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
    // Promoted mid-season from the developmental tour: the card runs through next season.
    else if (c.promotedSeason === season) c.status = "graduate";
    else c.status = "none";
    c.priorPointsRank = r;
  }

  // The developmental tour's top 20 move up; the next 40 keep full status there.
  const promote = (wp: WorldPlayer, via: "dev" | "qschool") => {
    if (wp.career.status === "exempt" || wp.career.status === "graduate") return;
    wp.career.status = "graduate";
    seasonRec.graduates.push({ playerId: wp.player.id, name: wp.player.name, via });
  };
  for (const id of devOrder.slice(0, DEV_GRADUATES)) promote(world.players[id]!, "dev");
  for (const id of devOrder.slice(DEV_GRADUATES, DEV_EXEMPT_THROUGH)) {
    const c = world.players[id]!.career;
    if (c.status === "none" || c.status === "conditional") c.devExemptThrough = season + 1;
  }

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
  const generation = nextGeneration(world);
  for (let i = 0; i < AMATEUR_CLASS_SIZE; i++) {
    const p = generateAmateur(rng, `s${season}a${i + 1}`, rng.pick([16, 17, 17, 18, 18, 19]), usedNames, generation);
    world.players[p.id] = makeAmateur(p, rng);
  }

  // Seasons off the main tour pile up; a card resets the count.
  for (const wp of Object.values(world.players)) {
    if (wp.career.status === "amateur") continue;
    wp.career.noCardSeasons = wp.career.status === "none" ? (wp.career.noCardSeasons ?? 0) + 1 : 0;
  }

  // Retirements: players without status drift away (faster the longer they've been off tour,
  // and the older they are), and the old guard hangs it up.
  for (const wp of Object.values(world.players)) {
    if (wp.client || wp.career.status === "amateur") continue;
    const age = wp.player.age;
    const retire =
      age >= 50 ||
      (wp.career.status === "none" && (age >= 42 || rng.chance(retireChance(wp.career.noCardSeasons ?? 1, age)))) ||
      (age >= 46 && (wp.career.exemptThrough ?? 0) <= season && rng.chance(0.3));
    if (retire) {
      // A former client of yours comes back as a coach.
      alumnusRetires(world, wp);
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
    // Walk-ons are the best of a deep pool of mini-tour players, not an average one: the
    // developmental tour needs graduates who can keep a card about half the time, as real ones do.
    for (const k of GOLF_SKILLS) p.attributes[k] = clamp(Math.round(p.attributes[k] + WALK_ON_EDGE), 1, 20);
    europeanEdge(p);
    world.players[p.id] = makeWorldPlayer(p, "none", rng);
  }

  const clientSummaries = world.clientIds.map((id) => summariseClient(world, world.players[id]!, statusBefore.get(id) ?? "none", rankOf.get(id) ?? null, owgr.get(id) ?? 999));
  // A season's body of work counts too: every client who keeps a card, more for the elite.
  for (const c of clientSummaries) {
    const r = c.pointsRank ?? 999;
    addReputation(world.agency, r <= 10 ? 8 : r <= 30 ? 5 : r <= FULL_CARD ? 2.5 : r <= CONDITIONAL_CARD ? 1 : 0);
  }
  // The agency's investments pay out (or cost) for the season before the books close.
  investmentsSeasonEnd(world);
  const ledger = { ...world.agency.ledger };
  // The owners judge the season on its closing books.
  const verdict = settleBoard(world, ledger);
  if (verdict) world.news.unshift(verdict);
  // The winter's course setup: next season's courses play to their real averages again.
  const courseSetup = nextCourseSetup(world);
  for (const wp of Object.values(world.players)) expireSponsors(world, wp);
  // Promises for the season are settled before contracts run out.
  seasonEndPromiseChecks(world);
  const departures = world.clientIds.length ? agencySeasonEnd(world, rng) : [];
  rivalRelationshipsSeasonEnd(world);
  // The rivals' winter: reputations, the market for every free player, deals and winter plans.
  for (const line of rivalSeasonEnd(world).slice(0, 8).reverse()) world.news.unshift(line);
  const summary: SeasonSummary | null = world.clientIds.length || clientSummaries.length
    ? { ...seasonHeadlines(world), clients: clientSummaries, agency: { reputationBefore: repBefore, reputationAfter: world.agency.reputation, ledger, departures }, courseSetup }
    : null;
  if (summary) world.pastSeasons.push(summary);
  checkAchievements(world);
  checkChallenge(world, "season");
  // Retired alumni send the odd prospect from home.
  if (world.clientIds.length > 0) alumniReferrals(world, createRng(mixSeed(world.seed, season, 2101)));

  // Each client's season of development, before the winter changes anything.
  developmentReports(world);
  for (const wp of Object.values(world.players)) {
    if (wp.client) wp.client.fatigue = 0;
    const c = wp.career;
    c.seasonPoints = 0;
    c.seasonEarnings = 0;
    c.seasonEvents = 0;
    c.seasonWins = 0;
    c.devPoints = 0;
    c.seasonDevWins = 0;
    logSeason(wp, world.season, rankOf.get(wp.player.id) ?? null);
    closeSeasonStats(c, world.season);
    c.lastRegion = null;
    wp.player.age++;
    wp.player.condition = Math.max(wp.player.condition, 90);
    wp.player.form *= 0.5;
  }
  // Your staff: a year of loyalty and a point on every rating; deals that are up come back as decisions.
  const expiringStaff = staffSeasonEnd(world);
  // Coaches cure a demon or two over the winter; the odd veteran's stroke goes.
  seasonEndTraits(world, rng);
  // A few young players' ceilings move: late bloomers and busts.
  bloomsAndBusts(world, rng);
  // The winter: ten weeks of practice with no events, then a new season's baseline.
  offseason(world, OFFSEASON_WEEKS, rng);
  for (const wp of Object.values(world.players)) wp.development.seasonStart = { ...wp.player.attributes };
  fadeFamiliarity(world);
  pruneHistory(world);
  world.season++;
  world.week = 1;
  adoptRealTour(world);
  addFullDevTour(world);
  addMatchPlay(world);
  drawSeasonForm(world);
  for (const wp of clients(world)) wp.client!.finances = emptyFinances();
  world.agency.ledger = { prizeCommission: 0, endorsementCommission: 0, office: 0, scouts: 0, development: 0 };
  // The winter program he just did goes on the new season's books.
  chargeWinterPrograms(world);
  setTargets(world);
  ensureTraits(world);
  ensureFamiliarity(world);
  ensureGoals(world);
  for (const x of expiringStaff) staffContractDecision(world, x.role);
  setObjectives(world);
  return summary;
}

/** A staffer whose deal is up: re-sign them (cheaper the longer they've been with you), or let them go. */
function staffContractDecision(world: World, role: StaffRole): void {
  const s = hiredStaffer(world, role);
  const c = staffContract(world, role);
  if (!s || !c) return;
  const label = STAFF_LABELS[role].label.toLowerCase();
  const fee = (years: number) => contractFee({ ...s, weeklyFee: stafferFee(s.quality) }, years, c.seasonsServed);
  const k = (n: number) => `$${(fee(n) / 1000).toFixed(1)}k a week`;
  addDecision(world, {
    kind: "dilemma",
    key: `staff-${role}`,
    clientId: "",
    title: `${s.name}'s contract is up`,
    text: `Your ${label} (${s.quality}/20, ${c.seasonsServed} season${c.seasonsServed === 1 ? "" : "s"} with you) wants to know where they stand. Loyalty earns them a discount on a new deal.`,
    choices: [
      { id: "renew2", label: "Re-sign for 2 years", detail: k(2), effects: [{ k: "staffRenew", role, years: 2 }] },
      { id: "renew1", label: "Re-sign for 1 year", detail: k(1), effects: [{ k: "staffRenew", role, years: 1 }] },
      { id: "renew3", label: "Re-sign for 3 years", detail: k(3), effects: [{ k: "staffRenew", role, years: 3 }] },
      { id: "release", label: "Let them go", detail: "Nothing to pay: their deal has run out.", effects: [{ k: "staffRelease", role }] },
    ],
    defaultChoice: "renew2",
    big: true,
  });
}

/**
 * Careers started before the tour went real switch to the real schedule and
 * venues at the start of their next season. Their old venues stay in the
 * save (history and the editor still know them).
 */
/**
 * Careers on the real tour from before the Match Play Championship existed
 * get it from their next season (added at the season's start, or now if its
 * week hasn't come round yet).
 */
export function addMatchPlay(world: World): void {
  if (!world.schedule.some((e) => e.id.startsWith("r")) || world.schedule.some((e) => e.format === "matchplay")) return;
  const event = matchPlayEvent();
  if (world.schedule.some((e) => e.id === event.id)) return; // an edited schedule already uses the id
  if (world.week > event.week && world.week > 1) return;
  if (!world.courses.some((c) => c.id === event.courseId)) world.courses.push(getCourse(event.courseId));
  world.schedule.push(event);
}

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
      const finals = finalsEligible(world, event);
      if (finals && !finals.has(clientId)) return { ...base, access: "not-invited" as const, detail: `Finals: only the top ${event.fieldSize} on the developmental points list play (and the next few as alternates).` };
      const entrants = [...plan.choices.entries()]
        .filter(([, c]) => c?.eventId === event.id)
        .map(([id]) => world.players[id]!)
        .filter(canPlayDev)
        .sort(devPriority(world));
      const pos = entrants.findIndex((wp) => wp.player.id === clientId) + 1;
      return pos <= event.fieldSize
        ? { ...base, access: "in" as const, detail: `${event.devFinals ? `Finals event ${event.devFinals} of 4` : "Developmental tour"}: in (priority ${pos} of ${event.fieldSize}${devExempt(world, client) ? ", fully exempt" : ""}). Top ${DEV_GRADUATES} on its points list earn cards${event.devFinals ? "" : "; 3 wins earn one on the spot"}.` }
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
      return { ...base, access: "monday", detail: `No status: a sponsor's invitation (about ${Math.round(sponsorChance(world) * 100)}% for your client) or a Monday qualifier (${MONDAY_SPOTS} spots).` };
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
  const course = asSetUp(world, getCourse(QSCHOOL_COURSE));
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
