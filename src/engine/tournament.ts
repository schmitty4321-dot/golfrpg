import { coursePar } from "./courses";
import { tiedPayout } from "./purse";
import { createRng, type Rng } from "./rng";
import { DAY_SD, WEEK_SD, playHole, simulateRound, type HoleState } from "./round";
import { SG_CATEGORIES, type Course, type Player, type RoundWeather, type StrokesGained, type Wave } from "./types";
import { drawWeather } from "./weather";

export interface TournamentConfig {
  name: string;
  course: Course;
  field: Player[];
  purse: number;
  seed: number;
  /** Top N and ties make the cut after round 2. Omit for a no-cut event. */
  cutTop?: number;
}

export interface PlayerEventResult {
  player: Player;
  /** Strokes per round played. */
  rounds: number[];
  holes: number[][];
  waves: Wave[];
  total: number;
  toPar: number;
  madeCut: boolean;
  /** 1-based finishing position; missed cuts share the position after the last cut player. */
  position: number;
  /** "1", "T4", "MC". */
  positionLabel: string;
  earnings: number;
  /** Strokes gained against the field average, summed over the event. */
  sg: StrokesGained;
  /** Mean strokes gained per round against the field. */
  sgPerRound: number;
}

export interface TournamentResult {
  name: string;
  course: Course;
  par: number;
  weather: RoundWeather[];
  leaderboard: PlayerEventResult[];
  cutLine: number | null;
  playoff: { players: string[]; holesPlayed: number } | null;
}

const emptySg = (): StrokesGained => ({ offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 });
const VAR_TOTAL = SG_CATEGORIES.reduce((s, k) => s + DAY_SD[k] ** 2, 0);

interface Entry {
  player: Player;
  rounds: number[];
  holes: number[][];
  waves: Wave[];
  dayForms: StrokesGained[];
  active: boolean;
  playoffStrokes: number;
  weekForm: number;
}

const total = (e: Entry) => e.rounds.reduce((s, x) => s + x, 0);

export function simulateTournament(config: TournamentConfig): TournamentResult {
  const { course, field } = config;
  if (field.length < 2) throw new Error("a tournament needs at least two players");
  const rng = createRng(config.seed);
  const par = coursePar(course);
  const entries: Entry[] = field.map((player) => ({
    player,
    rounds: [],
    holes: [],
    waves: [],
    dayForms: [],
    active: true,
    playoffStrokes: 0,
    weekForm: rng.normal(0, WEEK_SD),
  }));
  const weather: RoundWeather[] = [];
  let cutLine: number | null = null;

  for (let round = 1; round <= 4; round++) {
    const w = drawWeather(course, rng);
    weather.push(w);
    const active = entries.filter((e) => e.active);
    const waves = assignWaves(active, round);
    const leader = round >= 3 ? Math.min(...active.map(total)) : null;

    for (const e of active) {
      const wave = waves.get(e) ?? "AM";
      const r = simulateRound({
        player: e.player,
        course,
        weather: w,
        wave,
        round,
        shotsBehind: leader === null ? null : total(e) - leader,
        weekForm: e.weekForm,
        rng,
      });
      e.rounds.push(r.strokes);
      e.holes.push(r.holes);
      e.waves.push(wave);
      e.dayForms.push(r.dayForm);
    }

    if (round === 2 && config.cutTop !== undefined && active.length > config.cutTop) {
      const sorted = active.map(total).sort((a, b) => a - b);
      cutLine = sorted[config.cutTop - 1] ?? null;
      for (const e of active) if (cutLine !== null && total(e) > cutLine) e.active = false;
    }
  }

  const playoff = runPlayoff(entries, course, weather[3]!, rng);
  return {
    name: config.name,
    course,
    par,
    weather,
    leaderboard: rank(entries, par, config.purse),
    cutLine: cutLine === null ? null : cutLine - par * 2,
    playoff: playoff && {
      players: playoff.contenders.map((e) => e.player.id),
      holesPlayed: playoff.holesPlayed,
    },
  };
}

/**
 * Rounds 1-2: half the field goes out in the morning, and they swap on day 2.
 * Weekend: the leaders go out last, in the afternoon.
 */
function assignWaves(active: Entry[], round: number): Map<Entry, Wave> {
  const waves = new Map<Entry, Wave>();
  if (round <= 2) {
    active.forEach((e, i) => waves.set(e, (i % 2 === 0) === (round === 1) ? "AM" : "PM"));
  } else {
    const byScore = [...active].sort((a, b) => total(a) - total(b));
    byScore.forEach((e, i) => waves.set(e, i < byScore.length / 2 ? "PM" : "AM"));
  }
  return waves;
}

