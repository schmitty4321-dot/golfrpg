import {
  COURSES,
  clamp,
  createRng,
  expectedStrokesGained,
  generatePlayer,
  totalSg,
  type Player,
  type PlayerTier,
  type Rng,
} from "../engine";
import { SEASON_WEEKS, buildTour } from "./calendar";
import { newDevelopment, overall } from "./development";
import { generateCoaches, offseason, OFFSEASON_WEEKS } from "./staff";
import { courseFit, courseById, eventsInWeek, isInvitational, mixSeed, planWeek, priorityCompare, MONDAY_SPOTS } from "./entries";
import { pointsList, rankMap } from "./points";
import type { Course } from "../engine";
import { SAVE_VERSION, absWeek, type Career, type SeasonSummary, type TourEvent, type TourStatus, type World, type WorldPlayer } from "./types";
import { playWeek } from "./week";

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
  ["college", 40],
];
const TARGET_POOL_SIZE = POOL.reduce((s, [, n]) => s + n, 0);
/** Card thresholds on the season points list. */
export const FULL_CARD = 125;
export const CONDITIONAL_CARD = 150;
const GRADUATES = 30;

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
});

export const emptyFinances = () => ({ prizeMoney: 0, caddie: 0, travel: 0, coaching: 0, commission: 0 });

export function makeWorldPlayer(p: Player, status: TourStatus, rng: Rng): WorldPlayer {
  return { player: p, career: newCareer(status), targetEvents: 26, development: newDevelopment(p, rng), injury: null, rebuild: null };
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
  commissionRate?: number;
}

/**
 * Builds a golf world: a pool of about 260 pros, a tour calendar, and one
 * warm-up season played silently so world rankings, points and cards
 * exist before you arrive. Then your first client joins.
 */
export function createWorld(opts: CreateWorldOptions): World {
  const rng = createRng(opts.seed);
  const { courses, schedule } = buildTour(opts.seed);
  const usedNames = new Set<string>();
  const players: Player[] = [];
  for (const [tier, n] of POOL) for (let i = 0; i < n; i++) players.push(generatePlayer(rng, { tier, usedNames }));
  prefixIds(players, "w");

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
    clientId: "",
    commissionRate: opts.commissionRate ?? 0.1,
    finances: emptyFinances(),
    agencyBank: 0,
    pastSeasons: [],
    news: [],
    coaches: generateCoaches(opts.seed),
    staff: {},
    training: { focus: "balanced", intensity: "normal" },
  };

  setTargets(world);
  while (world.week <= SEASON_WEEKS) playWeek(world);
  finishSeason(world, rng);
  world.pastSeasons = [];
  world.news = [];

  const client = createClient(rng, opts.scenario, usedNames);
  world.players[client.player.id] = client;
  world.clientId = client.player.id;
  setTargets(world);
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
  const rankOf = new Map(order.map((id, i) => [id, i + 1]));
  const owgr = rankMap(world);
  const client = world.clientId ? world.players[world.clientId] : undefined;
  const clientBefore = client?.career.status;

  for (const wp of Object.values(world.players)) {
    const c = wp.career;
    const r = rankOf.get(wp.player.id) ?? null;
    if (c.seasonWins > 0) c.exemptThrough = Math.max(c.exemptThrough ?? 0, season + 2);
    const exemptByWin = (c.exemptThrough ?? -1) >= season + 1;
    if ((r !== null && r <= FULL_CARD) || exemptByWin) c.status = "exempt";
    else if (r !== null && r <= CONDITIONAL_CARD) c.status = "conditional";
    else c.status = "none";
    c.priorPointsRank = r;
  }

  // Developmental tour graduates: the best of the players without status, plus new faces.
  const hopefuls = Object.values(world.players)
    .filter((wp) => wp.career.status === "none" && wp.player.id !== world.clientId)
    .map((wp) => ({ wp, score: quality(wp.player) + rng.normal(0, 0.6) }))
    .sort((a, b) => b.score - a.score);
  const fromPool = Math.min(20, hopefuls.length);
  for (const { wp } of hopefuls.slice(0, fromPool)) wp.career.status = "graduate";
  const usedNames = new Set(Object.values(world.players).map((wp) => wp.player.name));
  let n = Object.keys(world.players).length;
  const addPlayer = (tier: PlayerTier, status: TourStatus) => {
    const p = generatePlayer(rng, { tier, usedNames });
    p.id = `s${season}n${++n}`;
    world.players[p.id] = makeWorldPlayer(p, status, rng);
  };
  for (let i = fromPool; i < GRADUATES; i++) addPlayer("fringe", "graduate");

  // Retirements: players without status drift away, and the old guard hangs it up.
  for (const wp of Object.values(world.players)) {
    if (wp.player.id === world.clientId) continue;
    const age = wp.player.age;
    const retire =
      age >= 50 ||
      (wp.career.status === "none" && (age >= 42 || rng.chance(0.2))) ||
      (age >= 46 && (wp.career.exemptThrough ?? 0) <= season && rng.chance(0.3));
    if (retire) {
      if (wp.career.careerWins > 0) world.news.unshift(`${wp.player.name} retires at ${age}, with ${wp.career.careerWins} career win${wp.career.careerWins === 1 ? "" : "s"}.`);
      delete world.players[wp.player.id];
    }
  }
  while (Object.keys(world.players).length < TARGET_POOL_SIZE) addPlayer(rng.chance(0.5) ? "college" : "fringe", "none");

  const summary = client && clientBefore ? summarise(world, client, clientBefore, rankOf.get(client.player.id) ?? null, owgr.get(client.player.id) ?? 999) : null;
  if (summary) world.pastSeasons.push(summary);

  for (const wp of Object.values(world.players)) {
    const c = wp.career;
    c.seasonPoints = 0;
    c.seasonEarnings = 0;
    c.seasonEvents = 0;
    c.seasonWins = 0;
    c.lastRegion = null;
    wp.player.age++;
    wp.player.condition = Math.max(wp.player.condition, 90);
    wp.player.form *= 0.5;
  }
  // The winter: ten weeks of practice with no events, then a new season's baseline.
  offseason(world, OFFSEASON_WEEKS, rng);
  for (const wp of Object.values(world.players)) wp.development.seasonStart = { ...wp.player.attributes };
  pruneHistory(world);
  world.season++;
  world.week = 1;
  world.finances = emptyFinances();
  setTargets(world);
  return summary;
}

