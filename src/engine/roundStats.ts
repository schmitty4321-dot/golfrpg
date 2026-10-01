/**
 * Round statistics in the style of the tour's stats pages, counted from the
 * shot-by-shot reconstructions (the same ones the shot tracer replays), so
 * stats, replays and scores always agree.
 */
import { seedPart, seedPrefix, sideOf, traceHole, traceSeed, type HoleTrace } from "./tracer";
import type { PlayerEventResult, TournamentResult } from "./tournament";

export interface RoundStats {
  holes: number;
  strokes: number;
  toPar: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublesOrWorse: number;
  /** Tee shots with a driver on par 4s and 5s. */
  drives: number;
  driveYards: number;
  fairwayAttempts: number;
  fairwaysHit: number;
  missLeft: number;
  missRight: number;
  gir: number;
  approachesFromFairway: number;
  girFromFairway: number;
  approachesFromRough: number;
  girFromRough: number;
  /** Feet from the hole after approaches that found the green. */
  proximityFeet: number;
  proximityCount: number;
  goForItAttempts: number;
  goForItSuccesses: number;
  scrambleAttempts: number;
  scrambles: number;
  sandAttempts: number;
  sandSaves: number;
  putts: number;
  puttsOnGir: number;
  onePutts: number;
  threePutts: number;
  firstPuttFeet: number;
  puttedHoles: number;
  madeFeet: number;
  madeCount: number;
  longestMade: number;
  penalties: number;
}

export const emptyStats = (): RoundStats => ({
  holes: 0, strokes: 0, toPar: 0, eagles: 0, birdies: 0, pars: 0, bogeys: 0, doublesOrWorse: 0,
  drives: 0, driveYards: 0, fairwayAttempts: 0, fairwaysHit: 0, missLeft: 0, missRight: 0,
  gir: 0, approachesFromFairway: 0, girFromFairway: 0, approachesFromRough: 0, girFromRough: 0,
  proximityFeet: 0, proximityCount: 0, goForItAttempts: 0, goForItSuccesses: 0,
  scrambleAttempts: 0, scrambles: 0, sandAttempts: 0, sandSaves: 0,
  putts: 0, puttsOnGir: 0, onePutts: 0, threePutts: 0, firstPuttFeet: 0, puttedHoles: 0,
  madeFeet: 0, madeCount: 0, longestMade: 0, penalties: 0,
});

const STAT_KEYS = Object.keys(emptyStats()) as (keyof RoundStats)[];

export function addStats(a: RoundStats, b: RoundStats): RoundStats {
  return addInto({ ...a }, b);
}

/** Adds b into acc in place (for totals built hole by hole) and returns acc. */
export function addInto(acc: RoundStats, b: RoundStats): RoundStats {
  for (const k of STAT_KEYS) acc[k] = k === "longestMade" ? Math.max(acc[k], b[k]) : acc[k] + b[k];
  return acc;
}

/** The seed the shot tracer uses for a hole, so both see the same shots. */
export const holeSeed = (eventName: string, playerId: string, round: number, hole: number) => traceSeed(eventName, playerId, round, hole);

/** Stats for one hole from its reconstruction, added into `s` when given (a running total). */
export function holeStats(trace: HoleTrace, par: number, s: RoundStats = emptyStats()): RoundStats {
  const shots = trace.shots;
  const L = trace.layout;
  s.holes++;
  s.strokes += trace.score;
  s.toPar += trace.score - par;
  const d = trace.score - par;
  if (d <= -2) s.eagles++;
  else if (d === -1) s.birdies++;
  else if (d === 0) s.pars++;
  else if (d === 1) s.bogeys++;
  else s.doublesOrWorse++;
  s.penalties += shots.filter((x) => x.kind === "penalty").length;

  const tee = shots[0]!;
  if (par > 3) {
    s.fairwayAttempts++;
    if (tee.lie === "fairway") s.fairwaysHit++;
    else if (tee.lie !== "holed" && tee.lie !== "green") {
      if (sideOf(L.path, tee.to) >= 0) s.missRight++;
      else s.missLeft++;
    }
    if (tee.club === "Driver") {
      s.drives++;
      s.driveYards += tee.yards;
    }
  }

  // Greens in regulation: on the green (or holed) within par minus two strokes.
  const reached = shots.findIndex((x) => x.lie === "green" || x.lie === "holed");
  const gir = reached >= 0 && shots[reached]!.stroke <= par - 2;
  if (gir) s.gir++;

  // The shot that went for the green: the last full shot before chips and putts.
  const approachIdx = shots.findIndex((x) => x.kind === "approach" || (x.kind === "tee" && par === 3));
  if (approachIdx >= 0) {
    const approach = shots[approachIdx]!;
    const fromLie = approachIdx === 0 ? "tee" : shots[approachIdx - 1]!.kind === "penalty" ? "rough" : shots[approachIdx - 1]!.lie;
    const onIt = approach.lie === "green" || approach.lie === "holed";
    if (fromLie === "fairway") {
      s.approachesFromFairway++;
      if (onIt) s.girFromFairway++;
    } else if (fromLie === "rough" || fromLie === "trees" || fromLie === "bunker") {
      s.approachesFromRough++;
      if (onIt) s.girFromRough++;
    }
    if (approach.lie === "green" && approach.feet !== undefined) {
      s.proximityFeet += approach.feet;
      s.proximityCount++;
    }
    // Going for it: a second shot at the green on a par 5.
    if (par === 5 && approach.stroke === 2) {
      s.goForItAttempts++;
      if (onIt) s.goForItSuccesses++;
    }
  }

  if (!gir) {
    s.scrambleAttempts++;
    if (trace.score <= par) s.scrambles++;
  }
  if (shots.some((x) => x.kind === "bunker")) {
    s.sandAttempts++;
    if (trace.score <= par) s.sandSaves++;
  }

  const putts = shots.filter((x) => x.kind === "putt");
  s.putts += putts.length;
  if (gir) s.puttsOnGir += putts.length;
  if (putts.length === 1) s.onePutts++;
  if (putts.length >= 3) s.threePutts++;
  if (putts.length > 0) {
    const first = shots.indexOf(putts[0]!);
    s.firstPuttFeet += shots[first - 1]?.feet ?? putts[0]!.yards * 3;
    s.puttedHoles++;
    const last = putts[putts.length - 1]!;
    const before = shots[shots.indexOf(last) - 1];
    const ft = before?.feet ?? last.yards * 3;
    s.madeFeet += ft;
    s.madeCount++;
    s.longestMade = Math.max(s.longestMade, ft);
  }
  return s;
}

