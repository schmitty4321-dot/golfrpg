import type { TournamentResult } from "../engine";
import { pointsList } from "./points";
import type { HallOfFamer, History, RecordEntry, SeasonRecord, TourEvent, World, WorldPlayer } from "./types";

export function newHistory(): History {
  return {
    seasons: [],
    records: { lowestRound: null, lowest72: null, biggestMargin: null, mostWinsSeason: null, youngestWinner: null, oldestWinner: null },
    hallOfFame: [],
  };
}

export function emptySeasonRecord(season: number): SeasonRecord {
  return { season, pointsChampion: null, moneyLeader: null, devChampion: null, amateurChampion: null, winners: [], qSchool: [], graduates: [] };
}

/** This season's record, created on first use. */
export function currentSeason(world: World): SeasonRecord {
  let rec = world.history.seasons.find((s) => s.season === world.season);
  if (!rec) {
    rec = emptySeasonRecord(world.season);
    world.history.seasons.push(rec);
  }
  return rec;
}

function better(current: RecordEntry | null, value: number, lowerIsBetter: boolean): boolean {
  if (!current) return true;
  return lowerIsBetter ? value < current.value : value > current.value;
}

/** Logs the winner and checks the record book after an event. */
export function recordEvent(world: World, event: TourEvent, result: TournamentResult): void {
  const w = result.leaderboard[0];
  if (!w) return;
  const rec = currentSeason(world);
  rec.winners.push({ eventId: event.id, event: event.name, tier: event.tier, playerId: w.player.id, name: w.player.name, toPar: w.toPar });
  if (event.tier === "dev") return; // the record book is for the main tour

  const r = world.history.records;
  const entry = (value: number, wp: { id: string; name: string }): RecordEntry => ({ value, playerId: wp.id, name: wp.name, event: event.name, season: world.season });
  for (const row of result.leaderboard) {
    for (const strokes of row.rounds) {
      if (better(r.lowestRound, strokes, true)) {
        r.lowestRound = entry(strokes, row.player);
        world.news.unshift(`Record! ${row.player.name} shoots ${strokes} at ${event.name}, the lowest round on tour.`);
      }
    }
  }
  if (w.rounds.length === 4 && better(r.lowest72, w.toPar, true)) r.lowest72 = entry(w.toPar, w.player);
  const second = result.leaderboard.find((x) => x.player.id !== w.player.id);
  const margin = second ? second.total - w.total : 0;
  if (margin > 0 && better(r.biggestMargin, margin, false)) r.biggestMargin = entry(margin, w.player);
  if (better(r.youngestWinner, w.player.age, true)) r.youngestWinner = entry(w.player.age, w.player);
  if (better(r.oldestWinner, w.player.age, false)) r.oldestWinner = entry(w.player.age, w.player);
}

/** End-of-season entries: champions, and the most-wins record. */
export function closeSeasonRecord(world: World): SeasonRecord {
  const rec = currentSeason(world);
  const list = pointsList(world);
  const champ = list[0] ? world.players[list[0]] : undefined;
  if (champ) {
    rec.pointsChampion = { playerId: champ.player.id, name: champ.player.name, points: Math.round(champ.career.seasonPoints), wins: champ.career.seasonWins };
    champ.career.pointsTitles++;
  }
  const money = Object.values(world.players).sort((a, b) => b.career.seasonEarnings - a.career.seasonEarnings)[0];
  if (money) rec.moneyLeader = { playerId: money.player.id, name: money.player.name, earnings: money.career.seasonEarnings };
  const dev = Object.values(world.players).sort((a, b) => b.career.devPoints - a.career.devPoints)[0];
  if (dev && dev.career.devPoints > 0) rec.devChampion = { playerId: dev.player.id, name: dev.player.name, points: Math.round(dev.career.devPoints) };

  const mainWins = new Map<string, number>();
  for (const w of rec.winners) if (w.tier !== "dev") mainWins.set(w.playerId, (mainWins.get(w.playerId) ?? 0) + 1);
  for (const [id, n] of mainWins) {
    const r = world.history.records;
    if (better(r.mostWinsSeason, n, false)) r.mostWinsSeason = { value: n, playerId: id, name: world.players[id]?.player.name ?? "?", event: `Season ${world.season}`, season: world.season };
  }
  return rec;
}

/** Hall of Fame: a retiring player gets in on wins, majors and points titles. */
export function hallOfFameScore(wp: WorldPlayer): number {
  return wp.career.careerWins + wp.career.careerMajors * 3 + wp.career.pointsTitles * 3;
}
export const HALL_OF_FAME_BAR = 15;

export function considerForHallOfFame(world: World, wp: WorldPlayer): HallOfFamer | null {
  if (hallOfFameScore(wp) < HALL_OF_FAME_BAR) return null;
  const entry: HallOfFamer = {
    playerId: wp.player.id,
    name: wp.player.name,
    nationality: wp.player.nationality,
    wins: wp.career.careerWins,
    majors: wp.career.careerMajors,
    pointsTitles: wp.career.pointsTitles,
    inducted: world.season,
  };
  world.history.hallOfFame.push(entry);
  world.news.unshift(`${wp.player.name} is elected to the Hall of Fame: ${entry.wins} wins, ${entry.majors} majors.`);
  return entry;
}
