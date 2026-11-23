/**
 * The medical staff: a physio and a nutritionist, hired per client next to his
 * coaches and paid from his winnings the same way. The fitness trainer keeps
 * injury prevention and ageing; the physio owns injuries once they happen
 * (shorter lay-offs, safer comebacks, playing through a minor knock) and the
 * nutritionist owns condition (faster recovery on rest weeks, less jet lag,
 * a little less late-round fatigue). Computer players don't hire either.
 */
import { clamp, createRng } from "../engine";
import type { Medic, MedicRole, World, WorldPlayer } from "./types";

export const MEDIC_ROLES: MedicRole[] = ["physio", "nutritionist"];

export const MEDIC_LABELS: Record<MedicRole, string> = {
  physio: "Physio",
  nutritionist: "Nutritionist",
};

export const MEDIC_BLURBS: Record<MedicRole, string> = {
  physio: "Injuries heal faster, rushing back is safer, and he can play through a minor knock.",
  nutritionist: "He recovers faster in rest weeks, travel tires him less, and he fades less late on the weekend.",
};

/** How many of each are on the market. */
export const MEDICS_PER_ROLE = 8;

const FIRST = ["Anna", "Ben", "Clare", "Dev", "Erin", "Felix", "Grace", "Hal", "Iris", "Jon", "Kate", "Leo", "Mara", "Noel", "Olga", "Raj", "Sian", "Theo", "Uma", "Will"];
const LAST = ["Achebe", "Barrow", "Collins", "Drummond", "Ellery", "Foster", "Grady", "Huxley", "Ingram", "Joyce", "Kerr", "Lowe", "Madden", "Nolan", "Pike", "Reyes", "Sutter", "Toms", "Vance", "Wilde"];

/** Weekly retainer: about $40k a season for the least of them, about $250k for the best. */
export const medicFee = (quality: number): number => Math.round((800 + 0.65 * quality ** 3) / 100) * 100;

/** The market: eight physios and eight nutritionists, from a club physio to a tour's best. */
export function generateMedics(seed: number): Medic[] {
  const rng = createRng(seed ^ 0x3ed1c);
  const used = new Set<string>();
  const medics: Medic[] = [];
  for (const role of MEDIC_ROLES) {
    for (let tier = 0; tier < MEDICS_PER_ROLE; tier++) {
      let name = "";
      do name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
      while (used.has(name));
      used.add(name);
      const quality = clamp(5 + Math.round((tier / (MEDICS_PER_ROLE - 1)) * 15) + rng.int(-1, 1), 1, 20);
      medics.push({ id: `${role === "physio" ? "ph" : "nu"}${tier + 1}`, name, role, quality, weeklyFee: medicFee(quality) });
    }
  }
  return medics;
}

/** Older saves: the market opens on load, priced by today's fee curve. */
export function ensureMedics(world: World): void {
  const generated = generateMedics(world.seed);
  world.medics ??= [];
  const ids = new Set(world.medics.map((m) => m.id));
  world.medics.push(...generated.filter((m) => !ids.has(m.id)));
  for (const m of world.medics) m.weeklyFee = medicFee(m.quality);
}

/** His physio or nutritionist, if he has one. */
export function medicOf(world: World, wp: WorldPlayer | undefined, role: MedicRole): Medic | undefined {
  const id = wp?.client?.medical?.[role];
  return id ? world.medics?.find((m) => m.id === id) : undefined;
}

function mgmt(world: World, clientId: string) {
  const wp = world.players[clientId];
  if (!wp?.client) throw new Error(`${clientId} is not your client`);
  return { wp, c: wp.client };
}

export function hireMedic(world: World, clientId: string, medicId: string): void {
  const { wp, c } = mgmt(world, clientId);
  const m = world.medics?.find((x) => x.id === medicId);
  if (!m) throw new Error(`unknown medic ${medicId}`);
  (c.medical ??= {})[m.role] = m.id;
  world.news.unshift(`${wp.player.name} hires ${m.name} as his ${MEDIC_LABELS[m.role].toLowerCase()}.`);
}

export function releaseMedic(world: World, clientId: string, role: MedicRole): void {
  const { wp, c } = mgmt(world, clientId);
  const m = medicOf(world, wp, role);
  if (c.medical) delete c.medical[role];
  if (m) world.news.unshift(`${m.name} is no longer ${wp.player.name}'s ${MEDIC_LABELS[role].toLowerCase()}.`);
}

