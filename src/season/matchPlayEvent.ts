/**
 * The Match Play Championship, in the format the tour's WGC Match Play used
 * from 2015 to 2023: the world's top 64 are drawn into 16 groups of four (one
 * player from each band of 16 seeds), play three round-robin matches
 * Wednesday to Friday, and the 16 group winners go into a seeded knockout:
 * the last 16 and quarter-finals on Saturday, semi-finals, the final and the
 * match for third on Sunday. Knockout matches level after 18 go to sudden death.
 *
 * The result comes back as an ordinary TournamentResult (finishing places,
 * money, points) with the whole draw attached for the bracket screen. The
 * money follows the 2023 event's split, rounded (winner 17.5% of the purse).
 */
import {
  coursePar,
  createRng,
  drawWeather,
  holesWon,
  playMatch,
  type BracketRound,
  type MatchPlayBracket,
  type MatchPlayGroup,
  type MatchResult,
  type PlayerEventResult,
  type Rng,
  type RoundWeather,
  type TournamentConfig,
  type TournamentResult,
} from "../engine";

/** Share of the purse by finishing place (64 players). */
const PRIZE_SHARE: [number, number][] = [
  [1, 0.175],
  [2, 0.11],
  [3, 0.07],
  [4, 0.0565],
  [8, 0.03],
  [16, 0.0175],
  [32, 0.01],
  [48, 0.006],
  [64, 0.0045],
];
const shareFor = (position: number) => PRIZE_SHARE.find(([upTo]) => position <= upTo)?.[1] ?? 0;

const KO_NAMES: Record<number, string> = { 2: "Final", 4: "Semi-finals", 8: "Quarter-finals", 16: "Round of 16", 32: "Round of 32" };

/** Standard seeded order for a bracket of n (1 v n, then n/2 v n/2+1, ...), as slot numbers 1..n. */
export function seedOrder(n: number): number[] {
  let order = [1];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((s) => [s, size + 1 - s]);
  }
  return order;
}

/**
 * The draw: groups of four, the top seeds one per group, then one player from
 * each lower band at random. Players beyond a multiple of four (a short field) sit out.
 */
export function drawGroups(ids: string[], seed: (id: string) => number, rng: Rng): string[][] {
  const sorted = [...ids].sort((a, b) => seed(a) - seed(b) || a.localeCompare(b));
  const g = Math.floor(sorted.length / 4);
  const groups: string[][] = Array.from({ length: g }, () => []);
  for (let band = 0; band < 4; band++) {
    const pot = sorted.slice(band * g, band * g + g);
    if (band > 0) {
      for (let i = pot.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [pot[i], pot[j]] = [pot[j]!, pot[i]!];
      }
    }
    pot.forEach((id, i) => groups[i]!.push(id));
  }
  return groups;
}

