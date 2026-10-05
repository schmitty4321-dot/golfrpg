/**
 * Brand partnerships with goals: most of the fee is guaranteed and paid by the
 * week (65%); the rest comes as bonuses at season end, one per goal the agency's
 * clients hit. Each category wants different things (an equipment brand wants
 * wins and long drives, a bank wants steady earners), and the targets are set
 * when the offer is made, to the size and standing of the agency: a small
 * agency is asked for top-10s, a powerhouse for wins. A brand whose goals were
 * mostly met comes back with a bigger offer; one left disappointed doesn't call.
 */
import { clients } from "./agency";
import { agencyProfit } from "./business";
import { investmentsOf } from "./investments";
import { pointsList } from "./points";
import { isRyderCupSeason } from "./ryderCup";
import { followers } from "./showcase";
import { statsRows } from "./stats";
import type { BrandDeal, SeasonStats, SponsorCategory, World, WorldPlayer } from "./types";

/** Share of the headline fee that is guaranteed; the goals share BONUS_POOL more. */
export const BASE_SHARE = 0.65;
export const BONUS_POOL = 0.65;
/** How a brand reacts next time: met this share of its goals and it comes back for more; below the floor, it won't call. */
export const RENEW_AT = 0.75;
export const SNUB_BELOW = 0.25;
export const RENEW_RAISE = 1.15;
/** Reputation from which brands ask for wins rather than contending. */
export const POWERHOUSE = 70;

export interface BrandGoal {
  id: string;
  label: string;
  /** Share of the headline fee paid when it's met. */
  share: number;
  /** What it takes (a count, an amount, a percentage, or the rank to reach). */
  target: number;
  /** Already met this season (announced once). */
  hit?: boolean;
}

/** What the season has counted that the stats don't keep. */
export interface BrandTally {
  season: number;
  partyHole?: boolean;
  hometown?: boolean;
  ryder?: boolean;
  boldHeld?: number;
  /** Each client's followers when the season (or his time with you) began. */
  followers0?: Record<string, number>;
}

export type GoalUnit = "count" | "money" | "pct" | "yards" | "rank";

interface GoalDef {
  category: SponsorCategory;
  weight: number;
  unit?: GoalUnit;
  /** The target for this agency, set when the offer is made. */
  target: (w: World) => number;
  label: (target: number) => string;
  /** Where the season stands (for a rank, the best rank so far; null for none yet). */
  now: (w: World, deal: BrandDeal) => number | null;
  /** Whether the roster and season make it possible at all; if not, the fallback stands in. */
  fits?: (w: World) => boolean;
  fallback?: string;
}

// ---------------------------------------------------------------- what the season holds

const thisSeason = (wp: WorldPlayer, w: World) => wp.career.results.filter((r) => r.season === w.season && r.tier !== "dev");
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const best = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);
const roster = (w: World) => Math.max(1, w.clientIds.length);
const strong = (w: World) => w.agency.reputation >= POWERHOUSE;
const count = (w: World, f: (r: WorldPlayer["career"]["results"][number]) => boolean) => sum(clients(w).map((wp) => thisSeason(wp, w).filter(f).length));
const money = (n: number) => (n >= 1e6 ? `$${Math.round(n / 1e5) / 10}M` : `$${Math.round(n / 1000)}k`);
const nth = (n: number) => (n === 1 ? "the lead" : `the top ${n}`);

