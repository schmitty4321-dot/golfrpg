/**
 * The realism report: plays seasons and measures the simulation against
 * real golf, mostly Data Golf (datagolf.com), so every change to the sim
 * shows whether it made the game more or less like the PGA TOUR.
 *
 * Strokes gained are per round against the field. One point of overall
 * rating is about 0.66 strokes a round on the real courses (measured after the
 * approach and distance rescales, 2026-10-01), so Data Golf's strokes convert
 * to ratings at about 1.52 points per stroke.
 */
import { ALL_ATTRIBUTES, YARDS_PER_POINT, expectedStrokesGained, totalSg } from "../engine";
import { careerLines } from "./charts";
import { seasonVsReal } from "./courseSetup";
import { overall } from "./development";
import { finishSeason } from "./world";
import { seasonWeeks } from "./calendar";
import { playWeek } from "./week";
import type { SeasonLine, World } from "./types";

const RATING_PER_STROKE = 1 / 0.66;

export interface Anchor {
  label: string;
  /** The real figure. */
  real: number;
  /** How far the sim may be from it and still count as close. */
  tolerance: number;
  unit: string;
  source: string;
}

/** Real figures to compare with, and where they come from. */
export const REALISM_ANCHORS = {
  roundScatter: {
    label: "Round-to-round scatter (one player, strokes SD)",
    real: 2.75,
    tolerance: 0.35,
    unit: "strokes",
    source: "Data Golf: a PGA TOUR player's scores vary about 2.75 strokes day to day, ability held constant",
  },
  spreadApproach: { label: "Skill spread between players: approach", real: 0.37, tolerance: 0.15, unit: "strokes/rd", source: "Data Golf skill-profile standard deviation, SG approach" },
  spreadAroundGreen: { label: "Skill spread between players: around the green", real: 0.16, tolerance: 0.1, unit: "strokes/rd", source: "Data Golf skill-profile standard deviation, SG around the green" },
  spreadPutting: { label: "Skill spread between players: putting", real: 0.24, tolerance: 0.12, unit: "strokes/rd", source: "Data Golf skill-profile standard deviation, SG putting" },
  fieldVsReal: { label: "Field scoring vs real hole averages", real: 0, tolerance: 0.3, unit: "strokes/rd", source: "Real hole averages from the PGA TOUR courses in this game (realHoles.json)" },
  age23to25: { label: "Change a year, ages 23-25 (card holders)", real: 0.15, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, 98 players' strokes gained by age (2026): mean change from each age in the band to the next, converted" },
  age26to28: { label: "Change a year, ages 26-28", real: 0.06, tolerance: 0.2, unit: "overall/yr", source: "Data Golf profiles, as above" },
  age29to31: { label: "Change a year, ages 29-31", real: -0.09, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, as above" },
  age32to34: { label: "Change a year, ages 32-34", real: -0.14, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, as above" },
  age35to37: { label: "Change a year, ages 35-37", real: -0.17, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, as above" },
  age38to41: { label: "Change a year, ages 38-41", real: -0.21, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, as above" },
  neverWin: { label: "Rookies who never win", real: 65, tolerance: 12, unit: "%", source: "Data Golf careers: 205 PGA TOUR rookies, 1990-2014 debuts" },
  bustTwoSeasons: { label: "Rookies with 2 or fewer full seasons", real: 31, tolerance: 12, unit: "%", source: "Data Golf careers, as above (players with 25+ starts; the true rate is higher)" },
  tenSeasons: { label: "Rookies with 10+ full seasons", real: 33, tolerance: 12, unit: "%", source: "Data Golf careers, as above" },
  tierStarPlus: { label: "Rookies who become stars or legends", real: 12, tolerance: 7, unit: "%", source: "Data Golf careers: peak 2-season SG +1.25 or better, or 5+ wins" },
  tierAverage: { label: "Rookies who peak as average tour pros or better", real: 46, tolerance: 15, unit: "%", source: "Data Golf careers: peak 2-season SG 0 or better" },
  leader54: { label: "54-hole leaders (incl. co-leaders) who win", real: 34, tolerance: 8, unit: "%", source: "Golf Channel: 34.6% over 15 seasons; Justin Ray: 33% over 5 seasons" },
  margin: { label: "Average winning margin (playoffs count as 0)", real: 1.98, tolerance: 0.6, unit: "strokes", source: "PGA TOUR, 2022-23 Season by the Numbers: 1.98 strokes" },
  winnerSg: { label: "Winners' strokes a round better than the field", real: 3.7, tolerance: 0.4, unit: "strokes", source: "Mark Broadie, Every Shot Counts (2014, ShotLink 2004-): winners average 67.4, 3.7 a round better than the field" },
  playoffRate: { label: "Events decided in a playoff", real: 20, tolerance: 8, unit: "%", source: "PGA TOUR, 2022-23 Season by the Numbers: 10 playoffs in 51 stroke-play events" },
  closeFinish: { label: "Events decided by one shot or fewer", real: 47, tolerance: 12, unit: "%", source: "PGA TOUR, 2022-23 Season by the Numbers: 24 of 51" },
  winsTwenties: { label: "Wins by players in their 20s", real: 48, tolerance: 10, unit: "%", source: "PGA TOUR, 2022-23 Season by the Numbers: 225 of the last 472 wins (10 seasons)" },
  winsForties: { label: "Wins by players 40 or older", real: 8, tolerance: 5, unit: "%", source: "PGA TOUR, 2022-23 Season by the Numbers: about 41 of 472 wins (10 seasons)" },
  gir: { label: "Tour average: greens in regulation", real: 66.3, tolerance: 4, unit: "%", source: "PGA TOUR, 2022-23 Season by the Numbers" },
  fairways: { label: "Tour average: fairways hit", real: 59.1, tolerance: 5, unit: "%", source: "PGA TOUR, 2022-23 Season by the Numbers" },
  scrambling: { label: "Tour average: scrambling", real: 58.7, tolerance: 5, unit: "%", source: "PGA TOUR, 2022-23 Season by the Numbers" },
  sandSaves: { label: "Tour average: sand saves", real: 49.6, tolerance: 6, unit: "%", source: "PGA TOUR, 2022-23 Season by the Numbers" },
  putts: { label: "Tour average: putts per round", real: 29.02, tolerance: 0.6, unit: "putts", source: "PGA TOUR, 2022-23 Season by the Numbers" },
  birdies: { label: "Tour average: birdies or better per round", real: 3.72, tolerance: 0.4, unit: "per rd", source: "PGA TOUR, 2022-23 Season by the Numbers" },
  bogeys: { label: "Tour average: bogeys or worse per round", real: 2.59, tolerance: 0.4, unit: "per rd", source: "PGA TOUR, 2022-23 Season by the Numbers (bogey average)" },
  drive: { label: "Tour average: driving distance (all drives)", real: 291.9, tolerance: 10, unit: "yards", source: "PGA TOUR, 2022-23 Season by the Numbers" },
  wind10: { label: "Extra strokes a round in 10-15 mph wind (vs calm)", real: 0.75, tolerance: 0.5, unit: "strokes", source: "golfweatherscore.com, PGA TOUR wind trends: +0.5 to +1.0" },
  wind20: { label: "Extra strokes a round in 20+ mph wind (vs calm)", real: 2.25, tolerance: 1, unit: "strokes", source: "golfweatherscore.com, PGA TOUR wind trends: +1.5 to +3.0" },
  distance10: { label: "Worth of 10 more yards off the tee", real: 0.5, tolerance: 0.2, unit: "strokes/rd", source: "Data Golf, How much is 10 yards worth?: about 0.5 strokes a round" },
  leaderFinal: { label: "Final-round leaders vs expectation", real: -0.44, tolerance: 0.3, unit: "strokes", source: "Data Golf, Pressure and Performance: -0.44 a round" },
  withdrawals: { label: "Injuries per 100 starts (real: all withdrawals 1.8)", real: 1.0, tolerance: 0.6, unit: "per 100", source: "Golf Digest: 2,100 WDs, 1.8% of starts 2015-24, all causes; injuries taken as about half" },
} satisfies Record<string, Anchor>;

export type MetricKey = keyof typeof REALISM_ANCHORS;

export interface RealismMetrics {
  seasons: number;
  /** Measured values; missing when the run was too short to say. */
  values: Partial<Record<MetricKey, number>>;
  /** Figures without a firm real anchor yet, reported as they are. */
  info: Record<string, number>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

const AGE_BANDS: [MetricKey, number, number][] = [
  ["age23to25", 23, 25],
  ["age26to28", 26, 28],
  ["age29to31", 29, 31],
  ["age32to34", 32, 34],
  ["age35to37", 35, 37],
  ["age38to41", 38, 41],
];

/**
 * Plays `seasons` seasons of the world forward and measures it. Career and
 * rookie-outcome figures need a long run (12+ seasons) and are left out of
 * shorter ones.
 */
export function measureRealism(world: World, seasons: number): RealismMetrics {
  const roundSg = new Map<string, number[]>();
  const spreads: Record<"approach" | "aroundTheGreen" | "putting", number[]> = { approach: [], aroundTheGreen: [], putting: [] };
  const vsReal: number[] = [];
  const winners: number[] = [];
  const winningToPar: number[] = [];
  const winnerSg: number[] = [];
  let leaderInstances = 0;
  let leaderWins = 0;
  const margins: number[] = [];
  let playoffs = 0;
  let events = 0;
  let close = 0;
  const winnerAges: number[] = [];
  const windRounds: { wind: number; excess: number }[] = [];
  const leaderFinals: number[] = [];
  let starts = 0;
  let injuries = 0;
  const shots = { holes: 0, gir: 0, fa: 0, fh: 0, sa: 0, sc: 0, bunk: 0, ss: 0, putts: 0, birdies: 0, bogeys: 0, drives: 0, yards: 0 };
  const ageDeltas = new Map<MetricKey, number[]>();
  const lines = new Map<string, (SeasonLine & { current: boolean })[]>();
  const firstSeason = world.season;

  for (let s = 0; s < seasons; s++) {
    // The age curve compares like with like: Data Golf's profiles are players who made the tour,
    // so count players holding a main-tour card at the start of the season.
    const start = new Map(
      Object.values(world.players)
        .filter((wp) => wp.career.status !== "amateur" && wp.career.status !== "none")
        .map((wp) => [wp.player.id, { age: wp.player.age, level: overall(wp.player) }]),
    );
    const won = new Set<string>();
    while (world.week <= seasonWeeks(world)) {
      const hurtBefore = new Set(Object.values(world.players).filter((wp) => wp.injury).map((wp) => wp.player.id));
      const report = playWeek(world);
      for (const x of report.results) {
        for (const id of x.field.field) {
          starts++;
          if (world.players[id]?.injury && !hurtBefore.has(id)) injuries++;
        }
      }
      for (const x of report.results) {
        // Stroke-play measures: the developmental tour and match play don't count.
        if (x.event.tier === "dev" || x.result.bracket) continue;
        const board = x.result.leaderboard;
        const rounds = Math.max(...board.map((e) => e.rounds.length));
        for (let r = 0; r < rounds; r++) {
          const scores = board.filter((e) => e.rounds.length > r).map((e) => e.rounds[r]!);
          const field = mean(scores);
          for (const e of board) if (e.rounds.length > r) (roundSg.get(e.player.id) ?? roundSg.set(e.player.id, []).get(e.player.id)!).push(field - e.rounds[r]!);
        }
        // Wind: each round's field average against the event's own average, by the day's wind.
        const fieldAvg: number[] = [];
        for (let r = 0; r < rounds; r++) fieldAvg.push(mean(board.filter((e) => e.rounds.length > r).map((e) => e.rounds[r]!)));
        const eventAvg = mean(fieldAvg);
        x.result.weather.forEach((wx, r) => {
          if (r < fieldAvg.length) windRounds.push({ wind: (wx.windMph.AM + wx.windMph.PM) / 2, excess: fieldAvg[r]! - eventAvg });
        });
        const w = board[0]!;
        won.add(w.player.id);
        winningToPar.push(w.toPar);
        winnerSg.push(w.sgPerRound);
        events++;
        winnerAges.push(world.players[w.player.id]?.player.age ?? w.player.age);
        // Who led after 54 holes, and did one of them win?
        const thru54 = board.filter((e) => e.rounds.length >= 4).map((e) => ({ id: e.player.id, s: e.rounds[0]! + e.rounds[1]! + e.rounds[2]! }));
        if (thru54.length) {
          const best = Math.min(...thru54.map((e) => e.s));
          const leaders = thru54.filter((e) => e.s === best);
          leaderInstances += leaders.length;
          if (leaders.some((e) => e.id === w.player.id)) leaderWins++;
          // Their final round against what their level says they'd gain on the field.
          const r4 = mean(board.filter((e) => e.rounds.length >= 4).map((e) => e.rounds[3]!));
          for (const l of leaders) {
            const e = board.find((b) => b.player.id === l.id)!;
            const lp = world.players[l.id];
            if (lp) leaderFinals.push(r4 - e.rounds[3]! - (overall(lp.player) - 12) / RATING_PER_STROKE);
          }
        }
        const playoff = x.result.playoff !== null;
        if (playoff) playoffs++;
        const margin = playoff ? 0 : (board[1]?.total ?? w.total) - w.total;
        margins.push(margin);
        if (margin <= 1) close++;
      }
    }
    winners.push(won.size);
    const v = seasonVsReal(world);
    if (v !== null) vsReal.push(v);
    // Tour-wide shot stats, from everyone's main-tour rounds.
    for (const wp of Object.values(world.players)) {
      const st = wp.career.stats;
      if (!st || st.season !== world.season || st.rounds === 0) continue;
      const x = st.shots;
      shots.holes += x.holes;
      shots.gir += x.gir;
      shots.fa += x.fairwayAttempts;
      shots.fh += x.fairwaysHit;
      shots.sa += x.scrambleAttempts;
      shots.sc += x.scrambles;
      shots.bunk += x.sandAttempts;
      shots.ss += x.sandSaves;
      shots.putts += x.putts;
      shots.birdies += x.birdies + x.eagles;
      shots.bogeys += x.bogeys + x.doublesOrWorse;
      shots.drives += x.drives;
      shots.yards += x.driveYards;
    }
    // Skill spread between regulars (40+ main-tour rounds), by category.
    for (const wp of Object.values(world.players)) {
      const st = wp.career.stats;
      if (!st || st.season !== world.season || st.rounds < 40) continue;
      for (const k of ["approach", "aroundTheGreen", "putting"] as const) spreads[k].push(st.sg[k] / st.rounds);
    }
    // Keep everyone's career lines before retirements remove them.
    for (const wp of Object.values(world.players)) lines.set(wp.player.id, careerLines(world, wp));
    finishSeason(world);
    for (const wp of Object.values(world.players)) {
      const before = start.get(wp.player.id);
      if (!before || wp.career.status === "amateur") continue;
      const band = AGE_BANDS.find(([, lo, hi]) => before.age >= lo && before.age <= hi);
      if (band) (ageDeltas.get(band[0]) ?? ageDeltas.set(band[0], []).get(band[0])!).push(overall(wp.player) - before.level);
    }
  }

  const values: Partial<Record<MetricKey, number>> = {};
  // Within-player scatter, pooled over everyone with a decent sample.
  const scatter: number[] = [];
  for (const xs of roundSg.values()) if (xs.length >= 40) scatter.push(sd(xs));
  values.roundScatter = mean(scatter);
  // Season spreads include sampling noise on top of skill, so the sim reads a little high.
  values.spreadApproach = sd(spreads.approach);
  values.spreadAroundGreen = sd(spreads.aroundTheGreen);
  values.spreadPutting = sd(spreads.putting);
  values.fieldVsReal = mean(vsReal);
  values.leader54 = leaderInstances ? (100 * leaderWins) / leaderInstances : NaN;
  values.margin = mean(margins);
  values.winnerSg = mean(winnerSg);
  values.playoffRate = events ? (100 * playoffs) / events : NaN;
  values.closeFinish = events ? (100 * close) / events : NaN;
  values.winsTwenties = winnerAges.length ? (100 * winnerAges.filter((a) => a >= 20 && a <= 29).length) / winnerAges.length : NaN;
  values.winsForties = winnerAges.length ? (100 * winnerAges.filter((a) => a >= 40).length) / winnerAges.length : NaN;
  const rounds = shots.holes / 18;
  values.gir = (100 * shots.gir) / shots.holes;
  values.fairways = (100 * shots.fh) / shots.fa;
  values.scrambling = (100 * shots.sc) / shots.sa;
  values.sandSaves = (100 * shots.ss) / shots.bunk;
  values.putts = shots.putts / rounds;
  values.birdies = shots.birdies / rounds;
  values.bogeys = shots.bogeys / rounds;
  values.drive = shots.yards / shots.drives;
  const calm = windRounds.filter((r) => r.wind < 8).map((r) => r.excess);
  const mid = windRounds.filter((r) => r.wind >= 10 && r.wind <= 15).map((r) => r.excess);
  const big = windRounds.filter((r) => r.wind >= 20).map((r) => r.excess);
  if (calm.length >= 10 && mid.length >= 10) values.wind10 = mean(mid) - mean(calm);
  if (calm.length >= 10 && big.length >= 5) values.wind20 = mean(big) - mean(calm);
  values.distance10 = distanceValue(world);
  values.leaderFinal = mean(leaderFinals);
  values.withdrawals = starts ? (100 * injuries) / starts : NaN;
  for (const [key] of AGE_BANDS) {
    const xs = ageDeltas.get(key) ?? [];
    if (xs.length >= 20) values[key] = mean(xs);
  }

  // Careers of players who reached the main tour during the run, followed for at least ten seasons.
  if (seasons >= 12) {
    const cohort: { full: number; wins: number; majors: number; peak: number }[] = [];
    const lastDebut = firstSeason + seasons - 10;
    for (const ls of lines.values()) {
      const full = ls.filter((l) => l.rounds >= 20 && l.sgPerRound !== null);
      const debut = full[0]?.season;
      if (debut === undefined || debut <= firstSeason || debut > lastDebut) continue;
      // Only a debut, not a veteran seen for the first time: no earlier main-tour rounds at all.
      if (ls.some((l) => l.season < debut && l.rounds > 0)) continue;
      let peak = -Infinity;
      for (const l of full) {
        const next = full.find((n) => n.season === l.season + 1);
        if (next) peak = Math.max(peak, (l.sgPerRound! + next.sgPerRound!) / 2);
      }
      if (peak === -Infinity) peak = Math.max(...full.map((l) => l.sgPerRound!)) - 0.25;
      cohort.push({ full: full.length, wins: ls.reduce((s, l) => s + l.wins, 0), majors: ls.reduce((s, l) => s + l.majors, 0), peak });
    }
    if (cohort.length >= 15) {
      const pct = (f: (c: (typeof cohort)[number]) => boolean) => (100 * cohort.filter(f).length) / cohort.length;
      values.neverWin = pct((c) => c.wins === 0);
      values.bustTwoSeasons = pct((c) => c.full <= 2);
      values.tenSeasons = pct((c) => c.full >= 10);
      // Data Golf's tiers put every career of two seasons or fewer in "Bust", whatever its
      // strokes gained (the tiers add up to 100%), so busts don't count towards these two.
      const lasted = (c: (typeof cohort)[number]) => c.full > 2;
      values.tierStarPlus = pct((c) => lasted(c) && (c.peak >= 1.25 || c.wins >= 5 || c.majors >= 2));
      values.tierAverage = pct((c) => lasted(c) && c.peak >= 0);
    }
  }

  return {
    seasons,
    values,
    info: {
      "Distinct winners per season": mean(winners),
      "Average winning score to par (real: -16.6 in 2017-18, lower since)": mean(winningToPar),
    },
  };
}

export interface RealismRow {
  key: MetricKey;
  label: string;
  sim: number | null;
  real: number;
  unit: string;
  close: boolean | null;
  source: string;
}

/** Each anchor against the sim: close when within its tolerance. */
export function compareToAnchors(m: RealismMetrics): RealismRow[] {
  return (Object.keys(REALISM_ANCHORS) as MetricKey[]).map((key) => {
    const a: Anchor = REALISM_ANCHORS[key];
    const sim = m.values[key];
    return {
      key,
      label: a.label,
      sim: sim === undefined || Number.isNaN(sim) ? null : sim,
      real: a.real,
      unit: a.unit,
      close: sim === undefined || Number.isNaN(sim) ? null : Math.abs(sim - a.real) <= a.tolerance,
      source: a.source,
    };
  });
}

export { RATING_PER_STROKE };

/**
 * What 10 more yards off the tee are worth, strokes a round, averaged over the
 * tour's courses: a tour-average player against the same player hitting it
 * 10 yards further (YARDS_PER_POINT yards a rating point).
 */
export function distanceValue(world: World): number {
  const base = { id: "dist", name: "dist", nationality: "USA", age: 28, peakAge: 28, form: 0, condition: 95, grassPreference: "bermuda", styleComfort: { links: 12, parkland: 12, desert: 12, resort: 12 } } as unknown as import("../engine").Player;
  const flat = Object.fromEntries(ALL_ATTRIBUTES.map((k) => [k, 12])) as import("../engine").Player["attributes"];
  const longer = { ...flat, drivingDistance: 14 };
  let gain = 0;
  for (const c of world.courses) gain += totalSg(expectedStrokesGained({ ...base, attributes: longer }, c)) - totalSg(expectedStrokesGained({ ...base, attributes: flat }, c));
  // Two points is 2 x YARDS_PER_POINT yards.
  return ((gain / world.courses.length) * 10) / (2 * YARDS_PER_POINT);
}
