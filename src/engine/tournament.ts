import { coursePar } from "./courses";
import { tiedPayout } from "./purse";
import { createRng, type Rng } from "./rng";
import { DAY_SD, WEEK_SD, playHole, roundForm, simulateRound, type HoleState, type RoundContext } from "./round";
import { callEffect, type HoleCall } from "./calls";
import type { PlayerEventContext } from "./traits";
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
  /** The event's tier ("major", "signature", ...), for player traits. */
  tier?: string;
  /** What the season knows about each player's week, by id, for player traits. */
  context?: Record<string, PlayerEventContext>;
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
  /** The calls made for a player played hole by hole, by round and hole (null: his own call). */
  calls?: (HoleCall | null)[][];
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
  calls?: (HoleCall | null)[][];
}

const total = (e: Entry) => e.rounds.reduce((s, x) => s + x, 0);

/**
 * Where each player stands going into a round, for traits: shots inside or
 * outside the projected cut before round 2, and 36-hole positions on the weekend.
 */
function situation(active: Entry[], round: number, cutTop: number | undefined): (e: Entry) => { cutGap: number | null; position36: number | null } {
  const totals = active.map(total).sort((a, b) => a - b);
  const projected = round === 2 && cutTop !== undefined && totals.length > cutTop ? totals[cutTop - 1]! : null;
  return (e) => {
    const t = total(e);
    return {
      cutGap: projected === null ? null : projected - t,
      position36: round >= 3 ? totals.findIndex((x) => x === t) + 1 : null,
    };
  };
}