/** A client's rank on a tour stat this season (1 best), among players with enough of it. */
function statRank(w: World, id: string, value: (s: SeasonStats) => number | null): number | null {
  const rows = statsRows(w, "this")
    .map((r) => ({ id: r.id, v: value(r.stats) }))
    .filter((r): r is { id: string; v: number } => r.v !== null);
  const me = rows.find((r) => r.id === id);
  return me ? 1 + rows.filter((r) => r.v > me.v).length : null;
}
const driveAvg = (s: SeasonStats) => (s.shots.drives >= 60 ? s.shots.driveYards / s.shots.drives : null);
const girPct = (s: SeasonStats) => (s.rounds >= 20 && s.shots.holes ? s.shots.gir / s.shots.holes : null);
const bestRank = (w: World, f: (id: string) => number | null) => {
  const ranks = w.clientIds.map(f).filter((r): r is number => r !== null);
  return ranks.length ? Math.min(...ranks) : null;
};
function bestPointsRank(w: World): number | null {
  const list = pointsList(w);
  const ranks = w.clientIds.map((id) => list.indexOf(id)).filter((i) => i >= 0).map((i) => i + 1);
  return ranks.length ? Math.min(...ranks) : null;
}

export const tallyOf = (w: World): BrandTally => {
  const t = w.agency.brandTally;
  if (t?.season === w.season) return t;
  return (w.agency.brandTally = { season: w.season });
};

/** A client's followers when this season began (or when he joined). */
function followersAtStart(w: World, wp: WorldPlayer): number {
  const base = (tallyOf(w).followers0 ??= {});
  return (base[wp.player.id] ??= followers(w, wp));
}
const growth = (w: World, list: WorldPlayer[]) => {
  const start = sum(list.map((wp) => followersAtStart(w, wp)));
  return start ? Math.round(((sum(list.map((wp) => followers(w, wp))) - start) / start) * 100) : 0;
};

// ---------------------------------------------------------------- the goals

