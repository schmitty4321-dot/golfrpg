/**
 * Match play: two sides, hole by hole, the lower score wins the hole. A
 * match ends once one side leads by more holes than are left ("3&2"), is
 * won on the last ("1 up"), or is halved; a knockout match that is level
 * after 18 goes on to sudden death from the 1st.
 *
 * Every player plays his own ball through the normal hole engine (form,
 * traits, wind and all). Four-balls take the better of each side's two
 * scores; foursomes (alternate shot) are one ball played by a pair, which we
 * model as one player with the pair's average skills.
 */
import { playHole, roundForm, WEEK_SD, type HoleState, type RoundContext } from "./round";
import type { Rng } from "./rng";
import type { AttributeKey, Attributes } from "./attributes";
import type { Course, Player, RoundWeather } from "./types";
import { drawWeather } from "./weather";

export type MatchFormat = "singles" | "fourball" | "foursomes";

export interface MatchResult {
  format: MatchFormat;
  /** Player ids on each side. */
  a: string[];
  b: string[];
  /** The side that won, or null for a halved match. */
  winner: "a" | "b" | null;
  /** "3&2", "1 up", "Halved", "20th hole". */
  margin: string;
  /** Each side's score on every hole played, in order (extra holes included). */
  holes: { a: number; b: number }[];
}

/** A pair playing one ball: their average skills, under both names. */
export function foursomesPlayer(x: Player, y: Player): Player {
  const attributes = Object.fromEntries(
    (Object.keys(x.attributes) as AttributeKey[]).map((k) => [k, Math.round((x.attributes[k] + y.attributes[k]) / 2)]),
  ) as Attributes;
  return {
    ...x,
    id: `${x.id}+${y.id}`,
    name: `${x.name} / ${y.name}`,
    attributes,
    form: (x.form + y.form) / 2,
    condition: (x.condition + y.condition) / 2,
    traits: [],
    sgAdjust: undefined,
    archetype: undefined,
    equipment: undefined,
  };
}

export interface MatchInput {
  course: Course;
  a: Player[];
  b: Player[];
  format: MatchFormat;
  rng: Rng;
  /** Drawn for the match when absent. */
  weather?: RoundWeather;
  /** Knockout: play on from the 1st until someone wins a hole. */
  extraHoles?: boolean;
  /** A playoff: sudden death from the 1st, no 18 holes first. */
  suddenDeath?: boolean;
  /** This week's form per player id (drawn when absent). */
  weekForm?: Map<string, number>;
  tier?: string;
  /** Day of the event, 1-4, for the round-level habits. */
  day?: number;
}

/** One golfer (or foursomes pair) ready to play holes. */
interface Ball {
  ctx: RoundContext;
  dayForm: ReturnType<typeof roundForm>;
  state: HoleState;
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${s}`;
}

export function playMatch(input: MatchInput): MatchResult {
  const { course, rng, format } = input;
  const weather = input.weather ?? drawWeather(course, rng);
  const teeShotHoles = course.holes.filter((h) => h.par > 3).length;
  const balls = (side: Player[]): Ball[] => {
    const players = format === "foursomes" && side.length >= 2 ? [foursomesPlayer(side[0]!, side[1]!)] : format === "fourball" ? side.slice(0, 2) : side.slice(0, 1);
    return players.map((player) => {
      const weekForm = input.weekForm?.get(player.id) ?? rng.normal(0, WEEK_SD);
      const ctx: RoundContext = { player, course, weather, wave: "AM", round: input.day ?? 1, shotsBehind: null, weekForm, rng, ...(input.tier ? { tier: input.tier } : {}) };
      return { ctx, dayForm: roundForm(ctx), state: { lastOverPar: 0 } };
    });
  };
  const A = balls(input.a);
  const B = balls(input.b);
  const score = (side: Ball[], holeIdx: number, extra: boolean) => {
    const hole = course.holes[holeIdx % course.holes.length]!;
    return Math.min(...side.map((x) => playHole({ ctx: extra ? { ...x.ctx, playoff: true } : x.ctx, hole, dayForm: x.dayForm, teeShotHoles, state: x.state })));
  };
  const done = (winner: "a" | "b" | null, margin: string): MatchResult => ({ format, a: input.a.map((p) => p.id), b: input.b.map((p) => p.id), winner, margin, holes });

  const holes: { a: number; b: number }[] = [];
  const total = course.holes.length;
  let lead = 0; // positive: side a is up
  for (let i = 0; i < (input.suddenDeath ? 0 : total); i++) {
    const a = score(A, i, false);
    const b = score(B, i, false);
    holes.push({ a, b });
    lead += a < b ? 1 : a > b ? -1 : 0;
    const left = total - i - 1;
    if (Math.abs(lead) > left) return done(lead > 0 ? "a" : "b", left === 0 ? `${Math.abs(lead)} up` : `${Math.abs(lead)}&${left}`);
  }
  if (lead === 0 && !input.extraHoles && !input.suddenDeath) return done(null, "Halved");
  const first = input.suddenDeath ? 0 : total;
  // Sudden death from the 1st (capped at 18 more holes, then a coin toss: it never comes to that).
  for (let k = 0; k < total; k++) {
    const a = score(A, k, true);
    const b = score(B, k, true);
    holes.push({ a, b });
    if (a !== b) return done(a < b ? "a" : "b", `${ordinal(first + k + 1)} hole`);
  }
  return done(rng.chance(0.5) ? "a" : "b", `${ordinal(first + total)} hole`);
}

/** Holes won by each side in a match (for tiebreaks and summaries). */
export function holesWon(m: MatchResult): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const h of m.holes) {
    if (h.a < h.b) a++;
    else if (h.b < h.a) b++;
  }
  return { a, b };
}

/** A group of the round-robin stage: three matches each, a point for a win and a half for a half. */
export interface MatchPlayGroup {
  players: string[];
  matches: MatchResult[];
  /** Best first: points, then holes won minus holes lost. */
  standings: { id: string; points: number; holeDiff: number }[];
  /** A sudden-death playoff when players tied for first. */
  playoff: MatchResult[];
}

export interface BracketRound {
  name: string;
  /** A match with a single side (`b` empty) is a bye. */
  matches: MatchResult[];
}

/** A match-play event from the draw to the final, for the bracket screen. */
export interface MatchPlayBracket {
  /** World ranking at the draw, by player id. */
  seeds: Record<string, number>;
  groups: MatchPlayGroup[];
  knockout: BracketRound[];
  /** Third place: the beaten semi-finalists. */
  consolation: MatchResult | null;
}
