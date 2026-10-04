import { stafferQuality } from "./market";
const analystQuality = (world: World) => stafferQuality(world, "analyst");
import { masteryWeek } from "./mastery";
import { rivalCoaching } from "./rivals";
import { centerTier } from "./business";
import { chargeDevelopment } from "./finance";
import { clamp, createRng, type Rng } from "../engine";
import { COACH_GROUPS, INTENSITY, developWeek, overall, potentialEstimate } from "./development";
import { mixSeed } from "./entries";
import { has, injuryLength, injuryRisk, returnFromInjury } from "./traits";
import type { Coach, CoachRole, Injury, RebuildArea, World, WorldPlayer } from "./types";
import type { AttributeKey } from "../engine";
import { burnoutInjury, fatigueWeek } from "./progression";

export const COACH_ROLES: CoachRole[] = ["swing", "shortGame", "putting", "mental", "fitness"];

export const ROLE_LABELS: Record<CoachRole, string> = {
  swing: "Swing coach",
  shortGame: "Short-game coach",
  putting: "Putting coach",
  mental: "Mental coach",
  fitness: "Fitness trainer",
};

const FIRST = ["Hank", "Butch", "Pete", "Claude", "Sean", "Mike", "Dave", "Jim", "Rick", "Phil", "Pia", "Lynn", "Gary", "Denis", "Tom", "Marius", "Josh", "Cameron", "Bernie", "Adam", "Chris", "Stan", "Jorge", "Ian", "Nick"];
const LAST = ["Harlan", "Whitcombe", "Garrity", "Lindell", "Pryce", "Osgood", "Tanaka", "Moreau", "Kessler", "Brandt", "Ashby", "Fenwick", "Quill", "Rourke", "Stirling", "Varga", "Weller", "Yates", "Castell", "Dobbs"];

/** Weekly retainer: about $74k a season for a tour-average coach (12), $330k for the best (20). */
export const coachFee = (quality: number): number => Math.round((100 + quality ** 3) / 100) * 100;

/** The market of coaches for hire: 25 per role, from local teachers to tour gurus. */
export function generateCoaches(seed: number): Coach[] {
  const rng = createRng(seed ^ 0xc0ac4);
  const used = new Set<string>();
  const coaches: Coach[] = [];
  for (const role of COACH_ROLES) {
    for (let tier = 0; tier < 25; tier++) {
      let name = "";
      do name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
      while (used.has(name));
      used.add(name);
      const quality = clamp(3 + Math.round((tier / 24) * 16) + rng.int(-1, 1), 1, 20);
      coaches.push({ id: `c${coaches.length + 1}`, name, role, quality, weeklyFee: coachFee(quality) });
    }
  }
  return coaches;
}

function mgmt(world: World, clientId: string) {
  const wp = world.players[clientId];
  if (!wp?.client) throw new Error(`${clientId} is not your client`);
  return { wp, c: wp.client };
}

export function staffQuality(world: World, clientId: string): Partial<Record<CoachRole, number>> {
  const { c: m } = mgmt(world, clientId);
  const out: Partial<Record<CoachRole, number>> = {};
  for (const role of COACH_ROLES) {
    const c = world.coaches.find((x) => x.id === m.staff[role]);
    if (c) out[role] = c.quality;
  }
  return out;
}

export function hireCoach(world: World, clientId: string, coachId: string): void {
  const { wp, c: m } = mgmt(world, clientId);
  const c = world.coaches.find((x) => x.id === coachId);
  if (!c) throw new Error(`unknown coach ${coachId}`);
  m.staff[c.role] = c.id;
  world.news.unshift(`${wp.player.name} hires ${c.name} as his ${ROLE_LABELS[c.role].toLowerCase()}.`);
}

export function releaseCoach(world: World, clientId: string, role: CoachRole): void {
  const { wp, c: m } = mgmt(world, clientId);
  const c = world.coaches.find((x) => x.id === m.staff[role]);
  delete m.staff[role];
  if (c) world.news.unshift(`${c.name} is no longer ${wp.player.name}'s ${ROLE_LABELS[role].toLowerCase()}.`);
}