/** A player's stats for one round of an event. */
export function roundStats(result: TournamentResult, row: PlayerEventResult, round: number): RoundStats {
  const card = row.holes[round];
  if (!card) return emptyStats();
  const wind = result.weather[round]?.windMph[row.waves[round] ?? "AM"] ?? 0;
  const acc = emptyStats();
  // holeSeed(result.name, id, round, i), with the shared start hashed once.
  const prefix = seedPrefix([result.name, row.player.id, round]);
  const calls = row.calls?.[round];
  for (let i = 0; i < card.length; i++) {
    const hole = result.course.holes[i]!;
    const trace = traceHole({ course: result.course, hole, score: card[i]!, player: row.player, windMph: wind, seed: seedPart(prefix, i, true), call: calls?.[i] ?? null, round });
    holeStats(trace, hole.par, acc);
  }
  return acc;
}

/** Stats for a player over rounds 1..n (0-based rounds up to and including `lastRound`). */
export function eventStats(result: TournamentResult, row: PlayerEventResult, lastRound: number): RoundStats {
  const acc = emptyStats();
  for (let r = 0; r <= lastRound && r < row.holes.length; r++) addInto(acc, roundStats(result, row, r));
  return acc;
}

/** Stats for everyone who played a round, keyed by player id. */
export function fieldRoundStats(result: TournamentResult, round: number): Map<string, RoundStats> {
  const out = new Map<string, RoundStats>();
  for (const row of result.leaderboard) if (row.holes[round]) out.set(row.player.id, roundStats(result, row, round));
  return out;
}

// ---------------------------------------------------------------- presentation

export interface StatDef {
  key: string;
  label: string;
  group: "Scoring" | "Off the tee" | "Approach" | "Around the green" | "Putting";
  /** The number, or null when there's nothing to measure (e.g. no bunker shots). */
  value: (s: RoundStats) => number | null;
  format: (v: number, s: RoundStats) => string;
  /** Which way is better, for ranking; undefined means not ranked. */
  better?: "high" | "low";
}

const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);
const avg = (a: number, b: number) => (b > 0 ? a / b : null);
const pctText = (v: number) => `${v.toFixed(1)}%`;

/** 28.4 feet → 28' 5". */
export function feetInches(feet: number): string {
  let ft = Math.floor(feet);
  let inches = Math.round((feet - ft) * 12);
  if (inches === 12) {
    ft++;
    inches = 0;
  }
  return `${ft}' ${inches}"`;
}