export const GOALS: Record<string, GoalDef> = {
  // Equipment
  "eq-loyalty": {
    category: "equipment", weight: 20, target: () => 2, label: (t) => `Brand loyalty: ${t} clients carrying the brand's clubs`,
    now: (w, d) => clients(w).filter((wp) => wp.client!.sponsors.some((s) => s.category === "equipment" && s.sponsor === d.brand)).length,
    fits: (w) => w.clientIds.length >= 2, fallback: "eq-win",
  },
  "eq-win": { category: "equipment", weight: 25, target: () => 1, label: () => "Tour wins: a win by any client", now: (w) => count(w, (r) => r.position === 1) },
  "eq-major": {
    category: "equipment", weight: 40, target: (w) => (strong(w) ? 1 : 10), label: (t) => (t === 1 ? "Major glory: a client wins a major" : `Major glory: a client finishes in the top ${t} at a major`),
    now: (w) => { const r = bestRank(w, (id) => { const xs = thisSeason(w.players[id]!, w).filter((x) => x.tier === "major" && x.madeCut).map((x) => x.position); return xs.length ? Math.min(...xs) : null; }); return r; },
    unit: "rank",
  },
  "eq-long": { category: "equipment", weight: 10, unit: "rank", target: (w) => (strong(w) ? 20 : 40), label: (t) => `Long ball: a client in ${nth(t)} for driving distance`, now: (w) => bestRank(w, (id) => statRank(w, id, driveAvg)) },
  "eq-sg": {
    category: "equipment", weight: 15, unit: "rank", target: (w) => (strong(w) ? 1 : 10), label: (t) => `Stats leader: a client in ${nth(t)} of a strokes-gained category`,
    now: (w) => bestRank(w, (id) => Math.min(...(["offTheTee", "approach", "aroundTheGreen", "putting"] as const).map((k) => statRank(w, id, (s) => (s.rounds >= 30 ? s.sg[k] / s.rounds : null)) ?? 9999))),
  },
  // Apparel
  "ap-top10": { category: "apparel", weight: 20, target: (w) => Math.max(2, Math.round(roster(w) * (strong(w) ? 1.2 : 0.7))), label: (t) => `Sunday exposure: ${t} top-10 finishes across your clients`, now: (w) => count(w, (r) => r.madeCut && r.position <= 10) },
  "ap-top5": { category: "apparel", weight: 20, target: (w) => Math.max(1, Math.round(roster(w) * (strong(w) ? 0.6 : 0.3))), label: (t) => `On camera: ${t} top-5 finish${t === 1 ? "" : "es"}`, now: (w) => count(w, (r) => r.madeCut && r.position <= 5) },
  "ap-fans": { category: "apparel", weight: 15, unit: "pct", target: () => 10, label: (t) => `Fan growth: clients' followers up ${t}%`, now: (w) => growth(w, clients(w)) },
  "ap-ryder": { category: "apparel", weight: 25, target: () => 1, label: () => "Ryder Cup kit: a client makes the Ryder Cup team", now: (w) => (tallyOf(w).ryder ? 1 : 0), fits: (w) => isRyderCupSeason(w.season), fallback: "ap-points" },
  "ap-points": { category: "apparel", weight: 25, unit: "rank", target: (w) => (strong(w) ? 50 : 100), label: (t) => `Points push: a client in the points list's top ${t}`, now: (w) => bestPointsRank(w) },
  // Watch
  "wa-timeless": {
    category: "watch", weight: 15, target: () => 10, label: (t) => `Timeless: a client aged 40+ makes ${t} cuts`,
    now: (w) => best(clients(w).filter((wp) => wp.player.age >= 40).map((wp) => thisSeason(wp, w).filter((r) => r.madeCut).length)),
    fits: (w) => clients(w).some((wp) => wp.player.age >= 38), fallback: "wa-cuts",
  },
  "wa-cuts": { category: "watch", weight: 15, target: () => 12, label: (t) => `Like clockwork: a client makes ${t} cuts`, now: (w) => best(clients(w).map((wp) => thisSeason(wp, w).filter((r) => r.madeCut).length)) },
  "wa-gir": { category: "watch", weight: 15, unit: "rank", target: (w) => (strong(w) ? 10 : 30), label: (t) => `Precision: a client in ${nth(t)} for greens in regulation`, now: (w) => bestRank(w, (id) => statRank(w, id, girPct)) },
  "wa-stage": {
    category: "watch", weight: 30, unit: "rank", target: (w) => (strong(w) ? 1 : 10), label: (t) => (t === 1 ? "Big stage: a client wins a major or a signature event" : `Big stage: a client in the top ${t} at a major or signature event`),
    now: (w) => bestRank(w, (id) => { const xs = thisSeason(w.players[id]!, w).filter((x) => (x.tier === "major" || x.tier === "signature") && x.madeCut).map((x) => x.position); return xs.length ? Math.min(...xs) : null; }),
  },
  "wa-prestige": { category: "watch", weight: 20, target: (w) => Math.min(90, Math.round(w.agency.reputation) + 4), label: (t) => `Prestige: agency reputation ${t} at season end`, now: (w) => Math.round(w.agency.reputation) },
  // Financial
  "fi-earners": { category: "financial", weight: 20, unit: "money", target: (w) => Math.round((roster(w) * (strong(w) ? 2_000_000 : 900_000)) / 100_000) * 100_000, label: (t) => `Earners: ${money(t)} in prize money across your clients`, now: (w) => sum(clients(w).map((wp) => sum(thisSeason(wp, w).map((r) => r.earnings)))) },
  "fi-profit": { category: "financial", weight: 20, unit: "money", target: () => 1, label: () => "Steady hands: the agency makes a profit this season", now: (w) => Math.max(0, agencyProfit(w.agency.ledger)) },
  "fi-consistent": {
    category: "financial", weight: 15, unit: "pct", target: () => 70, label: (t) => `Consistency: a client makes ${t}% of his cuts (15+ events)`,
    now: (w) => best(clients(w).map((wp) => { const r = thisSeason(wp, w); return r.length >= 15 ? Math.round((r.filter((x) => x.madeCut).length / r.length) * 100) : 0; })),
  },
  "fi-top30": { category: "financial", weight: 25, unit: "rank", target: (w) => (strong(w) ? 30 : 70), label: (t) => `Top of the list: a client in the points list's top ${t}`, now: (w) => bestPointsRank(w) },
  "fi-charity": { category: "financial", weight: 10, target: () => 1, label: () => "Philanthropy: the agency runs a charitable foundation", now: (w) => (investmentsOf(w).some((i) => i.kind === "foundation") ? 1 : 0) },
  // Automotive
  "au-ace": { category: "automotive", weight: 20, target: () => 1, label: () => "Hole-in-one: any client makes an ace", now: (w) => (w.highlights ?? []).filter((h) => h.season === w.season && w.clientIds.includes(h.playerId) && h.score === 1).length },
  "au-power": { category: "automotive", weight: 15, unit: "yards", target: (w) => (strong(w) ? 310 : 300), label: (t) => `Horsepower: a client averages ${t} yards off the tee`, now: (w) => Math.round(best(clients(w).map((wp) => (wp.career.stats?.season === w.season ? driveAvg(wp.career.stats) ?? 0 : 0)))) },
  "au-road": { category: "automotive", weight: 15, target: (w) => roster(w) * 16, label: (t) => `Road warrior: ${t} events played across your clients`, now: (w) => count(w, () => true) },
  "au-wins": { category: "automotive", weight: 30, target: (w) => (strong(w) ? 2 : 1), label: (t) => `Victory lap: ${t} win${t === 1 ? "" : "s"} across your clients`, now: (w) => count(w, (r) => r.position === 1) },
  // Beverage
  "bv-favourite": {
    category: "beverage", weight: 15, unit: "pct", target: () => 15, label: (t) => `Fan favourite: your best-followed client grows his fans ${t}%`,
    now: (w) => { const top = clients(w).sort((a, b) => followersAtStart(w, b) - followersAtStart(w, a))[0]; return top ? growth(w, [top]) : 0; },
  },
  "bv-party": { category: "beverage", weight: 15, target: () => 1, label: () => "Party hole: a client birdies TPC Scottsdale's 16th", now: (w) => (tallyOf(w).partyHole ? 1 : 0) },
  "bv-events": { category: "beverage", weight: 20, target: () => 2, label: (t) => `Out with the fans: hold ${t} agency events (clinic, pro-am, exhibition)`, now: (w) => (w.agency.eventsHeld?.[w.season] ?? []).length },
  "bv-press": { category: "beverage", weight: 15, target: () => 3, label: (t) => `Press darling: ${t} bold press answers that hold up`, now: (w) => tallyOf(w).boldHeld ?? 0 },
  "bv-home": { category: "beverage", weight: 25, target: () => 1, label: () => "Hometown hero: a client wins in his home country", now: (w) => (tallyOf(w).hometown ? 1 : 0) },
};