export const weeklyStaffCost = (world: World, clientId: string): number => {
  const m = world.players[clientId]?.client;
  if (!m) return 0;
  return COACH_ROLES.reduce((s, r) => s + (world.coaches.find((c) => c.id === m.staff[r])?.weeklyFee ?? 0), 0);
};

// ---------------------------------------------------------------- swing rebuild

export const REBUILD_WEEKS = 16;
/** Strokes a round lost at the start of a rebuild; it eases as the new move beds in. */
export const REBUILD_PENALTY = 0.9;

/** What each kind of rebuild takes and gives: its length, the coach it needs, the strokes it costs at first and where. */
export const REBUILDS: Record<RebuildArea, { label: string; weeks: number; coach: CoachRole; penalty: number; sg: Partial<Record<"offTheTee" | "approach" | "aroundTheGreen" | "putting", number>>; skills: readonly AttributeKey[]; blurb: string }> = {
  swing: { label: "Swing rebuild", weeks: REBUILD_WEEKS, coach: "swing", penalty: REBUILD_PENALTY, sg: { offTheTee: 0.4, approach: 0.6 }, skills: COACH_GROUPS.swing, blurb: "His long game and approach" },
  shortGame: { label: "Short-game overhaul", weeks: 10, coach: "shortGame", penalty: 0.5, sg: { aroundTheGreen: 1 }, skills: COACH_GROUPS.shortGame, blurb: "His chipping, pitching and bunker play" },
  putting: { label: "New putting stroke", weeks: 8, coach: "putting", penalty: 0.6, sg: { putting: 1 }, skills: COACH_GROUPS.putting, blurb: "His putting" },
};

export function canStartRebuild(world: World, clientId: string, area: RebuildArea = "swing"): { ok: boolean; reason?: string } {
  const { wp, c } = mgmt(world, clientId);
  if (wp.rebuild) return { ok: false, reason: "A rebuild is already under way." };
  const coach = REBUILDS[area].coach;
  if (!c.staff[coach]) return { ok: false, reason: `Hire a ${coach === "shortGame" ? "short-game" : coach} coach first.` };
  return { ok: true };
}

export function startRebuild(world: World, clientId: string, area: RebuildArea = "swing"): void {
  const check = canStartRebuild(world, clientId, area);
  if (!check.ok) throw new Error(check.reason);
  const wp = world.players[clientId]!;
  const r = REBUILDS[area];
  wp.rebuild = { weeksLeft: r.weeks, totalWeeks: r.weeks, area };
  applyRebuildPenalty(wp);
  world.news.unshift(`${wp.player.name} begins a ${r.label.toLowerCase()}. Expect some rough weeks.`);
}

/** A rebuild the player starts on his own (a Swing Tinkerer), coach or no coach. */
export function beginRebuild(wp: WorldPlayer): void {
  wp.rebuild = { weeksLeft: REBUILD_WEEKS, totalWeeks: REBUILD_WEEKS };
  applyRebuildPenalty(wp);
}

export function abandonRebuild(world: World, clientId: string): void {
  const { wp } = mgmt(world, clientId);
  wp.rebuild = null;
  delete wp.player.sgAdjust;
  world.news.unshift(`${wp.player.name} abandons the change and goes back to what he knew.`);
}

function applyRebuildPenalty(wp: WorldPlayer): void {
  if (!wp.rebuild) return;
  const r = REBUILDS[wp.rebuild.area ?? "swing"];
  const left = wp.rebuild.weeksLeft / wp.rebuild.totalWeeks;
  const pen = r.penalty * left;
  const adjust: Partial<Record<"offTheTee" | "approach" | "aroundTheGreen" | "putting", number>> = {};
  for (const [k, share] of Object.entries(r.sg)) adjust[k as keyof typeof adjust] = -pen * share!;
  wp.player.sgAdjust = adjust;
}

/** Chance the new swing takes: better coaches and more coachable players succeed more. */
export function rebuildSuccessChance(swingCoachQuality: number, coachability: number): number {
  return clamp(0.35 + swingCoachQuality * 0.02 + coachability * 0.01, 0.2, 0.95);
}