/** The tour-style stat lines, in display order. */
export const STAT_DEFS: StatDef[] = [
  { key: "score", label: "Score to par", group: "Scoring", value: (s) => (s.holes ? s.toPar : null), format: (v) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`), better: "low" },
  { key: "birdies", label: "Birdies or better", group: "Scoring", value: (s) => (s.holes ? s.birdies + s.eagles : null), format: (v) => `${v}`, better: "high" },
  { key: "bogeys", label: "Bogeys or worse", group: "Scoring", value: (s) => (s.holes ? s.bogeys + s.doublesOrWorse : null), format: (v) => `${v}`, better: "low" },
  { key: "dd", label: "Driving distance", group: "Off the tee", value: (s) => avg(s.driveYards, s.drives), format: (v) => `${v.toFixed(1)} yds`, better: "high" },
  { key: "da", label: "Driving accuracy", group: "Off the tee", value: (s) => pct(s.fairwaysHit, s.fairwayAttempts), format: (v, s) => `${pctText(v)} (${s.fairwaysHit}/${s.fairwayAttempts})`, better: "high" },
  { key: "left", label: "Left rough tendency", group: "Off the tee", value: (s) => pct(s.missLeft, s.fairwayAttempts), format: (v, s) => `${pctText(v)} (${s.missLeft})` },
  { key: "right", label: "Right rough tendency", group: "Off the tee", value: (s) => pct(s.missRight, s.fairwayAttempts), format: (v, s) => `${pctText(v)} (${s.missRight})` },
  { key: "gir", label: "Greens in regulation", group: "Approach", value: (s) => pct(s.gir, s.holes), format: (v, s) => `${pctText(v)} (${s.gir}/${s.holes})`, better: "high" },
  { key: "fromFairway", label: "Accuracy from the fairway", group: "Approach", value: (s) => pct(s.girFromFairway, s.approachesFromFairway), format: (v, s) => `${pctText(v)} (${s.girFromFairway}/${s.approachesFromFairway})`, better: "high" },
  { key: "fromRough", label: "Accuracy from the rough", group: "Approach", value: (s) => pct(s.girFromRough, s.approachesFromRough), format: (v, s) => `${pctText(v)} (${s.girFromRough}/${s.approachesFromRough})`, better: "high" },
  { key: "prox", label: "Proximity to hole", group: "Approach", value: (s) => avg(s.proximityFeet, s.proximityCount), format: (v) => feetInches(v), better: "low" },
  { key: "goForIt", label: "Going for it (par 5s)", group: "Approach", value: (s) => pct(s.goForItSuccesses, s.goForItAttempts), format: (v, s) => `${pctText(v)} (${s.goForItSuccesses}/${s.goForItAttempts})`, better: "high" },
  { key: "scrambling", label: "Scrambling (up and down)", group: "Around the green", value: (s) => pct(s.scrambles, s.scrambleAttempts), format: (v, s) => `${pctText(v)} (${s.scrambles}/${s.scrambleAttempts})`, better: "high" },
  { key: "sand", label: "Sand saves", group: "Around the green", value: (s) => pct(s.sandSaves, s.sandAttempts), format: (v, s) => `${pctText(v)} (${s.sandSaves}/${s.sandAttempts})`, better: "high" },
  { key: "putts", label: "Putts", group: "Putting", value: (s) => (s.holes ? s.putts : null), format: (v, s) => (s.holes > 18 ? `${v} (${(v / (s.holes / 18)).toFixed(1)} a round)` : `${v}`), better: "low" },
  { key: "puttsGir", label: "Putts per green in regulation", group: "Putting", value: (s) => avg(s.puttsOnGir, s.gir), format: (v) => v.toFixed(3), better: "low" },
  { key: "one", label: "One-putts", group: "Putting", value: (s) => (s.holes ? s.onePutts : null), format: (v) => `${v}`, better: "high" },
  { key: "three", label: "Three-putts", group: "Putting", value: (s) => (s.holes ? s.threePutts : null), format: (v) => `${v}`, better: "low" },
  { key: "firstPutt", label: "Average first-putt distance", group: "Putting", value: (s) => avg(s.firstPuttFeet, s.puttedHoles), format: (v) => `${v.toFixed(1)} ft` },
  { key: "made", label: "Average distance of putts made", group: "Putting", value: (s) => avg(s.madeFeet, s.madeCount), format: (v) => `${v.toFixed(1)} ft`, better: "high" },
  { key: "longest", label: "Longest putt made", group: "Putting", value: (s) => (s.madeCount ? s.longestMade : null), format: (v) => `${v} ft`, better: "high" },
];

export interface RankedStat {
  def: StatDef;
  value: number | null;
  text: string;
  /** 1-based rank in the field, ties sharing the best place; null if unranked. */
  rank: number | null;
  tied: boolean;
  fieldAverage: number | null;
  fieldSize: number;
}

/** A player's stat lines with their rank in the field and the field average. */
export function rankStats(mine: RoundStats, field: RoundStats[]): RankedStat[] {
  return STAT_DEFS.map((def) => {
    const value = def.value(mine);
    const values = field.map(def.value).filter((v): v is number => v !== null);
    const fieldAverage = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    let rank: number | null = null;
    let tied = false;
    if (def.better && value !== null) {
      const round4 = (v: number) => Math.round(v * 1e4);
      rank = 1 + values.filter((v) => (def.better === "high" ? round4(v) > round4(value) : round4(v) < round4(value))).length;
      tied = values.filter((v) => round4(v) === round4(value)).length > 1;
    }
    return { def, value, text: value === null ? "–" : def.format(value, mine), rank, tied, fieldAverage, fieldSize: values.length };
  });
}
