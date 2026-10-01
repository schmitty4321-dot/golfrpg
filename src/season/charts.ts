/**
 * The numbers behind the profile's charts, modelled on Data Golf's player
 * pages: a rolling strokes-gained line, where he ranks on tour in each part
 * of the game, and his career season by season. Works for every player.
 */
import { overall } from "./development";
import { statsRows } from "./stats";
import type { SeasonLine, SeasonStats, World, WorldPlayer } from "./types";

/** Adds the season that's just finished to his career log (call before the stats are closed). */
export function logSeason(wp: WorldPlayer, season: number, pointsRank: number | null): void {
  const c = wp.career;
  if (c.status === "amateur") return;
  const s = c.stats?.season === season ? c.stats : undefined;
  const results = c.results.filter((r) => r.season === season);
  const line: SeasonLine = {
    season,
    age: wp.player.age,
    overall: Math.round(overall(wp.player) * 10) / 10,
    sgPerRound: s && s.rounds > 0 ? Math.round((sgTotal(s) / s.rounds) * 100) / 100 : null,
    rounds: s?.rounds ?? 0,
    events: s?.events ?? 0,
    wins: s?.wins ?? 0,
    top10s: s?.top10s ?? 0,
    majors: results.filter((r) => r.tier === "major" && r.position === 1).length,
    pointsRank,
  };
  c.seasonLog = [...(c.seasonLog ?? []).filter((l) => l.season !== season), line];
}

const sgTotal = (s: SeasonStats) => s.sg.offTheTee + s.sg.approach + s.sg.aroundTheGreen + s.sg.putting;

export interface RollingPoint {
  season: number;
  week: number;
  eventName: string;
  dev: boolean;
  /** This event's strokes gained per round. */
  sg: number;
  /** The average over the last few events, weighted by rounds played. */
  rolling: number;
}

/** His events in order with a rolling average of strokes gained per round (Data Golf's "rolling stats"). */
export function rollingSg(wp: WorldPlayer, window = 8): RollingPoint[] {
  const events = [...wp.career.results].sort((a, b) => a.season - b.season || a.week - b.week);
  const out: RollingPoint[] = [];
  for (let i = 0; i < events.length; i++) {
    const recent = events.slice(Math.max(0, i - window + 1), i + 1);
    const rounds = recent.map((r) => (r.madeCut ? 4 : 2));
    const total = rounds.reduce((a, b) => a + b, 0);
    const rolling = recent.reduce((sum, r, j) => sum + r.sgPerRound * rounds[j]!, 0) / total;
    const e = events[i]!;
    out.push({ season: e.season, week: e.week, eventName: e.eventName, dev: e.tier === "dev", sg: e.sgPerRound, rolling });
  }
  return out;
}

export type SgCategory = "total" | "offTheTee" | "approach" | "aroundTheGreen" | "putting";
export const SG_LABELS: Record<SgCategory, string> = {
  total: "Total",
  offTheTee: "Off the tee",
  approach: "Approach",
  aroundTheGreen: "Around the green",
  putting: "Putting",
};

export interface Percentiles {
  season: number;
  /** Main-tour players with enough rounds to rank. */
  pool: number;
  rows: { category: SgCategory; perRound: number; rank: number; percentile: number }[];
}

/** Rounds needed to be ranked: a few events' worth. */
export const MIN_RANKED_ROUNDS = 12;

/**
 * Where he ranks on tour in each part of the game this season (or last, if
 * he hasn't played enough yet), against everyone with enough main-tour rounds.
 */
export function tourPercentiles(world: World, id: string): Percentiles | null {
  for (const which of ["this", "last"] as const) {
    const rows = statsRows(world, which).filter((r) => r.stats.rounds >= MIN_RANKED_ROUNDS);
    const mine = rows.find((r) => r.id === id);
    if (!mine) continue;
    const value = (s: SeasonStats, k: SgCategory) => (k === "total" ? sgTotal(s) : s.sg[k]) / s.rounds;
    const categories: SgCategory[] = ["total", "offTheTee", "approach", "aroundTheGreen", "putting"];
    return {
      season: mine.stats.season,
      pool: rows.length,
      rows: categories.map((category) => {
        const v = value(mine.stats, category);
        const better = rows.filter((r) => value(r.stats, category) > v).length;
        const worse = rows.filter((r) => value(r.stats, category) < v).length;
        return { category, perRound: v, rank: better + 1, percentile: rows.length > 1 ? (worse / (rows.length - 1)) * 100 : 50 };
      }),
    };
  }
  return null;
}

/** His career log plus the season in progress, oldest first. */
export function careerLines(world: World, wp: WorldPlayer): (SeasonLine & { current: boolean })[] {
  const past = (wp.career.seasonLog ?? []).map((l) => ({ ...l, current: false }));
  const s = wp.career.stats?.season === world.season ? wp.career.stats : undefined;
  if (wp.career.status === "amateur" || past.some((l) => l.season === world.season)) return past;
  const results = wp.career.results.filter((r) => r.season === world.season);
  return [
    ...past,
    {
      season: world.season,
      age: wp.player.age,
      overall: Math.round(overall(wp.player) * 10) / 10,
      sgPerRound: s && s.rounds > 0 ? sgTotal(s) / s.rounds : null,
      rounds: s?.rounds ?? 0,
      events: s?.events ?? 0,
      wins: s?.wins ?? 0,
      top10s: s?.top10s ?? 0,
      majors: results.filter((r) => r.tier === "major" && r.position === 1).length,
      pointsRank: null,
      current: true,
    },
  ];
}
