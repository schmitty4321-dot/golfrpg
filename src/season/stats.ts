import { SG_CATEGORIES, addInto, emptyStats, eventStats, type PlayerEventResult, type TournamentResult } from "../engine";
import type { Career, EventTier, SeasonStats, World } from "./types";

export const emptySeasonStats = (season: number): SeasonStats => ({
  season,
  events: 0,
  rounds: 0,
  strokes: 0,
  cuts: 0,
  wins: 0,
  top10s: 0,
  earnings: 0,
  points: 0,
  sg: { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 },
  shots: emptyStats(),
});

/** Adds one main-tour event to a player's season stats (developmental tour events don't count). */
export function recordEventStats(c: Career, season: number, tier: EventTier, result: TournamentResult, row: PlayerEventResult, points: number): void {
  if (tier === "dev") return;
  if (!c.stats || c.stats.season !== season) c.stats = emptySeasonStats(season);
  const s = c.stats;
  s.events++;
  s.rounds += row.rounds.length;
  s.strokes += row.rounds.reduce((a, b) => a + b, 0);
  if (row.madeCut) s.cuts++;
  if (row.position === 1) s.wins++;
  if (row.madeCut && row.position <= 10) s.top10s++;
  s.earnings += row.earnings;
  s.points += points;
  for (const k of SG_CATEGORIES) s.sg[k] += row.sg[k];
  addInto(s.shots, eventStats(result, row, row.rounds.length - 1));
}

/** At the end of a season: this season's stats become last season's. */
export function closeSeasonStats(c: Career, season: number): void {
  if (c.stats?.season === season) c.lastStats = c.stats;
  else if (c.lastStats && c.lastStats.season < season - 1) delete c.lastStats;
  delete c.stats;
}

/** Everyone with main-tour rounds in the given season ("this" or "last"). */
export function statsRows(world: World, which: "this" | "last"): { id: string; stats: SeasonStats }[] {
  const season = which === "this" ? world.season : world.season - 1;
  const out: { id: string; stats: SeasonStats }[] = [];
  for (const [id, wp] of Object.entries(world.players)) {
    const s = which === "this" ? wp.career.stats : wp.career.lastStats;
    if (s && s.season === season && s.rounds > 0) out.push({ id, stats: s });
  }
  return out;
}
