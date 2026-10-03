import type { TournamentResult } from "../engine";
import { absWeek, type EventTier, type World } from "./types";

/** Season points for the winner, by tier. The finale pays money only. */
export const WINNER_POINTS: Record<EventTier, number> = {
  major: 750,
  signature: 700,
  standard: 500,
  opposite: 300,
  playoff: 750,
  finale: 0,
  dev: 500,
};

/** Share of the winner's season points by position (modelled on a FedEx Cup table). */
const SEASON_SHAPE = [
  1, 0.6, 0.38, 0.27, 0.22, 0.2, 0.18, 0.17, 0.16, 0.15, 0.14, 0.13, 0.12, 0.114, 0.112, 0.11, 0.108, 0.106,
  0.104, 0.102, 0.1, 0.098, 0.096, 0.094, 0.093, 0.092, 0.091, 0.09, 0.089, 0.088, 0.087, 0.086, 0.085,
  0.084, 0.083, 0.082, 0.081, 0.08, 0.079, 0.078, 0.077, 0.076, 0.075, 0.074, 0.073, 0.072, 0.071, 0.07,
  0.069, 0.068, 0.067, 0.066, 0.065, 0.064, 0.063, 0.062, 0.061, 0.06, 0.059, 0.058, 0.057, 0.056, 0.055,
  0.054, 0.053, 0.052, 0.051, 0.05, 0.049, 0.048, 0.047, 0.046,
];

/** World ranking share of the winner's points by position (steeper, like the OWGR). */
function owgrShare(position: number): number {
  const top = [1, 0.6, 0.4, 0.3, 0.24, 0.2, 0.18, 0.16, 0.15, 0.14];
  if (position <= top.length) return top[position - 1]!;
  return Math.max(0, 0.13 * (1 - (position - 11) / 55));
}

/** Averages a per-position table over tied places, as on tour. */
function tiedShare(position: number, count: number, share: (pos: number) => number): number {
  let s = 0;
  for (let p = position; p < position + count; p++) s += share(p);
  return s / count;
}

export function seasonPointsFor(tier: EventTier, position: number, tiedCount: number, winnerPoints = WINNER_POINTS[tier]): number {
  const share = tiedShare(position, tiedCount, (p) => SEASON_SHAPE[p - 1] ?? 0);
  return Math.round(winnerPoints * share * 10) / 10;
}

/** The world ranking points the winner gets, from the strength of the field. */
export function owgrWinnerPoints(tier: EventTier, fieldRanks: number[]): number {
  if (tier === "major") return 100;
  const strength = fieldRanks.reduce((s, r) => s + Math.max(0, (200 - r) / 200) ** 2, 0);
  // The developmental tour's winners get a fraction of a main-tour win (as on the real Korn Ferry Tour, about 15).
  if (tier === "dev") return Math.round(Math.min(16, Math.max(4, (6 + strength * 1.5) * 0.4)));
  return Math.round(Math.min(80, Math.max(6, 6 + strength * 1.5)));
}

export function owgrPointsFor(winnerPoints: number, position: number, tiedCount: number): number {
  return Math.round(winnerPoints * tiedShare(position, tiedCount, owgrShare) * 100) / 100;
}

/** Positions shared by more than one player, for tie splitting. */
export function tieCounts(result: TournamentResult): Map<number, number> {
  const counts = new Map<number, number>();
  for (const r of result.leaderboard) if (r.madeCut) counts.set(r.position, (counts.get(r.position) ?? 0) + 1);
  return counts;
}

/** Points count in full for 13 weeks, then fade to nothing over two years. */
function decay(ageWeeks: number): number {
  if (ageWeeks < 13) return 1;
  return Math.max(0, 1 - (ageWeeks - 13) / 91);
}

export interface RankingRow {
  id: string;
  average: number;
  events: number;
}

/**
 * Official-style world ranking: decayed points over the last two years,
 * divided by events played (minimum 40, maximum 52).
 */
export function worldRanking(world: World): RankingRow[] {
  const now = absWeek(world.season, world.week);
  const rows: RankingRow[] = Object.values(world.players).map((wp) => {
    let total = 0;
    let events = 0;
    for (const e of wp.career.owgr) {
      const age = now - e.absWeek;
      if (age < 0 || age >= 104) continue;
      total += e.points * decay(age);
      events++;
    }
    return { id: wp.player.id, average: total / Math.min(52, Math.max(40, events)), events };
  });
  return rows.sort((a, b) => b.average - a.average || a.id.localeCompare(b.id));
}

export function rankMap(world: World): Map<string, number> {
  return new Map(worldRanking(world).map((r, i) => [r.id, i + 1]));
}

/** Current season points list, best first. */
export function pointsList(world: World): string[] {
  return Object.values(world.players)
    .filter((wp) => wp.career.seasonEvents > 0 || wp.career.seasonPoints > 0)
    .sort((a, b) => b.career.seasonPoints - a.career.seasonPoints || b.career.seasonEarnings - a.career.seasonEarnings)
    .map((wp) => wp.player.id);
}
