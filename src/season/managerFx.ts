/**
 * What a development director's skills change: how well he reads a coach's
 * quality, what the coach costs him, when he swaps one out, how many he hires
 * a week and which he won't touch. Pure data and maths, so the weekly bill
 * (staff.ts) and the hiring (managers.ts) can both use it without a cycle.
 */
import { createRng } from "../engine";
import { mixSeed } from "./entries";
import type { Coach, CoachRole, Manager, World } from "./types";

export type ManagerEffect =
  /** Scales how far his read of a coach can drift from the truth (for one role, or all). */
  | { kind: "eye"; role?: CoachRole; mult: number }
  /** Scales the coach's fee (his own deals; "formerOnly" for coaches who were clients of yours). */
  | { kind: "fee"; mult: number; formerOnly?: boolean }
  /** How many points a coach must read better by before he swaps the one he has. */
  | { kind: "margin"; value: number }
  /** A bias on his read, for coaches within a quality band. */
  | { kind: "bias"; min?: number; max?: number; add: number }
  /** He won't hire anyone rated above this. */
  | { kind: "budget"; maxQuality: number }
  /** Fills at most this many vacancies a week, in this order. */
  | { kind: "pace"; perWeek: number; roles: CoachRole[] };

export interface ManagerSkill {
  label: string;
  blurb: string;
  fx: ManagerEffect[];
}

const ROLE_FIRST: CoachRole[] = ["swing", "shortGame", "putting", "mental", "fitness"];

/** Twenty things a director can be good at. A director carries one to three (more for the better ones). */
export const MANAGER_SKILLS: Record<string, ManagerSkill> = {
  "good-eye": { label: "Good eye", blurb: "Reads every coach a little more truly.", fx: [{ kind: "eye", mult: 0.7 }] },
  "swing-eye": { label: "Swing eye", blurb: "Sees a swing coach's quality clearly.", fx: [{ kind: "eye", role: "swing", mult: 0.5 }] },
  "short-game-eye": { label: "Short-game eye", blurb: "Sees a short-game coach's quality clearly.", fx: [{ kind: "eye", role: "shortGame", mult: 0.5 }] },
  "putting-eye": { label: "Putting eye", blurb: "Sees a putting coach's quality clearly.", fx: [{ kind: "eye", role: "putting", mult: 0.5 }] },
  "mind-reader": { label: "Mind reader", blurb: "Sees a mental coach's quality clearly.", fx: [{ kind: "eye", role: "mental", mult: 0.5 }] },
  "body-reader": { label: "Body reader", blurb: "Sees a fitness trainer's quality clearly.", fx: [{ kind: "eye", role: "fitness", mult: 0.5 }] },
  "data-driven": { label: "Data-driven", blurb: "Leans on the numbers: reads every coach about 20% more accurately.", fx: [{ kind: "eye", mult: 0.8 }] },
  "scout-network": { label: "Scout network", blurb: "Has seen more coaches work: reads them about 15% better.", fx: [{ kind: "eye", mult: 0.85 }] },
  haggler: { label: "Haggler", blurb: "Coaches' fees come down 10% for his clients.", fx: [{ kind: "fee", mult: 0.9 }] },
  "tough-negotiator": { label: "Tough negotiator", blurb: "Coaches' fees come down 15% for his clients.", fx: [{ kind: "fee", mult: 0.85 }] },
  "old-friends": { label: "Old friends", blurb: "Former clients coaching for you take a quarter less again.", fx: [{ kind: "fee", mult: 0.75, formerOnly: true }] },
  "contract-savvy": { label: "Contract savvy", blurb: "Coach retainers 5% lower.", fx: [{ kind: "fee", mult: 0.95 }] },
  patient: { label: "Patient", blurb: "Swaps a coach only for a clear step up of 4 points or more.", fx: [{ kind: "margin", value: 4 }] },
  "go-getter": { label: "Go-getter", blurb: "Swaps up for any step up of 2 points.", fx: [{ kind: "margin", value: 2 }] },
  "steady-hand": { label: "Steady hand", blurb: "Never swaps a coach once hired.", fx: [{ kind: "margin", value: 99 }] },
  "hidden-gem": { label: "Hidden-gem hunter", blurb: "Rates the lesser-known coaches (up to 8 out of 20) a point higher.", fx: [{ kind: "bias", max: 8, add: 1 }] },
  "name-brand": { label: "Name-brand", blurb: "Rates the big names (15 and up) a point higher.", fx: [{ kind: "bias", min: 15, add: 1 }] },
  "budget-keeper": { label: "Budget keeper", blurb: "Won't hire anyone rated above 15 out of 20.", fx: [{ kind: "budget", maxQuality: 15 }] },
  "rebuild-first": { label: "Rebuild first", blurb: "Fills one vacancy a week, swing, short game and putting first.", fx: [{ kind: "pace", perWeek: 1, roles: [...ROLE_FIRST] }] },
  "conditioning-first": { label: "Conditioning first", blurb: "Fills one vacancy a week, fitness and mental first.", fx: [{ kind: "pace", perWeek: 1, roles: ["fitness", "mental", "swing", "shortGame", "putting"] }] },
};

const fxOf = (m: Manager): ManagerEffect[] => m.skills.flatMap((s) => MANAGER_SKILLS[s]?.fx ?? []);

/** A stable number for an id, so each director misreads each coach the same way every week. */
export const idHash = (id: string): number => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

/** How far his read of a coach can drift: a sharp eye (a high-rated director) is near the truth. */
export function readNoise(m: Manager, c: Coach): number {
  let sd = 5.5 - 0.25 * m.quality;
  for (const f of fxOf(m)) if (f.kind === "eye" && (!f.role || f.role === c.role)) sd *= f.mult;
  return sd;
}

/** The quality he thinks he's hiring: the truth, his fixed misread of that coach, and his biases. */
export function perceivedQuality(world: World, m: Manager, c: Coach): number {
  let bias = 0;
  for (const f of fxOf(m)) {
    if (f.kind === "bias" && (f.min === undefined || c.quality >= f.min) && (f.max === undefined || c.quality <= f.max)) bias += f.add;
  }
  const misread = createRng(mixSeed(world.seed, idHash(m.id), idHash(c.id))).normal(0, readNoise(m, c));
  return c.quality + bias + misread;
}

/** What he pays for this coach as a share of the list fee (his haggling, and old friends). */
export function feeMultiplier(m: Manager, c: Coach): number {
  let mult = 1;
  for (const f of fxOf(m)) if (f.kind === "fee" && (!f.formerOnly || c.formerClient)) mult *= f.mult;
  return mult;
}

/** The points a coach must read better by before he swaps the one he has (the smallest of his skills). */
export function swapMargin(m: Manager): number {
  const values = fxOf(m).flatMap((f) => (f.kind === "margin" ? [f.value] : []));
  return values.length ? Math.min(...values) : 3;
}

/** The highest-rated coach he'll hire (20 if he has no budget rule). */
export function maxQualityOf(m: Manager): number {
  const caps = fxOf(m).flatMap((f) => (f.kind === "budget" ? [f.maxQuality] : []));
  return caps.length ? Math.min(...caps) : 20;
}

/** How many hires he makes a week, and the order he fills the roles in (no limit unless he has a pace skill). */
export function paceOf(m: Manager): { perWeek: number; roles?: CoachRole[] } {
  const p = fxOf(m).find((f): f is Extract<ManagerEffect, { kind: "pace" }> => f.kind === "pace");
  return p ? { perWeek: p.perWeek, roles: p.roles } : { perWeek: Infinity };
}