/** Sudden death on the 18th until one player has the lowest score on a hole. */
function runPlayoff(entries: Entry[], course: Course, weather: RoundWeather, rng: Rng) {
  const finishers = entries.filter((e) => e.active);
  const best = Math.min(...finishers.map(total));
  let contenders = finishers.filter((e) => total(e) === best);
  if (contenders.length < 2) return null;
  const all = [...contenders];
  const hole = course.holes[course.holes.length - 1]!;
  const teeShotHoles = course.holes.filter((h) => h.par > 3).length;
  let holesPlayed = 0;
  while (contenders.length > 1 && holesPlayed < 20) {
    holesPlayed++;
    const scores = contenders.map((e) => {
      const state: HoleState = { lastOverPar: 0 };
      const dayForm = e.dayForms[e.dayForms.length - 1]!;
      const ctx = { player: e.player, course, weather, wave: "PM" as Wave, round: 4, shotsBehind: 0, rng };
      return playHole({ ctx, hole: { ...hole, number: 18 }, dayForm, teeShotHoles, state });
    });
    const low = Math.min(...scores);
    contenders = contenders.filter((_, i) => scores[i] === low);
  }
  // Still level after 20 holes (vanishingly rare): the first listed wins.
  const winner = contenders[0]!;
  for (const e of all) e.playoffStrokes = e === winner ? 0 : 1;
  return { contenders: all, holesPlayed };
}

function rank(entries: Entry[], par: number, purse: number): PlayerEventResult[] {
  const sgByEntry = strokesGainedVsField(entries);
  // Playoff losers sort just behind the winner but keep their score.
  const key = (e: Entry) => (e.active ? 0 : 1e6) + total(e) + e.playoffStrokes * 0.5;
  const sorted = [...entries].sort((a, b) => key(a) - key(b));
  const results: PlayerEventResult[] = [];
  const madeCut = sorted.filter((e) => e.active).length;

  let i = 0;
  while (i < sorted.length) {
    const e = sorted[i]!;
    let j = i + 1;
    while (j < sorted.length && key(sorted[j]!) === key(e)) j++;
    const count = j - i;
    const position = i + 1;
    for (let k = i; k < j; k++) {
      const x = sorted[k]!;
      const sg = sgByEntry.get(x) ?? emptySg();
      const sgTotal = SG_CATEGORIES.reduce((s, c) => s + sg[c], 0);
      results.push({
        player: x.player,
        rounds: x.rounds,
        holes: x.holes,
        waves: x.waves,
        total: total(x),
        toPar: total(x) - par * x.rounds.length,
        madeCut: x.active,
        position: x.active ? position : madeCut + 1,
        positionLabel: x.active ? (count > 1 ? `T${position}` : `${position}`) : "MC",
        earnings: x.active ? tiedPayout(purse, position, count) : 0,
        sg,
        sgPerRound: sgTotal / x.rounds.length,
      });
    }
    i = j;
  }
  return results;
}

/**
 * Strokes gained against the field for every round played, split into
 * categories. A category's share is today's form in it relative to the
 * field; the leftover hole-by-hole luck is spread by each category's variance.
 */
function strokesGainedVsField(entries: Entry[]): Map<Entry, StrokesGained> {
  const out = new Map<Entry, StrokesGained>();
  for (const e of entries) out.set(e, emptySg());
  const rounds = Math.max(...entries.map((e) => e.rounds.length));
  for (let r = 0; r < rounds; r++) {
    const played = entries.filter((e) => e.rounds.length > r);
    const avg = played.reduce((s, e) => s + e.rounds[r]!, 0) / played.length;
    const catAvg = emptySg();
    for (const c of SG_CATEGORIES) catAvg[c] = played.reduce((s, e) => s + e.dayForms[r]![c], 0) / played.length;
    for (const e of played) {
      const sg = out.get(e)!;
      const totalSg = avg - e.rounds[r]!;
      const attributed = SG_CATEGORIES.reduce((s, c) => s + (e.dayForms[r]![c] - catAvg[c]), 0);
      const residual = totalSg - attributed;
      for (const c of SG_CATEGORIES) {
        sg[c] += e.dayForms[r]![c] - catAvg[c] + (residual * DAY_SD[c] ** 2) / VAR_TOTAL;
      }
    }
  }
  return out;
}