function progressRebuild(world: World, wp: WorldPlayer, rng: Rng): void {
  if (!wp.rebuild) return;
  wp.rebuild.weeksLeft--;
  if (wp.rebuild.weeksLeft > 0) return applyRebuildPenalty(wp);
  const done = wp.rebuild.area;
  wp.rebuild = null;
  delete wp.player.sgAdjust;
  const area = REBUILDS[done ?? "swing"];
  const coachQ = world.coaches.find((c) => c.id === wp.client?.staff[area.coach])?.quality ?? 4;
  if (rng.chance(rebuildSuccessChance(coachQ, wp.player.attributes.coachability))) {
    // The whole swing lifts the ceiling most; a short game or putting change, less.
    wp.development.potential = Math.min(19, wp.development.potential + (done === "swing" || !done ? 1 : 0.5));
    const pool = [...area.skills];
    for (let i = 0; i < Math.min(3, pool.length); i++) {
      const k = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
      wp.player.attributes[k] = Math.min(20, wp.player.attributes[k] + 1);
    }
    world.news.unshift(`${wp.player.name}'s ${area.label.toLowerCase()} is complete, and it's worked: ${area.blurb.toLowerCase()} is better than ever.`);
  } else {
    world.news.unshift(`${wp.player.name}'s ${area.label.toLowerCase()} is complete, but it hasn't made him any better.`);
  }
}

// ---------------------------------------------------------------- injuries

const INJURIES: [string, number, number][] = [
  ["Neck stiffness", 1, 2],
  ["Back spasm", 1, 4],
  ["Wrist strain", 2, 6],
  ["Knee sprain", 3, 6],
  ["Shoulder tendinitis", 3, 8],
  ["Torn thumb ligament", 6, 12],
  ["Rib stress fracture", 8, 14],
];

/** Weekly injury chance for a player who competed (training alone is much safer). */
export function injuryChance(wp: WorldPlayer, competed: boolean, intensityRisk: number, fitnessQuality: number): number {
  // About one start in a hundred ends in an injury (real withdrawals: 1.8% of starts, all causes).
  const base = competed ? 0.009 : 0.002;
  const prone = wp.player.attributes.injuryProneness / 10;
  const tired = wp.player.condition < 60 ? 2 : 1;
  const fit = clamp(1 - (fitnessQuality - 4) / 40, 0.6, 1.1);
  return base * prone * tired * intensityRisk * fit * injuryRisk(wp, intensityRisk > 1);
}

function rollInjury(world: World, wp: WorldPlayer, rng: Rng): Injury {
  const [name, lo, hi] = rng.pick(INJURIES);
  const weeks = injuryLength(wp, rng.int(lo, hi));
  const injury = { name, weeksLeft: weeks, totalWeeks: weeks };
  if (injury.weeksLeft >= 8 && rng.chance(0.4)) {
    const k = rng.pick(["drivingDistance", "flexibility"] as const);
    wp.player.attributes[k] = Math.max(1, wp.player.attributes[k] - 1);
  }
  if (wp.client) {
    world.news.unshift(`Injury: ${wp.player.name} has a ${name.toLowerCase()} and will miss about ${injury.weeksLeft} week${injury.weeksLeft === 1 ? "" : "s"}.`);
  }
  return injury;
}

// ---------------------------------------------------------------- the weekly tick

/**
 * Runs after each week's golf for every player: injuries heal or happen,
 * training moves attributes, swing rebuilds progress, and the client's
 * coaches get paid.
 */