/** The per-event fields of a player's round context. */
const eventFields = (config: TournamentConfig, id: string) => ({
  ...(config.tier ? { tier: config.tier } : {}),
  ...(config.context?.[id] ? { event: config.context[id] } : {}),
});

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
    const where = situation(active, round, config.cutTop);

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
        ...where(e),
        ...eventFields(config, e.player.id),
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

  const playoff = runPlayoff(entries, course, weather[3]!, rng, config);
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
function runPlayoff(entries: Entry[], course: Course, weather: RoundWeather, rng: Rng, config: TournamentConfig) {
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
      const ctx: RoundContext = { player: e.player, course, weather, wave: "PM", round: 4, shotsBehind: 0, rng, playoff: true, ...eventFields(config, e.player.id) };
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
        ...(x.calls ? { calls: x.calls } : {}),
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

export interface RoundStanding {
  player: Player;
  /** Strokes over the rounds played so far. */
  total: number;
  toPar: number;
  /** This round's score (null if he didn't play it, i.e. missed the cut). */
  today: number | null;
  rounds: number[];
  position: number;
  positionLabel: string;
  /** Places gained (+) or lost (-) since the previous round; null after round 1. */
  movement: number | null;
  /** False once a player has missed the cut. */
  active: boolean;
}

/**
 * The leaderboard as it stood after `round` rounds (1-4), rebuilt from the
 * final result, so an event can be revealed a round at a time. Players who
 * missed the cut drop to the bottom from round 3 on.
 */
export function standingsAfterRound(result: TournamentResult, round: number): RoundStanding[] {
  const rows = result.leaderboard.map((r) => {
    const played = r.rounds.slice(0, round);
    const total = played.reduce((s, x) => s + x, 0);
    return {
      player: r.player,
      total,
      toPar: total - result.par * played.length,
      today: r.rounds.length >= round ? r.rounds[round - 1]! : null,
      rounds: played,
      active: r.rounds.length >= round,
    };
  });
  const rank = (list: typeof rows) => {
    const sorted = [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.total - b.total);
    const pos = new Map<string, { position: number; label: string }>();
    sorted.forEach((r) => {
      const first = sorted.findIndex((x) => x.active === r.active && x.total === r.total);
      const tied = sorted.filter((x) => x.active === r.active && x.total === r.total).length;
      pos.set(r.player.id, { position: first + 1, label: r.active ? (tied > 1 ? `T${first + 1}` : `${first + 1}`) : "MC" });
    });
    return { sorted, pos };
  };
  const now = rank(rows);
  const before =
    round > 1
      ? rank(
          result.leaderboard.map((r) => {
            const played = r.rounds.slice(0, round - 1);
            return { player: r.player, total: played.reduce((s, x) => s + x, 0), toPar: 0, today: null, rounds: played, active: r.rounds.length >= round - 1 };
          }),
        ).pos
      : null;
  // After the final round the official order (including any playoff) wins.
  const finalOrder = round >= Math.max(...result.leaderboard.map((r) => r.rounds.length)) ? new Map(result.leaderboard.map((r, i) => [r.player.id, i])) : null;
  const ordered = finalOrder ? [...now.sorted].sort((a, b) => finalOrder.get(a.player.id)! - finalOrder.get(b.player.id)!) : now.sorted;
  return ordered.map((r) => {
    const official = finalOrder ? result.leaderboard.find((x) => x.player.id === r.player.id)! : null;
    const p = now.pos.get(r.player.id)!;
    const position = official ? official.position : p.position;
    const prev = before?.get(r.player.id);
    return {
      ...r,
      position,
      positionLabel: official ? official.positionLabel : p.label,
      movement: prev && r.active ? prev.position - position : null,
    };
  });
}

// ---------------------------------------------------------------- live play

/**
 * A tournament played round by round, with one player (your client) played
 * hole by hole. The rest of the field plays each round with the tournament's
 * own random stream; the client plays from a stream of his own, so his calls
 * never change anyone else's scores. Rounds can also be simulated whole.
 */
export interface LiveTournament {
  config: TournamentConfig;
  controlledId: string;
  par: number;
  /** Rounds started (1-4). */
  round: number;
  weather: RoundWeather[];
  cutLine: number | null;
  /** The client's round in progress, if any. */
  current: LiveRound | null;
  done: boolean;
  result: TournamentResult | null;
  /** @internal */
  entries: Entry[];
  /** @internal */
  rng: Rng;
  /** @internal */
  crng: Rng;
  /** @internal */
  cutDone: boolean;
}

export interface LiveRound {
  /** Holes played so far this round. */
  holes: number[];
  wave: Wave;
  /** Shots behind the leader at the start of the round (null in rounds 1-2). */
  shotsBehind: number | null;
  /** @internal */
  ctx: RoundContext;
  /** @internal */
  dayForm: StrokesGained;
  /** @internal */
  state: HoleState;
}

export function startLive(config: TournamentConfig, controlledId: string): LiveTournament {
  if (!config.field.some((p) => p.id === controlledId)) throw new Error("the controlled player isn't in the field");
  const rng = createRng(config.seed);
  const entries: Entry[] = config.field.map((player) => ({
    player,
    rounds: [],
    holes: [],
    waves: [],
    dayForms: [],
    active: true,
    playoffStrokes: 0,
    weekForm: rng.normal(0, WEEK_SD),
    ...(player.id === controlledId ? { calls: [] } : {}),
  }));
  return {
    config,
    controlledId,
    par: coursePar(config.course),
    round: 0,
    weather: [],
    cutLine: null,
    current: null,
    done: false,
    result: null,
    entries,
    rng,
    crng: createRng(config.seed ^ 0x5ca11),
    cutDone: false,
  };
}

const controlled = (t: LiveTournament) => t.entries.find((e) => e.player.id === t.controlledId)!;

/** Whether the client is still playing (he may have missed the cut). */
export const clientActive = (t: LiveTournament): boolean => controlled(t).active;

/** Starts the next round: the field plays it, and the client's round is set up to be played hole by hole. */
export function startLiveRound(t: LiveTournament): void {
  if (t.current) throw new Error("finish the current round first");
  if (t.round >= 4) throw new Error("the tournament is over");
  applyCut(t);
  t.round++;
  const round = t.round;
  const course = t.config.course;
  const w = drawWeather(course, t.rng);
  t.weather.push(w);
  const active = t.entries.filter((e) => e.active);
  const waves = assignWaves(active, round);
  const leader = round >= 3 ? Math.min(...active.map(total)) : null;
  const where = situation(active, round, t.config.cutTop);
  const me = controlled(t);
  for (const e of active) {
    const wave = waves.get(e) ?? "AM";
    const shotsBehind = leader === null ? null : total(e) - leader;
    if (e === me) {
      const ctx: RoundContext = { player: e.player, course, weather: w, wave, round, shotsBehind, weekForm: e.weekForm, rng: t.crng, ...where(e), ...eventFields(t.config, e.player.id) };
      const dayForm = roundForm(ctx);
      t.current = { holes: [], wave, shotsBehind, ctx, dayForm, state: { lastOverPar: 0 } };
      continue;
    }
    const r = simulateRound({ player: e.player, course, weather: w, wave, round, shotsBehind, weekForm: e.weekForm, rng: t.rng, ...where(e), ...eventFields(t.config, e.player.id) });
    e.rounds.push(r.strokes);
    e.holes.push(r.holes);
    e.waves.push(wave);
    e.dayForms.push(r.dayForm);
  }
}

/** Plays the client's next hole with the given calls (null: his own call). Returns the score. */
export function playLiveHole(t: LiveTournament, call: HoleCall | null = null): number {
  const cur = t.current;
  if (!cur) throw new Error("no round in progress");
  const course = t.config.course;
  const hole = course.holes[cur.holes.length]!;
  const me = controlled(t);
  const teeShotHoles = course.holes.filter((h) => h.par > 3).length;
  const score = playHole({ ctx: cur.ctx, hole, dayForm: cur.dayForm, teeShotHoles, state: cur.state, mod: callEffect(call, hole, me.player) });
  cur.holes.push(score);
  const calls = me.calls!;
  (calls[t.round - 1] ??= []).push(call && Object.keys(call).length ? call : null);
  if (cur.holes.length === course.holes.length) {
    me.rounds.push(cur.holes.reduce((a, b) => a + b, 0));
    me.holes.push(cur.holes);
    me.waves.push(cur.wave);
    me.dayForms.push(cur.dayForm);
    t.current = null;
    if (t.round === 2) applyCut(t);
  }
  return score;
}

/**
 * What a call would do on the client's next hole: expected score and the
 * chances of birdie or better and bogey or worse, from simulating the hole
 * many times (on a separate stream, so looking doesn't change anything).
 */
export function callOdds(t: LiveTournament, call: HoleCall | null): { expected: number; birdie: number; bogey: number } {
  const cur = t.current;
  if (!cur) throw new Error("no round in progress");
  const course = t.config.course;
  const hole = course.holes[cur.holes.length]!;
  const me = controlled(t);
  const teeShotHoles = course.holes.filter((h) => h.par > 3).length;
  const rng = createRng(t.config.seed ^ (t.round * 131 + cur.holes.length * 7));
  const ctx = { ...cur.ctx, rng };
  const mod = callEffect(call, hole, me.player);
  const N = 1500;
  let sum = 0;
  let birdies = 0;
  let bogeys = 0;
  for (let i = 0; i < N; i++) {
    const score = playHole({ ctx, hole, dayForm: cur.dayForm, teeShotHoles, state: { ...cur.state }, mod });
    sum += score;
    if (score < hole.par) birdies++;
    if (score > hole.par) bogeys++;
  }
  return { expected: sum / N, birdie: birdies / N, bogey: bogeys / N };
}

/** Plays out the client's current round with his own calls. */
export function autoFinishRound(t: LiveTournament): void {
  while (t.current) playLiveHole(t, null);
}

/** Plays whatever is left (rounds and holes) and closes the tournament. */
export function finishLive(t: LiveTournament): TournamentResult {
  if (t.result) return t.result;
  autoFinishRound(t);
  while (t.round < 4) {
    startLiveRound(t);
    autoFinishRound(t);
  }
  const playoff = runPlayoff(t.entries, t.config.course, t.weather[3]!, t.rng, t.config);
  t.done = true;
  t.result = {
    name: t.config.name,
    course: t.config.course,
    par: t.par,
    weather: t.weather,
    leaderboard: rank(t.entries, t.par, t.config.purse),
    cutLine: t.cutLine === null ? null : t.cutLine - t.par * 2,
    playoff: playoff && { players: playoff.contenders.map((e) => e.player.id), holesPlayed: playoff.holesPlayed },
  };
  return t.result;
}

/** The tournament so far, in the same shape as a finished one (for leaderboards between rounds). */
export function liveSnapshot(t: LiveTournament): TournamentResult {
  if (t.result) return t.result;
  // Only completed rounds count: a player's round in progress isn't on the board yet.
  const done = t.current ? t.round - 1 : t.round;
  const entries = t.entries
    .map((e) => ({ ...e, rounds: e.rounds.slice(0, done), holes: e.holes.slice(0, done), waves: e.waves.slice(0, done), dayForms: e.dayForms.slice(0, done) }))
    .filter((e) => e.rounds.length > 0 || done === 0);
  return {
    name: t.config.name,
    course: t.config.course,
    par: t.par,
    weather: t.weather.slice(0, done),
    leaderboard: done === 0 ? [] : rank(entries, t.par, t.config.purse),
    cutLine: t.cutLine === null ? null : t.cutLine - t.par * 2,
    playoff: null,
  };
}

/**
 * Everyone's score to par through the same hole of the round in progress as
 * the client (the field's rounds are already played; this reveals them in step).
 */
export function liveBoard(t: LiveTournament): { player: Player; toPar: number; thru: number; active: boolean }[] {
  const cur = t.current;
  const thru = cur ? cur.holes.length : 0;
  const r = t.round - 1;
  return t.entries
    .filter((e) => e.active)
    .map((e) => {
      const before = e.rounds.slice(0, r).reduce((a, b) => a + b, 0) - t.par * Math.min(r, e.rounds.length);
      const today = e.player.id === t.controlledId && cur ? cur.holes : (e.holes[r] ?? []).slice(0, thru);
      const todayPar = t.config.course.holes.slice(0, today.length).reduce((a, h) => a + h.par, 0);
      return { player: e.player, toPar: before + today.reduce((a, b) => a + b, 0) - todayPar, thru: today.length, active: e.active };
    })
    .sort((a, b) => a.toPar - b.toPar);
}

function applyCut(t: LiveTournament): void {
  if (t.cutDone || t.round < 2 || t.current) return;
  t.cutDone = true;
  const cutTop = t.config.cutTop;
  const active = t.entries.filter((e) => e.active);
  if (cutTop === undefined || active.length <= cutTop) return;
  const sorted = active.map(total).sort((a, b) => a - b);
  t.cutLine = sorted[cutTop - 1] ?? null;
  for (const e of active) if (t.cutLine !== null && total(e) > t.cutLine) e.active = false;
}
