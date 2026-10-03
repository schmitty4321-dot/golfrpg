import { coursePar } from "./courses";
import type { MatchPlayBracket } from "./matchPlay";
import { tiedPayout } from "./purse";
import { createRng, type Rng } from "./rng";
import { DAY_SD, WEEK_SD, playHole, roundForm, simulateRound, type HoleState, type RoundContext } from "./round";
import { callEffect, decisionsFor, type CallKind, type Decision, type HoleCall, type HoleSituation, type PuttCall } from "./calls";
import { pinTuck } from "./pins";
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
  /** A match-play event's draw and results (no stroke-play leaderboard behind it). */
  bracket?: MatchPlayBracket;
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
function runPlayoff(entries: Entry[], course: Course, weather: RoundWeather, rng: Rng, config: TournamentConfig, calls: Record<string, HoleCall | null> = {}) {
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
      const call = calls[e.player.id];
      const mod = call ? callEffect(call, hole, e.player, pinTuck(course, hole, 3)) : undefined;
      return playHole({ ctx, hole: { ...hole, number: 18 }, dayForm, teeShotHoles, state, ...(mod ? { mod } : {}) });
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
 * How a client plays the calls you don't make yourself: "steady" leaves every
 * call to him (the baseline the simulation is calibrated on), "attack" takes
 * on every risk, "protect" plays every hole safe.
 */
export type RoundPlan = "attack" | "steady" | "protect";

/**
 * A tournament played round by round, with your clients played hole by hole.
 * The rest of the field plays each round with the tournament's own random
 * stream; each client plays from a stream of his own, so calls never change
 * anyone else's scores. Rounds can also be simulated whole.
 */
export interface LiveTournament {
  config: TournamentConfig;
  /** The first of your clients in the field (the one shown by default). */
  controlledId: string;
  /** All your clients in the field, `controlledId` first. */
  controlledIds: string[];
  /** How each client plays the calls you don't make. */
  plans: Record<string, RoundPlan>;
  par: number;
  /** Rounds started (1-4). */
  round: number;
  weather: RoundWeather[];
  cutLine: number | null;
  /** The first client's round in progress, if any (same object as `live[controlledId]`). */
  current: LiveRound | null;
  /** Each client's round in progress, by id. Empty between rounds. */
  live: Record<string, LiveRound>;
  /** Key moments already taken, by `${id}:${round}`. */
  stops: Record<string, number>;
  /** Calls for the playoff hole, by client id (set from a playoff moment). */
  playoffCalls: Record<string, HoleCall | null>;
  /** A lift or drag on a client's form for one round (strokes per round), by `${id}:${round}`: your calls between rounds. */
  boosts: Record<string, number>;
  /** Question kinds already asked at key moments, by `${id}:${round}` (each is asked once a round). */
  asked: Record<string, CallKind[]>;
  /** A putting call for the closing holes, by `${id}:${round}`: made once, it holds to the last hole. */
  closingPutts: Record<string, PuttCall>;
  done: boolean;
  result: TournamentResult | null;
  /** @internal */
  entries: Entry[];
  /** @internal */
  rng: Rng;
  /** @internal */
  crngs: Record<string, Rng>;
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

/** A small, stable number from an id, so each client's stream differs. */
function idHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** The first client keeps the original stream, so a one-client event plays exactly as it always has. */
const clientStream = (seed: number, id: string, first: boolean) => createRng(first ? seed ^ 0x5ca11 : (seed ^ 0x5ca11 ^ idHash(id)) >>> 0);

export function startLive(config: TournamentConfig, controlled: string | string[], plans: Record<string, RoundPlan> = {}): LiveTournament {
  const ids = [...new Set(typeof controlled === "string" ? [controlled] : controlled)];
  if (!ids.length) throw new Error("no controlled player");
  for (const id of ids) if (!config.field.some((p) => p.id === id)) throw new Error("the controlled player isn't in the field");
  const rng = createRng(config.seed);
  const mine = new Set(ids);
  const entries: Entry[] = config.field.map((player) => ({
    player,
    rounds: [],
    holes: [],
    waves: [],
    dayForms: [],
    active: true,
    playoffStrokes: 0,
    weekForm: rng.normal(0, WEEK_SD),
    ...(mine.has(player.id) ? { calls: [] } : {}),
  }));
  return {
    config,
    controlledId: ids[0]!,
    controlledIds: ids,
    plans: Object.fromEntries(ids.map((id) => [id, plans[id] ?? "steady"])),
    par: coursePar(config.course),
    round: 0,
    weather: [],
    cutLine: null,
    current: null,
    live: {},
    stops: {},
    playoffCalls: {},
    boosts: {},
    asked: {},
    closingPutts: {},
    done: false,
    result: null,
    entries,
    rng,
    crngs: Object.fromEntries(ids.map((id, i) => [id, clientStream(config.seed, id, i === 0)])),
    cutDone: false,
  };
}

const entryOf = (t: LiveTournament, id: string) => t.entries.find((e) => e.player.id === id)!;

/** Whether a client is still playing (he may have missed the cut). Defaults to the first client. */
export const clientActive = (t: LiveTournament, id = t.controlledId): boolean => entryOf(t, id).active;

/** Whether any client's round is in progress. */
export const inRound = (t: LiveTournament): boolean => Object.keys(t.live).length > 0;

/** Starts the next round: the field plays it, and each client's round is set up to be played hole by hole. */
export function startLiveRound(t: LiveTournament): void {
  if (inRound(t)) throw new Error("finish the current round first");
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
  for (const e of active) {
    const wave = waves.get(e) ?? "AM";
    const shotsBehind = leader === null ? null : total(e) - leader;
    const id = e.player.id;
    const crng = t.crngs[id];
    if (crng) {
      const boost = t.boosts[`${id}:${round}`];
      const ctx: RoundContext = { player: e.player, course, weather: w, wave, round, shotsBehind, weekForm: e.weekForm, rng: crng, ...where(e), ...eventFields(t.config, id), ...(boost ? { boost } : {}) };
      const dayForm = roundForm(ctx);
      t.live[id] = { holes: [], wave, shotsBehind, ctx, dayForm, state: { lastOverPar: 0 } };
      continue;
    }
    const r = simulateRound({ player: e.player, course, weather: w, wave, round, shotsBehind, weekForm: e.weekForm, rng: t.rng, ...where(e), ...eventFields(t.config, id) });
    e.rounds.push(r.strokes);
    e.holes.push(r.holes);
    e.waves.push(wave);
    e.dayForms.push(r.dayForm);
  }
  t.current = t.live[t.controlledId] ?? null;
}

/** Plays a client's next hole with the given calls (null: his own call). Returns the score. */
export function playLiveHole(t: LiveTournament, call: HoleCall | null = null, id = t.controlledId): number {
  const cur = t.live[id];
  if (!cur) throw new Error("no round in progress");
  const course = t.config.course;
  const hole = course.holes[cur.holes.length]!;
  // A putting call for the closing holes holds to the last hole once it's made.
  const key = `${id}:${t.round}`;
  if (cur.holes.length >= course.holes.length - 3) {
    if (call?.putt) t.closingPutts[key] = call.putt;
    else if (t.closingPutts[key]) call = { ...call, putt: t.closingPutts[key] };
  }
  const me = entryOf(t, id);
  const teeShotHoles = course.holes.filter((h) => h.par > 3).length;
  const score = playHole({ ctx: cur.ctx, hole, dayForm: cur.dayForm, teeShotHoles, state: cur.state, mod: callEffect(call, hole, me.player, pinTuck(course, hole, t.round - 1)) });
  cur.holes.push(score);
  const calls = me.calls!;
  (calls[t.round - 1] ??= []).push(call && Object.keys(call).length ? call : null);
  if (cur.holes.length === course.holes.length) {
    me.rounds.push(cur.holes.reduce((a, b) => a + b, 0));
    me.holes.push(cur.holes);
    me.waves.push(cur.wave);
    me.dayForms.push(cur.dayForm);
    delete t.live[id];
    if (id === t.controlledId) t.current = null;
    if (t.round === 2) applyCut(t);
  }
  return score;
}

/**
 * What a call would do on a client's next hole: expected score and the
 * chances of birdie or better and bogey or worse, from simulating the hole
 * many times (on a separate stream, so looking doesn't change anything).
 */
export function callOdds(t: LiveTournament, call: HoleCall | null, id = t.controlledId): { expected: number; birdie: number; bogey: number } {
  const cur = t.live[id];
  if (!cur) throw new Error("no round in progress");
  const course = t.config.course;
  const hole = course.holes[cur.holes.length]!;
  const me = entryOf(t, id);
  const teeShotHoles = course.holes.filter((h) => h.par > 3).length;
  const salt = id === t.controlledId ? 0 : idHash(id);
  const rng = createRng((t.config.seed ^ (t.round * 131 + cur.holes.length * 7) ^ salt) >>> 0);
  const ctx = { ...cur.ctx, rng };
  const mod = callEffect(call, hole, me.player, pinTuck(course, hole, t.round - 1));
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

/** Where a client stands before his next hole, for deciding which calls matter. */
export function holeSituation(t: LiveTournament, id = t.controlledId): HoleSituation {
  const board = liveBoard(t, id);
  const me = board.find((r) => r.player.id === id);
  const toPar = me?.toPar ?? 0;
  const cutTop = t.config.cutTop;
  const cutMargin = t.round === 2 && cutTop !== undefined && board.length > cutTop ? board[cutTop - 1]!.toPar - toPar : null;
  return { round: t.round, index: t.live[id]?.holes.length ?? 0, behind: toPar - (board[0]?.toPar ?? toPar), cutMargin };
}

/** The call a round plan makes on a hole's decisions (null: his own call). */
export function planCall(plan: RoundPlan, decisions: Decision[]): HoleCall | null {
  if (plan === "steady" || !decisions.length) return null;
  const pick: Record<CallKind, [string, string]> = { tee: ["driver", "3-wood"], second: ["go", "layup"], approach: ["attack", "middle"], putt: ["charge", "lag"] };
  const call: Record<string, string> = {};
  for (const d of decisions) call[d.kind] = pick[d.kind][plan === "attack" ? 0 : 1];
  return call as HoleCall;
}

/** The decisions on a client's next hole (less the closing putts, once you've called them this round). */
export function nextDecisions(t: LiveTournament, id = t.controlledId): Decision[] {
  const cur = t.live[id];
  if (!cur) return [];
  const course = t.config.course;
  const key = `${id}:${t.round}`;
  const putted = !!t.closingPutts[key] || (t.asked[key] ?? []).includes("putt");
  return decisionsFor(course.holes[cur.holes.length]!, course, entryOf(t, id).player, holeSituation(t, id)).filter((d) => !(putted && d.kind === "putt"));
}

/** Records the questions you answered on a client's hole (the closing-putts one isn't asked again this round). */
export function markAsked(t: LiveTournament, id: string, kinds: CallKind[]): void {
  const key = `${id}:${t.round}`;
  t.asked[key] = [...new Set([...(t.asked[key] ?? []), ...kinds])];
}

/** Plays a client's next hole as his round plan says. Returns the score. */
export function playPlannedHole(t: LiveTournament, id = t.controlledId): number {
  return playLiveHole(t, planCall(t.plans[id] ?? "steady", nextDecisions(t, id)), id);
}

/** Plays out the rest of the round as each client's plan says: one client, or all of them. */
export function autoFinishRound(t: LiveTournament, id?: string): void {
  for (const c of id === undefined ? t.controlledIds : [id]) while (t.live[c]) playPlannedHole(t, c);
}

/** Plays every other client's holes up to (not including) hole `index` of the round, as their plans say. */
export function catchUpTo(t: LiveTournament, index: number, except?: string): TickerItem[] {
  const out: TickerItem[] = [];
  const course = t.config.course;
  for (const c of t.controlledIds) {
    if (c === except) continue;
    while (t.live[c] && t.live[c]!.holes.length < index) {
      const i = t.live[c]!.holes.length;
      out.push({ id: c, round: t.round, index: i, score: playPlannedHole(t, c), par: course.holes[i]!.par });
    }
  }
  return out;
}

// ---------------------------------------------------------------- key moments

/** Most key moments for one client in one round. */
export const MAX_STOPS = 3;

/** A hole where a call is worth stopping the week for. */
export interface Moment {
  id: string;
  round: number;
  /** 0-based hole index (the last hole for a playoff). */
  index: number;
  situation: HoleSituation;
  decisions: Decision[];
  /** A sudden-death playoff: the calls are for the 18th, played until it's settled. */
  playoff?: boolean;
}

/** A hole a client played on the way to the next moment. */
export interface TickerItem {
  id: string;
  round: number;
  index: number;
  score: number;
  par: number;
}

/** Whether a hole's situation is worth stopping for: the back nine, on the cut line on Friday or in contention at the weekend. */
export function atStake(s: HoleSituation): boolean {
  if (s.index < 9) return false;
  if (s.round === 2) return s.cutMargin !== null && Math.abs(s.cutMargin) <= 1;
  if (s.round >= 3) return s.behind <= 3;
  return false;
}

/** Your clients tied for the lead after the final round whose playoff call hasn't been made. */
export function pendingPlayoff(t: LiveTournament): string[] {
  if (t.result || t.round < 4 || inRound(t)) return [];
  const finishers = t.entries.filter((e) => e.active && e.rounds.length === 4);
  if (finishers.length < 2) return [];
  const best = Math.min(...finishers.map(total));
  const tied = finishers.filter((e) => total(e) === best);
  if (tied.length < 2) return [];
  return t.controlledIds.filter((id) => tied.some((e) => e.player.id === id) && !(id in t.playoffCalls));
}

/**
 * Plays your clients' holes, interleaved so the one furthest behind goes next,
 * until one reaches a key moment: a hole with a call to make while something
 * is at stake (at most MAX_STOPS a round each), or a playoff. Returns the
 * holes played on the way and the moment (null: the round is over). Asking
 * again without answering returns the same moment.
 */
export function nextMoment(t: LiveTournament): { ticker: TickerItem[]; moment: Moment | null } {
  const ticker: TickerItem[] = [];
  const course = t.config.course;
  for (;;) {
    const ids = t.controlledIds.filter((c) => t.live[c]);
    if (!ids.length) break;
    const id = ids.reduce((a, b) => (t.live[b]!.holes.length < t.live[a]!.holes.length ? b : a));
    const s = holeSituation(t, id);
    const key = `${id}:${t.round}`;
    const decisions = nextDecisions(t, id);
    // Each question is asked once a round; later holes go by his plan (and any closing-putts call).
    const fresh = decisions.filter((d) => !(t.asked[key] ?? []).includes(d.kind));
    if (fresh.length && atStake(s) && (t.stops[key] ?? 0) < MAX_STOPS) {
      return { ticker, moment: { id, round: t.round, index: s.index, situation: s, decisions: fresh } };
    }
    const score = playLiveHole(t, planCall(t.plans[id] ?? "steady", decisions), id);
    ticker.push({ id, round: t.round, index: s.index, score, par: course.holes[s.index]!.par });
  }
  const playoff = pendingPlayoff(t);
  if (playoff.length) {
    const id = playoff[0]!;
    const index = course.holes.length - 1;
    const s: HoleSituation = { round: 4, index, behind: 0, cutMargin: null };
    return { ticker, moment: { id, round: 4, index, situation: s, decisions: decisionsFor(course.holes[index]!, course, entryOf(t, id).player, s), playoff: true } };
  }
  return { ticker, moment: null };
}

/** Answers a key moment with your call (null: his own) and plays the hole. Returns the score (null for a playoff, which is played at the finish). */
export function answerMoment(t: LiveTournament, m: Moment, call: HoleCall | null): number | null {
  const c = call && Object.keys(call).length ? call : null;
  if (m.playoff) {
    t.playoffCalls[m.id] = c;
    return null;
  }
  const key = `${m.id}:${m.round}`;
  t.stops[key] = (t.stops[key] ?? 0) + 1;
  markAsked(t, m.id, m.decisions.map((d) => d.kind));
  // Questions you weren't asked on this hole go by his plan.
  const planned = planCall(t.plans[m.id] ?? "steady", nextDecisions(t, m.id).filter((d) => !m.decisions.some((x) => x.kind === d.kind)));
  const merged = planned || c ? { ...planned, ...c } : null;
  return playLiveHole(t, merged && Object.keys(merged).length ? merged : null, m.id);
}

/** Plays whatever is left (rounds and holes) as the plans say, and closes the tournament. */
export function finishLive(t: LiveTournament): TournamentResult {
  if (t.result) return t.result;
  autoFinishRound(t);
  while (t.round < 4) {
    startLiveRound(t);
    autoFinishRound(t);
  }
  const playoff = runPlayoff(t.entries, t.config.course, t.weather[3]!, t.rng, t.config, t.playoffCalls);
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
  const done = inRound(t) ? t.round - 1 : t.round;
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
 * a client (the field's rounds are already played; this reveals them in
 * step). Your other clients show the holes they've actually played, up to
 * the same point.
 */
export function liveBoard(t: LiveTournament, id = t.controlledId): { player: Player; toPar: number; thru: number; active: boolean }[] {
  const cur = t.live[id];
  // Once the client finishes, his round is cleared. Keep showing the
  // completed round rather than resetting every row to "thru 0".
  const thru = cur ? cur.holes.length : t.round > 0 ? t.config.course.holes.length : 0;
  const r = t.round - 1;
  return t.entries
    .filter((e) => e.active)
    .map((e) => {
      const before = e.rounds.slice(0, r).reduce((a, b) => a + b, 0) - t.par * Math.min(r, e.rounds.length);
      const own = t.live[e.player.id];
      const today = (own ? own.holes : (e.holes[r] ?? [])).slice(0, thru);
      const todayPar = t.config.course.holes.slice(0, today.length).reduce((a, h) => a + h.par, 0);
      return { player: e.player, toPar: before + today.reduce((a, b) => a + b, 0) - todayPar, thru: today.length, active: e.active };
    })
    .sort((a, b) => a.toPar - b.toPar);
}

function applyCut(t: LiveTournament): void {
  if (t.cutDone || t.round < 2 || inRound(t)) return;
  t.cutDone = true;
  const cutTop = t.config.cutTop;
  const active = t.entries.filter((e) => e.active);
  if (cutTop === undefined || active.length <= cutTop) return;
  const sorted = active.map(total).sort((a, b) => a - b);
  t.cutLine = sorted[cutTop - 1] ?? null;
  for (const e of active) if (t.cutLine !== null && total(e) > t.cutLine) e.active = false;
}
