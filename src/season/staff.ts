import { clamp, createRng, type Rng } from "../engine";
import { COACH_GROUPS, INTENSITY, developWeek, impliedStaff } from "./development";
import type { Coach, CoachRole, Injury, World, WorldPlayer } from "./types";

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

/** Weekly fee: a star coach costs many times a journeyman. */
export const coachFee = (quality: number): number => Math.round((500 + quality * quality * 25) / 100) * 100;

/** The market of coaches for hire: five per role, from journeymen to gurus. */
export function generateCoaches(seed: number): Coach[] {
  const rng = createRng(seed ^ 0xc0ac4);
  const used = new Set<string>();
  const coaches: Coach[] = [];
  for (const role of COACH_ROLES) {
    for (const q of [6, 9, 12, 15, 18]) {
      let name = "";
      do name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
      while (used.has(name));
      used.add(name);
      const quality = clamp(q + rng.int(-1, 1), 1, 20);
      coaches.push({ id: `c${coaches.length + 1}`, name, role, quality, weeklyFee: coachFee(quality) });
    }
  }
  return coaches;
}

export function staffQuality(world: World): Partial<Record<CoachRole, number>> {
  const out: Partial<Record<CoachRole, number>> = {};
  for (const role of COACH_ROLES) {
    const c = world.coaches.find((x) => x.id === world.staff[role]);
    if (c) out[role] = c.quality;
  }
  return out;
}

export function hireCoach(world: World, coachId: string): void {
  const c = world.coaches.find((x) => x.id === coachId);
  if (!c) throw new Error(`unknown coach ${coachId}`);
  world.staff[c.role] = c.id;
  world.news.unshift(`${world.players[world.clientId]!.player.name} hires ${c.name} as his ${ROLE_LABELS[c.role].toLowerCase()}.`);
}

export function releaseCoach(world: World, role: CoachRole): void {
  const c = world.coaches.find((x) => x.id === world.staff[role]);
  delete world.staff[role];
  if (c) world.news.unshift(`${c.name} is no longer ${world.players[world.clientId]!.player.name}'s ${ROLE_LABELS[role].toLowerCase()}.`);
}

export const weeklyStaffCost = (world: World): number =>
  COACH_ROLES.reduce((s, r) => s + (world.coaches.find((c) => c.id === world.staff[r])?.weeklyFee ?? 0), 0);

// ---------------------------------------------------------------- swing rebuild

export const REBUILD_WEEKS = 16;
/** Strokes a round lost at the start of a rebuild; it eases as the new move beds in. */
export const REBUILD_PENALTY = 0.9;

export function canStartRebuild(world: World): { ok: boolean; reason?: string } {
  const wp = world.players[world.clientId]!;
  if (wp.rebuild) return { ok: false, reason: "A rebuild is already under way." };
  if (!world.staff.swing) return { ok: false, reason: "Hire a swing coach first." };
  return { ok: true };
}

export function startRebuild(world: World): void {
  const check = canStartRebuild(world);
  if (!check.ok) throw new Error(check.reason);
  const wp = world.players[world.clientId]!;
  wp.rebuild = { weeksLeft: REBUILD_WEEKS, totalWeeks: REBUILD_WEEKS };
  applyRebuildPenalty(wp);
  world.news.unshift(`${wp.player.name} begins a swing rebuild. Expect some rough weeks.`);
}

export function abandonRebuild(world: World): void {
  const wp = world.players[world.clientId]!;
  wp.rebuild = null;
  delete wp.player.sgAdjust;
  world.news.unshift(`${wp.player.name} abandons his swing rebuild and goes back to the old move.`);
}

function applyRebuildPenalty(wp: WorldPlayer): void {
  if (!wp.rebuild) return;
  const left = wp.rebuild.weeksLeft / wp.rebuild.totalWeeks;
  const pen = REBUILD_PENALTY * left;
  wp.player.sgAdjust = { offTheTee: -pen * 0.4, approach: -pen * 0.6 };
}

/** Chance the new swing takes: better coaches and more coachable players succeed more. */
export function rebuildSuccessChance(swingCoachQuality: number, coachability: number): number {
  return clamp(0.35 + swingCoachQuality * 0.02 + coachability * 0.01, 0.2, 0.95);
}