export function simulateMatchPlay(config: TournamentConfig, seeds: Map<string, number>): TournamentResult {
  const rng = createRng(config.seed);
  const course = config.course;
  const byId = new Map(config.field.map((p) => [p.id, p]));
  const seed = (id: string) => seeds.get(id) ?? 9999;
  const weekForm = new Map(config.field.map((p) => [p.id, rng.normal(0, 0.4)]));
  const weather: RoundWeather[] = [];
  const dayWeather = (day: number) => (weather[day - 1] ??= drawWeather(course, rng));
  const match = (a: string, b: string, day: number, extraHoles: boolean, suddenDeath = false): MatchResult =>
    playMatch({ course, a: [byId.get(a)!], b: [byId.get(b)!], format: "singles", rng, weather: dayWeather(day), extraHoles, suddenDeath, weekForm, ...(config.tier ? { tier: config.tier } : {}), day: Math.min(4, day) });

  // ---- groups, Wednesday to Friday: 1v4 & 2v3, then 1v3 & 2v4, then 1v2 & 3v4.
  const groupIds = drawGroups(config.field.map((p) => p.id), seed, rng);
  const pairings = [
    [0, 3, 1, 2],
    [0, 2, 1, 3],
    [0, 1, 2, 3],
  ];
  const groups: MatchPlayGroup[] = groupIds.map((players) => {
    const matches: MatchResult[] = [];
    pairings.forEach((p, d) => {
      matches.push(match(players[p[0]!]!, players[p[1]!]!, d + 1, false));
      matches.push(match(players[p[2]!]!, players[p[3]!]!, d + 1, false));
    });
    const table = new Map(players.map((id) => [id, { id, points: 0, holeDiff: 0 }]));
    for (const m of matches) {
      const hw = holesWon(m);
      const ra = table.get(m.a[0]!)!;
      const rb = table.get(m.b[0]!)!;
      ra.points += m.winner === "a" ? 1 : m.winner === null ? 0.5 : 0;
      rb.points += m.winner === "b" ? 1 : m.winner === null ? 0.5 : 0;
      ra.holeDiff += hw.a - hw.b;
      rb.holeDiff += hw.b - hw.a;
    }
    const standings = [...table.values()].sort((x, y) => y.points - x.points || y.holeDiff - x.holeDiff || seed(x.id) - seed(y.id));
    // Level on points at the top: sudden death decides who goes through.
    const top = standings.filter((s) => s.points === standings[0]!.points);
    const playoff: MatchResult[] = [];
    if (top.length > 1) {
      let leader = top[0]!.id;
      for (const s of top.slice(1)) {
        const m = match(leader, s.id, 3, true, true);
        playoff.push(m);
        if (m.winner === "b") leader = s.id;
      }
      const w = standings.findIndex((s) => s.id === leader);
      standings.unshift(...standings.splice(w, 1));
    }
    return { players, matches, standings, playoff };
  });

  // ---- knockout, Saturday and Sunday: group winners seeded by group (group 1 holds the top seed).
  const winners = groups.map((g) => g.standings[0]!.id);
  let size = 1;
  while (size < winners.length) size *= 2;
  const knockout: BracketRound[] = [];
  const out = new Map<string, number>(); // player -> finishing place
  let alive: (string | null)[] = seedOrder(size).map((s) => winners[s - 1] ?? null);
  let day = 4;
  const semiLosers: string[] = [];
  while (alive.length > 1) {
    const name = KO_NAMES[alive.length] ?? `Round of ${alive.length}`;
    const matches: MatchResult[] = [];
    const next: (string | null)[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i] ?? null;
      const b = alive[i + 1] ?? null;
      if (!a || !b) {
        const through = a ?? b;
        if (through) matches.push({ format: "singles", a: [through], b: [], winner: "a", margin: "Bye", holes: [] });
        next.push(through);
        continue;
      }
      const m = match(a, b, day, true);
      matches.push(m);
      const [win, lose] = m.winner === "a" ? [a, b] : [b, a];
      next.push(win);
      if (alive.length === 4) semiLosers.push(lose);
      else if (alive.length === 2) out.set(lose, 2);
      else out.set(lose, alive.length / 2 + 1);
    }
    knockout.push({ name, matches });
    alive = next;
    // Saturday: the last 16 and quarter-finals; Sunday: semi-finals and the final.
    if (alive.length <= 4) day = 5;
  }
  if (alive[0]) out.set(alive[0], 1);
  let consolation: MatchResult | null = null;
  if (semiLosers.length === 2) {
    consolation = match(semiLosers[0]!, semiLosers[1]!, 5, true);
    out.set(consolation.winner === "a" ? semiLosers[0]! : semiLosers[1]!, 3);
    out.set(consolation.winner === "a" ? semiLosers[1]! : semiLosers[0]!, 4);
  } else for (const id of semiLosers) out.set(id, 3);
  // Out in the groups: placed by their finish in the group.
  const g = groups.length;
  for (const grp of groups) grp.standings.forEach((s, i) => (i > 0 ? out.set(s.id, g * i + 1) : undefined));
  // A short field's leftovers didn't play.
  const played = new Set(groupIds.flat());

  // ---- the leaderboard
  const par = coursePar(course);
  const parOf = (n: number) => course.holes[n % course.holes.length]!.par;
  const all: MatchResult[] = [...groups.flatMap((x) => x.matches), ...knockout.flatMap((r) => r.matches), ...(consolation ? [consolation] : [])];
  const perPlayer = new Map<string, { strokes: number[]; holes: number[][]; toPar: number }>();
  for (const id of played) perPlayer.set(id, { strokes: [], holes: [], toPar: 0 });
  for (const m of all) {
    if (!m.holes.length) continue;
    for (const side of ["a", "b"] as const) {
      const id = m[side][0];
      if (!id) continue;
      const rec = perPlayer.get(id)!;
      const holes = m.holes.map((h) => h[side]);
      rec.holes.push(holes);
      rec.strokes.push(holes.reduce((t, x) => t + x, 0));
      rec.toPar += holes.reduce((t, x, i) => t + x - parOf(i), 0);
    }
  }
  // Strokes gained against the field, per 18 holes played.
  let fieldHoles = 0;
  let fieldToPar = 0;
  for (const r of perPlayer.values()) {
    fieldHoles += r.holes.reduce((t, h) => t + h.length, 0);
    fieldToPar += r.toPar;
  }
  const fieldPerHole = fieldToPar / Math.max(1, fieldHoles);
  const counts = new Map<number, number>();
  for (const pos of out.values()) counts.set(pos, (counts.get(pos) ?? 0) + 1);
  const leaderboard: PlayerEventResult[] = [...played]
    .map((id) => {
      const rec = perPlayer.get(id)!;
      const position = out.get(id) ?? 999;
      const holes = rec.holes.reduce((t, h) => t + h.length, 0);
      const tied = (counts.get(position) ?? 1) > 1;
      return {
        player: byId.get(id)!,
        rounds: rec.strokes,
        holes: rec.holes,
        waves: rec.strokes.map(() => "AM" as const),
        total: rec.strokes.reduce((t, x) => t + x, 0),
        toPar: rec.toPar,
        madeCut: true,
        position,
        positionLabel: `${tied ? "T" : ""}${position}`,
        earnings: Math.round(config.purse * shareFor(position)),
        sg: { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 },
        sgPerRound: holes ? (fieldPerHole - rec.toPar / holes) * 18 : 0,
      };
    })
    .sort((a, b) => a.position - b.position || seed(a.player.id) - seed(b.player.id));

  const bracket: MatchPlayBracket = { seeds: Object.fromEntries([...played].map((id) => [id, seed(id)])), groups, knockout, consolation };
  return { name: config.name, course, par, weather, leaderboard, cutLine: null, playoff: null, bracket };
}

/** "Smith beats Jones 3&2 in the final", for headlines. */
export function finalLine(result: TournamentResult): string | null {
  const final = result.bracket?.knockout.at(-1)?.matches[0];
  if (!final || final.b.length === 0) return null;
  const name = (id: string) => result.leaderboard.find((r) => r.player.id === id)?.player.name ?? id;
  const [w, l] = final.winner === "a" ? [final.a[0]!, final.b[0]!] : [final.b[0]!, final.a[0]!];
  const how = final.margin.endsWith("hole") ? `at the ${final.margin}` : final.margin;
  return `${name(w)} beats ${name(l)} ${how} in the final`;
}