/** The medics' weekly retainers for one client. */
export function weeklyMedicalCost(world: World, clientId: string, feeMult: (m: Medic) => number = () => 1): number {
  const wp = world.players[clientId];
  return MEDIC_ROLES.reduce((s, r) => {
    const m = medicOf(world, wp, r);
    return s + (m ? Math.round(m.weeklyFee * feeMult(m)) : 0);
  }, 0);
}

/** 0 for the weakest (quality 1) to 1 for the best (20). */
const scale = (q: number): number => clamp((q - 1) / 19, 0, 1);

// ---------------------------------------------------------------- physio

/** Share a physio takes off a new injury's length: 15% to 35% by quality. */
export const physioCut = (quality: number): number => 0.15 + 0.2 * scale(quality);

/** A new injury's length after his physio's work (at least a week). */
export function physioWeeks(world: World, wp: WorldPlayer, weeks: number): number {
  const p = medicOf(world, wp, "physio");
  return p ? Math.max(1, Math.round(weeks * (1 - physioCut(p.quality)))) : weeks;
}

/** Chance a rushed comeback flares up: a physio halves it. */
export const rushBackRisk = (world: World, wp: WorldPlayer, base: number): number => (medicOf(world, wp, "physio") ? base / 2 : base);

/** A minor knock: an injury of three weeks or less. */
export const MINOR_KNOCK_WEEKS = 3;
/** Strokes a round he loses playing through a managed knock. */
export const KNOCK_STROKES = 0.15;

/** Whether his physio can clear him to play through this injury. */
export function canManageKnock(world: World, wp: WorldPlayer): boolean {
  return !!wp.client && !!wp.injury && (wp.injury.totalWeeks ?? wp.injury.weeksLeft) <= MINOR_KNOCK_WEEKS && !!medicOf(world, wp, "physio");
}

/** The physio clears him to play through a minor knock: no longer injured, a little worse until it clears. */
export function manageKnock(world: World, clientId: string): void {
  const { wp } = mgmt(world, clientId);
  if (!canManageKnock(world, wp)) throw new Error(`${wp.player.name}'s injury can't be managed`);
  const physio = medicOf(world, wp, "physio")!;
  wp.knock = { name: wp.injury!.name, weeksLeft: wp.injury!.weeksLeft };
  wp.injury = null;
  world.news.unshift(`${physio.name} clears ${wp.player.name} to play through his ${wp.knock.name.toLowerCase()}.`);
}

/** A week passes: a managed knock clears in the time the injury would have taken. */
export function knockWeek(wp: WorldPlayer): void {
  if (!wp.knock) return;
  if (--wp.knock.weeksLeft <= 0) delete wp.knock;
}

// ---------------------------------------------------------------- nutritionist

/** Multiplier on a rest week's recovery: 1.10 to 1.20 by quality. */
export function restRecoveryBoost(world: World, wp: WorldPlayer): number {
  const n = medicOf(world, wp, "nutritionist");
  return n ? 1.1 + 0.1 * scale(n.quality) : 1;
}

/** Share of the jet lag (and the condition a long trip costs) a nutritionist takes away. */
export const JET_LAG_RELIEF = 0.25;
export const jetLagRelief = (world: World, wp: WorldPlayer): number => (medicOf(world, wp, "nutritionist") ? JET_LAG_RELIEF : 0);

/** Share of the late-round fatigue a nutritionist takes away: 30% to 50% by quality. */
export function lateFatigueRelief(world: World, wp: WorldPlayer): number {
  const n = medicOf(world, wp, "nutritionist");
  return n ? 0.3 + 0.2 * scale(n.quality) : 0;
}

/** What the golf needs to know about his medical staff this week. */
export function medicalContext(world: World, wp: WorldPlayer): { knock?: number; lateFatigueRelief?: number; jetLagRelief?: number } {
  const out: { knock?: number; lateFatigueRelief?: number; jetLagRelief?: number } = {};
  if (wp.knock) out.knock = KNOCK_STROKES;
  const late = lateFatigueRelief(world, wp);
  if (late) out.lateFatigueRelief = late;
  const jet = jetLagRelief(world, wp);
  if (jet) out.jetLagRelief = jet;
  return out;
}