const ORDER: Record<SponsorCategory, string[]> = {
  equipment: ["eq-loyalty", "eq-win", "eq-major", "eq-long", "eq-sg"],
  apparel: ["ap-top10", "ap-top5", "ap-fans", "ap-ryder"],
  watch: ["wa-timeless", "wa-gir", "wa-stage", "wa-prestige"],
  financial: ["fi-earners", "fi-profit", "fi-consistent", "fi-top30", "fi-charity"],
  automotive: ["au-ace", "au-power", "au-road", "au-wins"],
  beverage: ["bv-favourite", "bv-party", "bv-events", "bv-press", "bv-home"],
};

/** This season's goals for a category, fitted to the roster and sized to the agency, sharing the bonus pool by weight. */
export function goalsFor(w: World, category: SponsorCategory): BrandGoal[] {
  const picked: string[] = [];
  for (const id of ORDER[category]) {
    const def = GOALS[id]!;
    const g = def.fits && !def.fits(w) ? def.fallback! : id;
    if (!picked.includes(g)) picked.push(g);
  }
  const total = sum(picked.map((g) => GOALS[g]!.weight));
  return picked.map((g) => {
    const def = GOALS[g]!;
    const target = def.target(w);
    return { id: g, label: def.label(target), target, share: Math.round((def.weight / total) * BONUS_POOL * 100) / 100 };
  });
}

