/**
 * Promises: what you tell a player to get him to sign or stay. Each one makes
 * a yes more likely, and is checked automatically. Kept, it builds his trust
 * in you; broken, it costs a lot of trust and his mood, and your other
 * clients hear about it. Trust (0-100, 60 to start) feeds his extension
 * talks, his mood and how easily a rival can turn his head.
 */
import { bump } from "./achievements";
import { clamp } from "../engine";
import { staffQuality } from "./staff";
import { absWeek, type CoachRole, type World, type WorldPlayer } from "./types";
import { nextRyderCupSeason, ryderCupWeek, yearOf } from "./ryderCup";
import { hasSkill } from "./staffSkills";

export type PromiseKind = "camp" | "noOpposite" | "majors" | "eliteCoach" | "maxEvents" | "ryderCup";

export interface ClientPromise {
  id: string;
  kind: PromiseKind;
  /** The season it covers (the Ryder Cup promise: the Ryder Cup season). */
  season: number;
  madeAt: number;
  status: "open" | "kept" | "broken";
  /** Elite coach: which role. */
  role?: CoachRole;
  /** Max events: the cap. */
  limit?: number;
}

export const MAX_PROMISES = 2;
export const START_TRUST = 60;
/** How long you have to hire the elite coach you promised. */
export const COACH_GRACE_WEEKS = 4;
export const ELITE_COACH = 15;
export const EVENT_CAP = 22;

export interface PromiseDef {
  kind: PromiseKind;
  label: string;
  detail: string;
  /** Added to his willingness to sign (the acceptance score). */
  appeal: (wp: WorldPlayer, rank: number) => number;
}

export const PROMISES: PromiseDef[] = [
  { kind: "camp", label: "A skills camp this winter", detail: "Checked at the season's end: his winter must be a skills camp.", appeal: (wp) => (wp.player.age <= 27 ? 6 : 3) },
  { kind: "noOpposite", label: "No opposite-field events", detail: "Broken the moment he plays one this season.", appeal: (_wp, rank) => (rank <= 100 ? 5 : 1) },
  { kind: "majors", label: "Every major he's invited to", detail: "Broken if he's invited to a major, fit, and doesn't play.", appeal: (wp) => 3 + Math.max(0, wp.player.attributes.ambition - 12) },
  { kind: "eliteCoach", label: `An elite swing coach (${ELITE_COACH}+)`, detail: `Hire one within ${COACH_GRACE_WEEKS} weeks and keep him all season.`, appeal: () => 6 },
  { kind: "maxEvents", label: `No more than ${EVENT_CAP} events`, detail: "Broken if he plays more this season.", appeal: (wp) => (wp.player.age >= 32 ? 5 : 2) },
  { kind: "ryderCup", label: "Make the next Ryder Cup team", detail: "Kept if he's in the twelve; broken if he isn't.", appeal: (_wp, rank) => (rank <= 40 ? 7 : rank <= 100 ? 3 : 0) },
];
export const PROMISE_BY_KIND = new Map(PROMISES.map((p) => [p.kind, p]));

/** What a set of promises adds to his willingness to sign. */
export function promiseAppeal(wp: WorldPlayer, rank: number, kinds: readonly PromiseKind[] = []): number {
  return kinds.slice(0, MAX_PROMISES).reduce((t, k) => t + (PROMISE_BY_KIND.get(k)?.appeal(wp, rank) ?? 0), 0);
}

/** The season a promise made now covers: this one, or the next if this one is well under way. */
const coveredSeason = (world: World) => (world.week > 20 ? world.season + 1 : world.season);

export function makePromises(world: World, wp: WorldPlayer, kinds: readonly PromiseKind[] = []): void {
  const m = wp.client;
  if (!m || !kinds.length) return;
  const list = (m.promises ??= []);
  const now = absWeek(world.season, world.week);
  for (const kind of kinds.slice(0, MAX_PROMISES)) {
    const season = kind === "ryderCup" ? nextRyderCupSeason(world.season) : kind === "camp" ? world.season : coveredSeason(world);
    list.push({
      id: `${kind}-${now}-${list.length}`,
      kind,
      season,
      madeAt: now,
      status: "open",
      ...(kind === "eliteCoach" ? { role: "swing" as CoachRole } : {}),
      ...(kind === "maxEvents" ? { limit: EVENT_CAP } : {}),
    });
  }
}

export const trustOf = (wp: WorldPlayer): number => wp.client?.trust ?? START_TRUST;

