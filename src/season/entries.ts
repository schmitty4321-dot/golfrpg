import {
  COURSES,
  clamp,
  createRng,
  drawWeather,
  expectedStrokesGained,
  simulateRound,
  totalSg,
  type Course,
  type Rng,
} from "../engine";
import { LAST_REGULAR_WEEK } from "./calendar";
import { pointsList, rankMap } from "./points";
import type { EventTier, TourEvent, TourStatus, World, WorldPlayer } from "./types";

/** Spots kept back in regular events for Monday qualifiers. */
export const MONDAY_SPOTS = 4;
/** Most players who try a Monday qualifier in one week. */
const MONDAY_POOL_MAX = 80;

const STATUS_ORDER: Record<TourStatus, number> = { exempt: 0, graduate: 1, conditional: 2, none: 3, amateur: 4 };
const TIER_ORDER: Record<EventTier, number> = { major: 0, finale: 0, signature: 1, standard: 2, opposite: 3, dev: 4 };

/** Fields for these tiers are by invitation or qualification, not by status. */
export const isInvitational = (tier: EventTier): boolean => tier === "major" || tier === "signature" || tier === "finale";

/** Deterministic seed from several numbers, so each week replays identically. */
export function mixSeed(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

export function courseById(world: World, id: string): Course {
  const c = world.courses.find((x) => x.id === id);
  if (!c) throw new Error(`unknown course ${id}`);
  return c;
}

/** This week's events, the main event first. */
export function eventsInWeek(world: World, week = world.week): TourEvent[] {
  return world.schedule.filter((e) => e.week === week).sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}

/** Standings used to decide who gets into what this week. */
export interface WeekContext {
  owgrRank: Map<string, number>;
  pointsRank: Map<string, number>;
  /** Winners this season or last: they are exempt and get into majors. */
  recentWinners: Set<string>;
}

export function weekContext(world: World): WeekContext {
  const pointsRank = new Map(pointsList(world).map((id, i) => [id, i + 1]));
  const recentWinners = new Set<string>();
  for (const wp of Object.values(world.players)) {
    if (wp.career.results.some((r) => r.position === 1 && r.season >= world.season - 1)) recentWinners.add(wp.player.id);
  }
  return { owgrRank: rankMap(world), pointsRank, recentWinners };
}

/** The ordered list of players invited to a major, signature event or finale. */
export function invitedField(world: World, ctx: WeekContext, event: TourEvent): string[] {
  // Injured players withdraw, and the next in line takes the spot.
  const all = Object.values(world.players).filter((wp) => !wp.injury || !!wp.client);
  const owgr = (id: string) => ctx.owgrRank.get(id) ?? 9999;
  const pts = (id: string) => ctx.pointsRank.get(id) ?? 9999;
  const ids = all.map((wp) => wp.player.id);

  if (event.tier === "finale") {
    return ids.filter((id) => pts(id) <= event.fieldSize).sort((a, b) => pts(a) - pts(b));
  }
  if (event.tier === "signature") {
    const thisSeasonWins = (wp: WorldPlayer) => wp.career.seasonWins > 0;
    const eligible = all.filter(
      (wp) =>
        (wp.career.priorPointsRank !== null && wp.career.priorPointsRank <= 50) ||
        (world.week > 1 && pts(wp.player.id) <= 50) ||
        thisSeasonWins(wp),
    );
    return eligible
      .sort((a, b) => b.career.seasonPoints - a.career.seasonPoints || owgr(a.player.id) - owgr(b.player.id))
      .slice(0, event.fieldSize)
      .map((wp) => wp.player.id);
  }
  // Major: top 80 in the world, recent winners, last season's top 50 and the amateur champion,
  // then fill by world ranking. Other amateurs aren't invited.
  const amateurChamp = world.history.seasons.find((s) => s.season === world.season - 1)?.amateurChampion?.playerId;
  const pros = ids.filter((id) => world.players[id]!.career.status !== "amateur" || id === amateurChamp);
  const guaranteed = pros.filter(
    (id) =>
      owgr(id) <= 80 ||
      ctx.recentWinners.has(id) ||
      id === amateurChamp ||
      (world.players[id]!.career.priorPointsRank ?? 999) <= 50,
  );
  const set = new Set(guaranteed.sort((a, b) => owgr(a) - owgr(b)).slice(0, event.fieldSize));
  for (const id of [...pros].sort((a, b) => owgr(a) - owgr(b))) {
    if (set.size >= event.fieldSize) break;
    set.add(id);
  }
  return [...set];
}

/** Priority order for a regular event: status category, then this season's points. */
export function priorityCompare(a: WorldPlayer, b: WorldPlayer): number {
  return (
    STATUS_ORDER[a.career.status] - STATUS_ORDER[b.career.status] ||
    b.career.seasonPoints - a.career.seasonPoints ||
    (a.career.priorPointsRank ?? 999) - (b.career.priorPointsRank ?? 999) ||
    a.player.id.localeCompare(b.player.id)
  );
}

/** The developmental tour is for professionals without a main-tour card. */
export const canPlayDev = (wp: WorldPlayer): boolean => wp.career.status === "none" || wp.career.status === "conditional";

/** Developmental tour priority: its own points list, then last season's main-tour finish. */
export function devPriority(a: WorldPlayer, b: WorldPlayer): number {
  return (
    b.career.devPoints - a.career.devPoints ||
    (a.career.priorPointsRank ?? 999) - (b.career.priorPointsRank ?? 999) ||
    a.player.id.localeCompare(b.player.id)
  );
}

/** How well a player's game suits a course, compared with the reference venues. */
export function courseFit(wp: WorldPlayer, course: Course): number {
  const here = totalSg(expectedStrokesGained(wp.player, course));
  const avg = COURSES.reduce((s, c) => s + totalSg(expectedStrokesGained(wp.player, c)), 0) / COURSES.length;
  return here - avg;
}

export type AiChoice = { eventId: string; route: "entry" | "monday" } | null;

/**
 * What a computer-controlled player does this week: always play majors and
 * signature events they're in, spread their other starts over the season,
 * favour courses that suit them, rest when worn out, and chase starts late
 * in the season when their card is at risk.
 */
export function aiChoice(world: World, ctx: WeekContext, wp: WorldPlayer, events: TourEvent[], invited: Map<string, Set<string>>, rng: Rng): AiChoice {
  const id = wp.player.id;
  const main = events[0];
  if (!main || wp.injury) return null;
  const opposite = events.find((e) => e.tier === "opposite");
  const dev = events.find((e) => e.tier === "dev");
  const c = wp.career;

  // Amateurs play college golf; they're only seen at a major they're invited to.
  if (c.status === "amateur") return main.tier === "major" && invited.get(main.id)?.has(id) ? { eventId: main.id, route: "entry" } : null;
  // Players without a card live on the developmental tour, with the odd Monday qualifier.
  if (c.status === "none" && dev && !(invited.get(main.id)?.has(id))) {
    if (wp.player.condition >= 60 && rng.chance(0.8)) return { eventId: dev.id, route: "entry" };
  }

  if (isInvitational(main.tier)) {
    if (invited.get(main.id)?.has(id)) {
      if (main.tier === "signature" && wp.player.condition < 55 && rng.chance(0.5)) return null;
      return { eventId: main.id, route: "entry" };
    }
    if (!opposite) return null;
    if (c.status === "none") return rng.chance(0.4) ? { eventId: opposite.id, route: "monday" } : null;
    return wp.player.condition >= 60 && rng.chance(0.85) ? { eventId: opposite.id, route: "entry" } : null;
  }

  if (c.status === "none") return rng.chance(0.3) ? { eventId: main.id, route: "monday" } : null;

  const weeksLeft = Math.max(1, LAST_REGULAR_WEEK - world.week + 1);
  const remaining = wp.targetEvents - c.seasonEvents;
  let p = clamp(remaining / weeksLeft, 0.05, 0.95);
  if (c.status === "conditional") p = 0.9;
  const pr = ctx.pointsRank.get(id) ?? 999;
  if (world.week >= 24 && pr > 100 && pr <= 160) p = 0.95; // fighting for a card
  if ((ctx.owgrRank.get(id) ?? 999) <= 15) p *= 0.6;
  p *= clamp(1 + courseFit(wp, courseById(world, main.courseId)) * 0.5, 0.6, 1.4);
  if (main.region !== "NA") p *= 0.6;
  if (wp.player.condition < 65) p *= 0.3;
  return rng.chance(clamp(p, 0, 0.98)) ? { eventId: main.id, route: "entry" } : null;
}

export interface WeekPlan {
  events: TourEvent[];
  invited: Map<string, Set<string>>;
  /** Everyone's choices, including the client's. */
  choices: Map<string, AiChoice>;
}

/** Everyone's choices for the week; your clients' choices are supplied (or "auto"). */
export function planWeek(world: World, clientChoices: Map<string, AiChoice | "auto">): WeekPlan {
  const ctx = weekContext(world);
  const events = eventsInWeek(world);
  const invited = new Map<string, Set<string>>();
  for (const e of events) if (isInvitational(e.tier)) invited.set(e.id, new Set(invitedField(world, ctx, e)));

  const rng = createRng(mixSeed(world.seed, world.season, world.week, 1));
  const choices = new Map<string, AiChoice>();
  for (const wp of Object.values(world.players).sort((a, b) => a.player.id.localeCompare(b.player.id))) {
    const ai = aiChoice(world, ctx, wp, events, invited, rng);
    const mine = clientChoices.get(wp.player.id);
    const own = mine !== undefined && mine !== "auto" && !wp.injury;
    choices.set(wp.player.id, own ? mine : ai);
  }
  return { events, invited, choices };
}

export interface FieldResult {
  event: TourEvent;
  field: string[];
  /** Direct entrants who didn't get in on status. */
  alternates: string[];
  mondayQualifiers: string[];
  /** Everyone who played the Monday qualifier. */
  mondayPool: string[];
}

/** Builds each event's field from the week's choices, running Monday qualifiers. */
export function buildFields(world: World, plan: WeekPlan): FieldResult[] {
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 2));
  return plan.events.map((event) => {
    const entrants = [...plan.choices.entries()].filter(([, c]) => c?.eventId === event.id);
    if (isInvitational(event.tier)) {
      const inv = plan.invited.get(event.id)!;
      const field = entrants.map(([id]) => id).filter((id) => inv.has(id));
      return { event, field, alternates: [], mondayQualifiers: [], mondayPool: [] };
    }
    if (event.tier === "dev") {
      const eligible = entrants.map(([id]) => world.players[id]!).filter((wp) => canPlayDev(wp)).sort(devPriority);
      return {
        event,
        field: eligible.slice(0, event.fieldSize).map((wp) => wp.player.id),
        alternates: eligible.slice(event.fieldSize).map((wp) => wp.player.id),
        mondayQualifiers: [],
        mondayPool: [],
      };
    }

    const direct = entrants
      .filter(([id, c]) => c!.route === "entry" && world.players[id]!.career.status !== "none")
      .map(([id]) => world.players[id]!)
      .sort(priorityCompare)
      .map((wp) => wp.player.id);
    const spots = event.fieldSize - MONDAY_SPOTS;
    const field = direct.slice(0, spots);
    const alternates = direct.slice(spots);
    const mondayEntrants = entrants.filter(([id, c]) => c!.route === "monday" || world.players[id]!.career.status === "none").map(([id]) => id);

    // Alternates who missed out try Monday too; the client is always kept in the pool.
    let pool = [...new Set([...mondayEntrants, ...alternates])];
    if (pool.length > MONDAY_POOL_MAX) {
      const keep = pool.filter((id) => world.clientIds.includes(id));
      const others = shuffle(pool.filter((id) => !world.clientIds.includes(id)), rng);
      pool = [...keep, ...others.slice(0, MONDAY_POOL_MAX - keep.length)];
    }
    const open = event.fieldSize - field.length;
    const mondayQualifiers = mondayQualifier(world, event, pool, Math.min(open, MONDAY_SPOTS), rng);
    // Any spots still open go down the priority list (alternates, then past members by last season's rank).
    const fill = pool
      .filter((id) => !mondayQualifiers.includes(id))
      .map((id) => world.players[id]!)
      .sort(priorityCompare)
      .slice(0, open - mondayQualifiers.length)
      .map((wp) => wp.player.id);
    return { event, field: [...field, ...mondayQualifiers, ...fill], alternates, mondayQualifiers, mondayPool: pool };
  });
}

/** One round; the lowest scores take the open spots (ties broken at random). */
function mondayQualifier(world: World, event: TourEvent, pool: string[], spots: number, rng: Rng): string[] {
  if (pool.length === 0 || spots <= 0) return [];
  const course = courseById(world, event.courseId);
  const weather = drawWeather(course, rng);
  const scores = pool.map((id) => {
    const r = simulateRound({ player: world.players[id]!.player, course, weather, wave: "AM", round: 1, shotsBehind: null, rng });
    return { id, score: r.strokes + rng.next() * 0.1 };
  });
  return scores.sort((a, b) => a.score - b.score).slice(0, spots).map((s) => s.id);
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