function summarise(world: World, client: WorldPlayer, statusBefore: TourStatus, pointsRank: number | null, owgrRank: number): SeasonSummary {
  const season = world.season;
  const results = client.career.results.filter((r) => r.season === season);
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
  return {
    season,
    pointsLeaders: leaders,
    majors,
    client: {
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
      finances: { ...world.finances },
    },
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
}

/** The client's options for this week, with a projection of whether they'd get in. */
export function clientOptions(world: World): EntryOption[] {
  const client = world.players[world.clientId]!;
  return eventsInWeek(world).map((event) => {
    const course = courseById(world, event.courseId);
    const fit = Math.round(courseFit(client, course) * 100) / 100;
    const base = { event, course, fit };
    if (client.injury) {
      return { ...base, access: "injured" as const, detail: `Injured (${client.injury.name.toLowerCase()}), out for about ${client.injury.weeksLeft} more week${client.injury.weeksLeft === 1 ? "" : "s"}.` };
    }
    const plan = planWeek(world, { eventId: event.id, route: "entry" });
    if (isInvitational(event.tier)) {
      const invited = plan.invited.get(event.id)!.has(world.clientId);
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
    const pos = direct.findIndex((wp) => wp.player.id === world.clientId) + 1;
    const spots = event.fieldSize - MONDAY_SPOTS;
    return pos <= spots
      ? { ...base, access: "in", detail: `In on status (priority ${pos} of ${spots} spots).` }
      : { ...base, access: "alternate", detail: `Alternate (priority ${pos}, ${spots} spots): would go to the Monday qualifier.` };
  });
}

function inviteRule(e: TourEvent): string {
  if (e.tier === "major") return "top 80 in the world, recent winners, last season's top 50";
  if (e.tier === "signature") return "top 50 on the points list, this or last season, or a winner this season";
  return "top 30 on the points list";
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
    if (wp.player.id !== world.clientId) wp.career.results = wp.career.results.filter((r) => r.season >= world.season - 1);
  }
}
