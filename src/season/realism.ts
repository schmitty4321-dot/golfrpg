/**
 * The realism report: plays seasons and measures the simulation against
 * real golf, mostly Data Golf (datagolf.com), so every change to the sim
 * shows whether it made the game more or less like the PGA TOUR.
 *
 * Strokes gained are per round against the field. One point of overall
 * rating is about 0.46 strokes a round (measured in this engine, 2026-09-30),
 * so Data Golf's strokes convert to ratings at about 2.17 points per stroke.
 */
import { careerLines } from "./charts";
import { seasonVsReal } from "./courseSetup";
import { overall } from "./development";
import { finishSeason } from "./world";
import { seasonWeeks } from "./calendar";
import { playWeek } from "./week";
import type { SeasonLine, World } from "./types";

const RATING_PER_STROKE = 1 / 0.46;

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
  age23to25: { label: "Change a year, ages 23-25", real: 0.12, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, 98 players' strokes gained by age (2026), converted" },
  age26to28: { label: "Change a year, ages 26-28", real: 0.27, tolerance: 0.2, unit: "overall/yr", source: "Data Golf profiles, as above" },
  age29to31: { label: "Change a year, ages 29-31", real: -0.15, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, as above" },
  age32to34: { label: "Change a year, ages 32-34", real: -0.16, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, as above" },
  age35to37: { label: "Change a year, ages 35-37", real: -0.15, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, as above" },
  age38to41: { label: "Change a year, ages 38-41", real: -0.25, tolerance: 0.15, unit: "overall/yr", source: "Data Golf profiles, as above" },
  neverWin: { label: "Rookies who never win", real: 65, tolerance: 12, unit: "%", source: "Data Golf careers: 205 PGA TOUR rookies, 1990-2014 debuts" },
  bustTwoSeasons: { label: "Rookies with 2 or fewer full seasons", real: 31, tolerance: 12, unit: "%", source: "Data Golf careers, as above (players with 25+ starts; the true rate is higher)" },
  tenSeasons: { label: "Rookies with 10+ full seasons", real: 33, tolerance: 12, unit: "%", source: "Data Golf careers, as above" },
  tierStarPlus: { label: "Rookies who become stars or legends", real: 12, tolerance: 7, unit: "%", source: "Data Golf careers: peak 2-season SG +1.25 or better, or 5+ wins" },
  tierAverage: { label: "Rookies who peak as average tour pros or better", real: 46, tolerance: 15, unit: "%", source: "Data Golf careers: peak 2-season SG 0 or better" },
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
  const ageDeltas = new Map<MetricKey, number[]>();
  const lines = new Map<string, (SeasonLine & { current: boolean })[]>();
  const firstSeason = world.season;

  for (let s = 0; s < seasons; s++) {
    const start = new Map(Object.values(world.players).filter((wp) => wp.career.status !== "amateur").map((wp) => [wp.player.id, { age: wp.player.age, level: overall(wp.player) }]));
    const won = new Set<string>();
    while (world.week <= seasonWeeks(world)) {
      const report = playWeek(world);
      for (const x of report.results) {
        if (x.event.tier === "dev") continue;
        const board = x.result.leaderboard;
        const rounds = Math.max(...board.map((e) => e.rounds.length));
        for (let r = 0; r < rounds; r++) {
          const scores = board.filter((e) => e.rounds.length > r).map((e) => e.rounds[r]!);
          const field = mean(scores);
          for (const e of board) if (e.rounds.length > r) (roundSg.get(e.player.id) ?? roundSg.set(e.player.id, []).get(e.player.id)!).push(field - e.rounds[r]!);
        }
        const w = board[0]!;
        won.add(w.player.id);
        winningToPar.push(w.toPar);
        winnerSg.push(w.sgPerRound);
      }
    }
    winners.push(won.size);
    const v = seasonVsReal(world);
    if (v !== null) vsReal.push(v);
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
      values.tierStarPlus = pct((c) => c.peak >= 1.25 || c.wins >= 5 || c.majors >= 2);
      values.tierAverage = pct((c) => c.peak >= 0);
    }
  }

  return {
    seasons,
    values,
    info: {
      "Distinct winners per season": mean(winners),
      "Average winning score to par": mean(winningToPar),
      "Winner's strokes gained per round": mean(winnerSg),
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