/** Where each goal stands right now. For a rank, lower is better and `now` is the best rank so far (0: none yet). */
export function brandGoalProgress(w: World, deal: BrandDeal): (BrandGoal & { now: number; unit: GoalUnit; met: boolean })[] {
  return (deal.goals ?? []).map((g) => {
    const def = GOALS[g.id];
    const unit = def?.unit ?? "count";
    const raw = def?.now(w, deal) ?? null;
    const now = raw ?? 0;
    const met = unit === "rank" ? raw !== null && raw <= g.target : now >= g.target;
    return { ...g, now, unit, met };
  });
}

/** The most a deal can pay this season. */
export const maxPayout = (deal: BrandDeal): number => (deal.goals ? Math.round(deal.annual * (BASE_SHARE + sum(deal.goals.map((g) => g.share)))) : deal.annual);
/** The guaranteed part, paid by the week. */
export const guaranteed = (deal: BrandDeal): number => (deal.goals ? Math.round(deal.annual * BASE_SHARE) : deal.annual);

/** Weekly: announce goals as they're reached. */
export function brandGoalsWeek(w: World): void {
  for (const c of clients(w)) followersAtStart(w, c);
  for (const deal of w.agency.brands ?? []) {
    for (const g of brandGoalProgress(w, deal)) {
      if (!g.met || g.hit) continue;
      deal.goals!.find((x) => x.id === g.id)!.hit = true;
      w.news.unshift(`${deal.brand} goal reached: ${g.label.split(":")[0]}. Worth ${Math.round((g.share * deal.annual) / 1000)}k at season end.`);
    }
  }
}

/** Season end: bonuses for the goals met, the brand's verdict remembered, and next season's goals set. */
export function settleBrandGoals(w: World): void {
  for (const deal of w.agency.brands ?? []) {
    if (!deal.goals) continue;
    const progress = brandGoalProgress(w, deal);
    const met = progress.filter((g) => g.met);
    const bonus = Math.round(sum(met.map((g) => g.share)) * deal.annual);
    if (bonus) {
      w.agency.bank += bonus;
      w.agency.ledger.brandBonuses = (w.agency.ledger.brandBonuses ?? 0) + bonus;
    }
    (w.agency.brandHistory ??= {})[deal.brand] = progress.length ? met.length / progress.length : 0;
    w.news.unshift(`${deal.brand}: ${met.length} of ${progress.length} goals met${bonus ? `, a ${Math.round(bonus / 1000)}k bonus` : ""}.`);
    // A deal running on into next season gets next season's goals.
    if (deal.untilSeason > w.season) deal.goals = goalsFor(w, deal.category);
  }
}

/** How a brand feels about the agency from last time: undefined (never worked together), or the share of goals met. */
export const brandMood = (w: World, brand: string): number | undefined => w.agency.brandHistory?.[brand];

/** Called by the result loop: the checks the season's stats can't make afterwards. */
export function noteBrandResult(w: World, wp: WorldPlayer, courseId: string, courseCountry: string, holes: number[][], position: number, nationKeys: string[]): void {
  if (!wp.client) return;
  const t = tallyOf(w);
  // TPC Scottsdale's 16th is a par 3: a birdie is a 2 or better.
  if (courseId === "tpc-scottsdale" && holes.some((r) => r.length >= 16 && r[15]! <= 2)) t.partyHole = true;
  if (position === 1 && nationKeys.includes(courseCountry)) t.hometown = true;
}
export const noteRyderTeam = (w: World, teamIds: Iterable<string>): void => {
  for (const id of teamIds) if (w.clientIds.includes(id)) tallyOf(w).ryder = true;
};
export const noteBoldHeld = (w: World): void => {
  const t = tallyOf(w);
  t.boldHeld = (t.boldHeld ?? 0) + 1;
};
