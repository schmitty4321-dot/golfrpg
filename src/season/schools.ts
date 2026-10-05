/**
 * Where amateurs play their golf: the best Americans at the top college
 * programs, the rest across the country; many internationals cross the
 * Atlantic for college too. Players of 16 and 17 (and some 18s) are still in
 * high school, with a home state. Fixed the first time it's asked for, from
 * who the player is, so it never moves around.
 */
import { createRng } from "../engine";
import { mixSeed } from "./entries";
import type { World, WorldPlayer } from "./types";

export type School = { kind: "college"; name: string; rank: number | null; state?: string } | { kind: "high"; state: string } | { kind: "national" };

/** The top 25 men's college golf programs in the coaches' poll, best first. */
export const TOP_PROGRAMS = [
  "Auburn", "Oklahoma State", "Arizona State", "Illinois", "Texas Tech", "Florida", "Tennessee", "Texas",
  "Georgia Tech", "Vanderbilt", "Alabama", "Georgia", "Arkansas", "North Carolina", "New Mexico", "Notre Dame",
  "LSU", "Oklahoma", "East Tennessee State", "Stanford", "Pepperdine", "Texas A&M", "UCLA", "BYU", "Ohio State",
] as const;

/** Programs receiving votes, or just dropped out of the top 25. */
export const OTHER_PROGRAMS = [
  "Ole Miss", "Kansas", "Virginia", "Duke", "Toledo", "Florida State", "Charlotte", "Santa Clara", "Purdue", "Washington",
  "Arizona", "Wake Forest", "Loyola Marymount", "Colorado", "TCU", "Iowa", "USC", "South Carolina", "Liberty", "Memphis",
  "Cincinnati", "Mississippi State", "New Mexico State", "UNCG", "Northwestern", "Augusta", "Michigan State", "Georgia Southern",
] as const;

/** Home states of high-school players, weighted towards the golf hotbeds. */
const STATES: [string, number][] = [
  ["Texas", 14], ["Florida", 14], ["California", 13], ["Georgia", 7], ["Arizona", 6], ["North Carolina", 6], ["South Carolina", 4],
  ["Ohio", 4], ["Illinois", 4], ["Alabama", 3], ["Tennessee", 3], ["Oklahoma", 3], ["Virginia", 3], ["Nevada", 2], ["Colorado", 2],
  ["Washington", 2], ["Michigan", 2], ["New York", 2], ["Pennsylvania", 2], ["Utah", 2], ["Louisiana", 2], ["Mississippi", 1], ["Hawaii", 1],
];

function pickState(r: () => number): string {
  const total = STATES.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [state, w] of STATES) if ((x -= w) < 0) return state;
  return "Texas";
}

/** A program for an amateur of this ceiling: the best go to the best. */
function pickProgram(potential: number, r: () => number): { name: string; rank: number | null } {
  const top = (n: number) => {
    const i = Math.floor(r() * n);
    return { name: TOP_PROGRAMS[i]!, rank: i + 1 };
  };
  if (potential >= 14.5) return top(8);
  if (potential >= 13) return top(TOP_PROGRAMS.length);
  if (potential >= 12.3 && r() < 0.5) return top(TOP_PROGRAMS.length);
  return { name: OTHER_PROGRAMS[Math.floor(r() * OTHER_PROGRAMS.length)]!, rank: null };
}

/** Where an amateur plays (nothing for a pro). */
export function schoolOf(world: World, wp: WorldPlayer): School | undefined {
  if (wp.career.status !== "amateur") return undefined;
  // A high-school senior moves on to college at 19 (taking his home state with him).
  if (wp.school && !(wp.school.kind === "high" && wp.player.age >= 19)) return wp.school;
  let h = 0;
  for (const ch of wp.player.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = createRng(mixSeed(world.seed, h, 4401));
  const r = () => rng.next();
  const american = wp.player.nationality === "USA";
  const age = wp.player.age;
  // 16s and 17s are in high school, and a good share of 18s.
  if (age <= 17 || (age === 18 && r() < 0.4)) wp.school = american ? { kind: "high", state: pickState(r) } : { kind: "national" };
  // Most internationals of college age play in the US too.
  else if (american || r() < 0.6) {
    const home = wp.school?.kind === "high" ? wp.school.state : american ? pickState(r) : undefined;
    wp.school = { kind: "college", ...pickProgram(wp.development.potential, r), ...(home ? { state: home } : {}) };
  }
  else wp.school = { kind: "national" };
  return wp.school;
}

/** The year in college, by age. */
const classYear = (age: number) => (age <= 18 ? "Freshman" : age === 19 ? "Freshman" : age === 20 ? "Sophomore" : age === 21 ? "Junior" : "Senior");

/** For the screen: "Stanford (No. 11) · Junior", "High school · Florida", "National team". */
export function schoolLabel(world: World, wp: WorldPlayer): string | null {
  const s = schoolOf(world, wp);
  if (!s) return null;
  if (s.kind === "college") return `${s.name}${s.rank ? ` (No. ${s.rank})` : ""} · ${classYear(wp.player.age)}`;
  if (s.kind === "high") return `High school · ${s.state}`;
  return "National amateur team";
}