function progressRebuild(world: World, wp: WorldPlayer, rng: Rng): void {
  if (!wp.rebuild) return;
  wp.rebuild.weeksLeft--;
  if (wp.rebuild.weeksLeft > 0) return applyRebuildPenalty(wp);
  wp.rebuild = null;
  delete wp.player.sgAdjust;
  const coachQ = world.coaches.find((c) => c.id === world.staff.swing)?.quality ?? 4;
  if (rng.chance(rebuildSuccessChance(coachQ, wp.player.attributes.coachability))) {
    wp.development.potential = Math.min(19, wp.development.potential + 1);
    const pool = [...COACH_GROUPS.swing];
    for (let i = 0; i < 3; i++) {
      const k = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
      wp.player.attributes[k] = Math.min(20, wp.player.attributes[k] + 1);
    }
    world.news.unshift(`${wp.player.name}'s swing rebuild is complete, and it's worked: his ball-striking is better than ever.`);
  } else {
    world.news.unshift(`${wp.player.name}'s swing rebuild is complete, but the new move hasn't made him any better.`);
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
  const base = competed ? 0.004 : 0.001;
  const prone = wp.player.attributes.injuryProneness / 10;
  const tired = wp.player.condition < 60 ? 2 : 1;
  const fit = clamp(1 - (fitnessQuality - 4) / 40, 0.6, 1.1);
  return base * prone * tired * intensityRisk * fit;
}

function rollInjury(world: World, wp: WorldPlayer, rng: Rng): Injury {
  const [name, lo, hi] = rng.pick(INJURIES);
  const injury = { name, weeksLeft: rng.int(lo, hi) };
  if (injury.weeksLeft >= 8 && rng.chance(0.4)) {
    const k = rng.pick(["drivingDistance", "flexibility"] as const);
    wp.player.attributes[k] = Math.max(1, wp.player.attributes[k] - 1);
  }
  if (wp.player.id === world.clientId) {
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
export function endOfWeek(world: World, competed: Set<string>, rng: Rng): void {
  const clientQuality = staffQuality(world);
  for (const wp of Object.values(world.players)) {
    const isClient = wp.player.id === world.clientId;
    const plan = isClient ? world.training : { focus: "balanced" as const, intensity: "normal" as const };
    const quality = isClient ? clientQuality : impliedStaff(wp);
    const played = competed.has(wp.player.id);

    if (wp.injury) {
      wp.injury.weeksLeft--;
      if (wp.injury.weeksLeft <= 0) {
        wp.injury = null;
        if (isClient) world.news.unshift(`${wp.player.name} is fit again.`);
      }
    } else if (rng.chance(injuryChance(wp, played, INTENSITY[plan.intensity].injury, quality.fitness ?? 4))) {
      wp.injury = rollInjury(world, wp, rng);
    }

    const changes = developWeek(wp, { plan, coachQuality: quality, competed: played }, rng);
    if (isClient) {
      wp.player.condition = clamp(wp.player.condition + INTENSITY[plan.intensity].condition, 0, 100);
      for (const c of changes) {
        world.news.unshift(`${wp.player.name}'s ${labelOf(c.key)} ${c.delta > 0 ? "improves" : "drops"} to ${wp.player.attributes[c.key]}.`);
      }
      progressRebuild(world, wp, rng);
    }
  }
  const fees = weeklyStaffCost(world);
  world.finances.coaching += fees;
}

function labelOf(key: string): string {
  return key.replace(/([A-Z])/g, " $1").toLowerCase();
}

export const OFFSEASON_WEEKS = 10;

/** The winter break: injuries heal and everyone trains, with no events, fees or new injuries. */
export function offseason(world: World, weeks: number, rng: Rng): void {
  const clientQuality = staffQuality(world);
  for (let w = 0; w < weeks; w++) {
    for (const wp of Object.values(world.players)) {
      const isClient = wp.player.id === world.clientId;
      if (wp.injury && --wp.injury.weeksLeft <= 0) wp.injury = null;
      developWeek(
        wp,
        { plan: isClient ? world.training : { focus: "balanced", intensity: "normal" }, coachQuality: isClient ? clientQuality : impliedStaff(wp), competed: false },
        rng,
      );
      if (isClient) progressRebuild(world, wp, rng);
    }
  }
}
