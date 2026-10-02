/**
 * Highlights: the shot of the week, chosen for drama (an ace, an eagle, a
 * chip-in, a long putt holed, a closing birdie with the event on the line),
 * with your clients' shots preferred. Each keeps just enough to be replayed
 * on the shot tracer later: the player as he was, his card for the round,
 * the course, the wind and the seed name the tracer uses. The season recap
 * picks the best of them.
 */
import { traceHole, traceSeed, type Player, type PlayerEventResult, type TournamentResult } from "../engine";
import type { TourEvent, World } from "./types";

export interface Highlight {
  season: number;
  week: number;
  eventName: string;
  /** The tracer's seed name (the event's name as it was played). */
  resultName: string;
  courseId: string;
  playerId: string;
  player: Player;
  /** 0-based round and hole. */
  round: number;
  hole: number;
  card: number[];
  wind: number;
  /** Your hole-by-hole calls in that round, for an event played live. */
  calls?: (import("../engine").HoleCall | null)[];
  score: number;
  par: number;
  drama: number;
  title: string;
  text: string;
  client: boolean;
}

const KEEP = 30;
const ROUND_NAMES = ["first", "second", "third", "final"];

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${s}`;
}

function holeDrama(result: TournamentResult, row: PlayerEventResult, round: number, hole: number, client: boolean): { drama: number; title: string } | null {
  const h = result.course.holes[hole]!;
  const score = row.holes[round]![hole]!;
  const toPar = score - h.par;
  const last = round === row.holes.length - 1 && round >= 3;
  if (score === 1) return { drama: 100, title: "Hole-in-one" };
  if (toPar <= -3) return { drama: 90, title: "Albatross" };
  if (toPar === -2) return { drama: 60 + (last ? 20 : 0), title: "Eagle" };
  if (toPar !== -1) return null;
  // A birdie is worth a look only if it's special: a closing birdie by a contender
  // (anyone), or a chip-in or a long putt (clients, whose holes are traced).
  let drama = 0;
  let title = "Birdie";
  if (last && hole === result.course.holes.length - 1 && row.madeCut && row.position <= 3) {
    drama = 50;
    title = row.position === 1 ? "The winning birdie" : "Closing birdie";
  }
  if (client) {
    const wind = result.weather[round]?.windMph[row.waves[round] ?? "AM"] ?? 0;
    const trace = traceHole({ course: result.course, hole: h, score, player: row.player, windMph: wind, seed: traceSeed(result.name, row.player.id, round, hole), call: row.calls?.[round]?.[hole] ?? null, round });
    const holed = trace.shots[trace.shots.length - 1];
    const before = trace.shots[trace.shots.length - 2];
    if (holed && (holed.kind === "chip" || holed.kind === "bunker")) {
      drama = Math.max(drama, 45);
      title = holed.kind === "bunker" ? "Holed from the sand" : "Chip-in";
    } else if (holed?.kind === "putt" && (before?.feet ?? 0) >= 30) {
      drama = Math.max(drama, 35 + Math.min(20, (before!.feet! - 30) / 3));
      title = `${before!.feet}-foot putt`;
    }
  }
  return drama ? { drama, title } : null;
}

/** The best moment from a week's events (clients preferred), or null when nothing stood out. */
export function pickHighlight(world: World, results: { event: TourEvent; result: TournamentResult }[]): Highlight | null {
  let best: Highlight | null = null;
  for (const { event, result } of results) {
    if (event.tier === "dev" || result.bracket) continue;
    const winner = result.leaderboard[0];
    const rows = result.leaderboard.filter((r) => world.players[r.player.id]?.client || r === winner);
    for (const row of rows) {
      const client = !!world.players[row.player.id]?.client;
      for (let round = 0; round < row.holes.length; round++) {
        const card = row.holes[round]!;
        for (let hole = 0; hole < card.length; hole++) {
          const d = holeDrama(result, row, round, hole, client);
          if (!d) continue;
          const drama = d.drama + (client ? 25 : 0) + (event.tier === "major" ? 10 : 0);
          if (best && drama <= best.drama) continue;
          best = {
            season: world.season,
            week: world.week,
            eventName: event.name,
            resultName: result.name,
            courseId: result.course.id,
            playerId: row.player.id,
            player: structuredClone(row.player),
            round,
            hole,
            card: [...card],
            wind: result.weather[round]?.windMph[row.waves[round] ?? "AM"] ?? 0,
            ...(row.calls?.[round] ? { calls: [...row.calls[round]!] } : {}),
            score: card[hole]!,
            par: result.course.holes[hole]!.par,
            drama,
            title: d.title,
            text: `${row.player.name}: ${d.title.toLowerCase()} at the ${ordinal(hole + 1)} in the ${ROUND_NAMES[round] ?? "extra"} round of ${event.name}.`,
            client,
          };
        }
      }
    }
  }
  return best;
}

/** Keeps the week's highlight, if there was one. */
export function recordHighlight(world: World, results: { event: TourEvent; result: TournamentResult }[]): Highlight | null {
  const h = pickHighlight(world, results);
  if (!h) return null;
  const list = (world.highlights ??= []);
  list.push(h);
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
  return h;
}

export const latestHighlight = (world: World): Highlight | null => world.highlights?.at(-1) ?? null;

/** A season's best moments, most dramatic first. */
export function seasonHighlights(world: World, season: number, n = 5): Highlight[] {
  return (world.highlights ?? []).filter((h) => h.season === season).sort((a, b) => b.drama - a.drama).slice(0, n);
}

/** What the shot tracer needs to replay a highlight: a one-player result and his row. */
export function highlightReplay(world: World, h: Highlight): { result: TournamentResult; row: PlayerEventResult } | null {
  const course = world.courses.find((c) => c.id === h.courseId);
  if (!course) return null;
  const weather = Array.from({ length: h.round + 1 }, () => ({ windMph: { AM: h.wind, PM: h.wind } }));
  const holes = Array.from({ length: h.round + 1 }, (_, i) => (i === h.round ? h.card : []));
  const row = {
    player: h.player,
    rounds: [],
    holes,
    waves: holes.map(() => "AM"),
    total: 0,
    toPar: 0,
    madeCut: true,
    position: 1,
    positionLabel: "",
    earnings: 0,
    sg: { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 },
    sgPerRound: 0,
    ...(h.calls ? { calls: holes.map((_, i) => (i === h.round ? h.calls! : [])) } : {}),
  } as unknown as PlayerEventResult;
  const result = { name: h.resultName, course, par: 0, weather, leaderboard: [row], cutLine: null, playoff: null } as unknown as TournamentResult;
  return { result, row };
}