export function endOfWeek(world: World, competed: Set<string>, rng: Rng, boosts: Map<string, { training: number; fitness: number; injury: number }> = new Map()): void {
  // A veteran Mentor on the books speeds up your younger clients.
  const mentor = world.clientIds.some((id) => {
    const m = world.players[id];
    return !!m && m.player.age >= 34 && has(m, "mentor");
  });
  for (const wp of Object.values(world.players)) {
    const isClient = !!wp.client;
    const plan = wp.client ? wp.client.training : { focus: "balanced" as const, intensity: "normal" as const };
    const quality = isClient ? staffQuality(world, wp.player.id) : rivalCoaching(world, wp);
    // Amateurs are playing college and amateur events most weeks.
    const played = competed.has(wp.player.id) || wp.career.status === "amateur";

    if (wp.comebackWeeks) wp.comebackWeeks--;
    if (wp.injury) {
      wp.injury.weeksLeft--;
      if (wp.injury.weeksLeft <= 0) {
        returnFromInjury(wp, wp.injury.totalWeeks ?? 0);
        wp.injury = null;
        if (isClient) world.news.unshift(`${wp.player.name} is fit again.`);
      }
    } else if (rng.chance(injuryChance(wp, played, INTENSITY[plan.intensity].injury, quality.fitness ?? 4) * (boosts.get(wp.player.id)?.injury ?? 1) * burnoutInjury(wp.client?.fatigue))) {
      wp.injury = rollInjury(world, wp, rng);
    }

    const mentored = mentor && isClient && wp.player.age < 25 && !has(wp, "mentor");
    const boost = boosts.get(wp.player.id);
    const burnout = isClient ? fatigueWeek(wp, played) : 1;
    const changes = developWeek(wp, { plan, coachQuality: quality, competed: played, mentored, managed: isClient, ...(isClient ? { facility: centerTier(world).growth, burnout } : {}), ...(boost ? { boost } : {}) }, rng);
    masteryWeek(wp, played, plan.focus);
    if (isClient) {
      wp.player.condition = clamp(wp.player.condition + INTENSITY[plan.intensity].condition, 0, 100);
      for (const c of changes) {
        world.news.unshift(`${wp.player.name}'s ${labelOf(c.key)} ${c.delta > 0 ? "improves" : "drops"} to ${wp.player.attributes[c.key]}.`);
      }
      progressRebuild(world, wp, rng);
    }
  }
  for (const id of world.clientIds) {
    const m = world.players[id]?.client;
    if (m) chargeDevelopment(world, id, weeklyStaffCost(world, id), "coaching");
  }
}

function labelOf(key: string): string {
  return key.replace(/([A-Z])/g, " $1").toLowerCase();
}

export const OFFSEASON_WEEKS = 10;

/** The winter break: injuries heal and everyone trains, with no events, fees or new injuries. */
export function offseason(world: World, weeks: number, rng: Rng): void {
  for (let w = 0; w < weeks; w++) {
    for (const wp of Object.values(world.players)) {
      if (wp.injury && --wp.injury.weeksLeft <= 0) {
        returnFromInjury(wp, wp.injury.totalWeeks ?? 0);
        wp.injury = null;
      }
      developWeek(
        wp,
        {
          plan: wp.client ? wp.client.training : { focus: "balanced", intensity: "normal" },
          coachQuality: wp.client ? staffQuality(world, wp.player.id) : rivalCoaching(world, wp),
          competed: false,
          ...(wp.client ? { managed: true, winter: wp.client.training.winter ?? "standard", facility: centerTier(world).growth } : wp.agent?.winter ? { winter: wp.agent.winter } : {}),
        },
        rng,
      );
      masteryWeek(wp, false, wp.client?.training.focus);
      if (wp.client) progressRebuild(world, wp, rng);
    }
  }
  // How the winter leaves him: a camp's hard work makes him rusty, a rest leaves him fresh.
  for (const id of world.clientIds) {
    const wp = world.players[id];
    const winter = wp?.client?.training.winter;
    if (!wp || !winter) continue;
    if (winter === "camp") wp.player.form = clamp(wp.player.form - 0.4, -1, 1);
    if (winter === "rest") {
      wp.player.form = clamp(wp.player.form + 0.3, -1, 1);
      wp.player.condition = 100;
    }
  }
}

/**
 * A client's current level and what his coaches think he can reach, both as
 * overall levels (1-20). The estimate is only as good as his best coach, and
 * holds for the season (the same one the Training tab shows as stars).
 */
export function abilityView(world: World, clientId: string): { current: number; potential: number; coachQuality: number } {
  const wp = world.players[clientId]!;
  // An agency analyst reads a ceiling as well as a coach of his quality would.
  const coachQuality = Math.max(4, analystQuality(world), ...Object.values(staffQuality(world, clientId)));
  const estimate = potentialEstimate(wp, coachQuality, createRng(mixSeed(world.seed, world.season, 77)));
  const current = overall(wp.player);
  return { current, potential: Math.max(current, estimate), coachQuality };
}