function settle(world: World, wp: WorldPlayer, p: ClientPromise, kept: boolean, why: string): void {
  const m = wp.client!;
  p.status = kept ? "kept" : "broken";
  const label = PROMISE_BY_KIND.get(p.kind)!.label.toLowerCase();
  if (kept) {
    m.trust = clamp(trustOf(wp) + 8, 0, 100);
    m.happiness = clamp(m.happiness + 4, 0, 100);
    world.news.unshift(`Promise kept: ${label}, for ${wp.player.name}. His trust in you grows.`);
    bump(world, "promisesKept");
    return;
  }
  m.trust = clamp(trustOf(wp) - (hasSkill(world, "promise-keeper") ? 10 : 20), 0, 100);
  m.happiness = clamp(m.happiness - 10, 0, 100);
  world.news.unshift(`Promise broken: ${label}, for ${wp.player.name} (${why}). He won't forget it.`);
  // Word gets round the stable.
  for (const id of world.clientIds) {
    const o = world.players[id];
    if (o?.client && id !== wp.player.id) o.client.trust = clamp(trustOf(o) - 3, 0, 100);
  }
}

const open = (wp: WorldPlayer) => (wp.client?.promises ?? []).filter((p) => p.status === "open");

/**
 * The week's checks, after its events: an opposite-field start, a major he
 * skipped, too many events, or no elite coach after the grace period.
 * `played` is the tier of each client's event this week (null: he didn't
 * play); `invitedMajor` is the clients invited to this week's major.
 */
export function weeklyPromiseChecks(world: World, played: Map<string, string | null>, invitedMajor: Set<string>): void {
  const now = absWeek(world.season, world.week);
  for (const id of world.clientIds) {
    const wp = world.players[id];
    if (!wp?.client) continue;
    for (const p of open(wp)) {
      const tier = played.get(id) ?? null;
      if (p.kind === "eliteCoach") {
        if (now - p.madeAt >= COACH_GRACE_WEEKS && (staffQuality(world, id)[p.role ?? "swing"] ?? 0) < ELITE_COACH) settle(world, wp, p, false, "no elite coach");
        continue;
      }
      if (p.season !== world.season) continue;
      if (p.kind === "noOpposite" && tier === "opposite") settle(world, wp, p, false, "he played an opposite-field event");
      else if (p.kind === "majors" && invitedMajor.has(id) && tier !== "major" && !wp.injury) settle(world, wp, p, false, "he skipped a major");
      else if (p.kind === "maxEvents" && wp.career.seasonEvents > (p.limit ?? EVENT_CAP)) settle(world, wp, p, false, `he played more than ${p.limit ?? EVENT_CAP} events`);
    }
  }
}

/** The Ryder Cup week: in the team or not. */
export function ryderCupPromiseChecks(world: World, team: Set<string>): void {
  if (world.week !== ryderCupWeek(world)) return;
  for (const id of world.clientIds) {
    const wp = world.players[id];
    if (!wp?.client) continue;
    for (const p of open(wp)) {
      if (p.kind === "ryderCup" && p.season === world.season) settle(world, wp, p, team.has(id), `he missed the ${yearOf(world.season)} team`);
    }
  }
}

/** Season's end, before the winter: the camp is checked, and what's still open for the season is kept. */
export function seasonEndPromiseChecks(world: World): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    if (!wp?.client) continue;
    for (const p of open(wp)) {
      if (p.kind === "camp" && p.season <= world.season) settle(world, wp, p, wp.client.training.winter === "camp", "his winter wasn't a skills camp");
      else if (p.kind === "ryderCup") {
        // A Ryder Cup season with no Cup played (the week passed while he was elsewhere) counts as missed.
        if (p.season === world.season) settle(world, wp, p, false, `he missed the ${yearOf(world.season)} team`);
      } else if (p.season === world.season) settle(world, wp, p, true, "");
    }
    // A short memory: the last ten promises.
    if (wp.client.promises && wp.client.promises.length > 10) wp.client.promises.splice(0, wp.client.promises.length - 10);
  }
}

/** For the screens: a promise's state right now. */
export function promiseState(world: World, wp: WorldPlayer, p: ClientPromise): { word: string; tone: "good" | "warn" | "bad" | "neutral" } {
  if (p.status === "kept") return { word: "Kept", tone: "good" };
  if (p.status === "broken") return { word: "Broken", tone: "bad" };
  if (p.kind === "camp") return wp.client?.training.winter === "camp" ? { word: "On track", tone: "good" } : { word: "At risk: set his winter to a skills camp", tone: "warn" };
  if (p.kind === "eliteCoach") {
    const q = staffQuality(world, wp.player.id)[p.role ?? "swing"] ?? 0;
    return q >= ELITE_COACH ? { word: "On track", tone: "good" } : { word: `At risk: hire a ${ELITE_COACH}+ swing coach`, tone: "warn" };
  }
  if (p.season > world.season) return { word: `From season ${p.season}`, tone: "neutral" };
  if (p.kind === "maxEvents") {
    const n = wp.career.seasonEvents;
    const cap = p.limit ?? EVENT_CAP;
    return n >= cap - 2 ? { word: `At risk: ${n} of ${cap} events`, tone: "warn" } : { word: `${n} of ${cap} events`, tone: "neutral" };
  }
  return { word: "On track", tone: "good" };
}
