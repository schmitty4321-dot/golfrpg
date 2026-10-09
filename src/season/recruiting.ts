/**
 * Recruiting amateurs, college-football style. Each week the agency has a
 * budget of hours to spend on prospects: watching film and going to their
 * events sharpens your read of them (never to an exact number), calls, visits
 * and pitches build their interest in you. Interest makes a "yes" likelier,
 * a prospect near turning pro names the three agencies he's considering, and
 * on signing day (the season's end) he commits to his favourite. Pipelines
 * from schools and states you've signed from, relationships with college
 * coaches and the academy give a head start; some prospects have
 * dealbreakers, and each season's class is ranked against the rivals'.
 */
import { ATTRIBUTE_GROUPS, clamp, createRng, type AttributeKey } from "../engine";
import { addReputation, clients, marketRate, rosterCount, rosterLimit, signClient, RIVAL_AGENCIES } from "./agency";
import { PRO_AGE, amateurRanking } from "./amateurs";
import { mixSeed } from "./entries";
import { stafferQuality } from "./market";
import { rankMap } from "./points";
import { schoolOf } from "./schools";
import { scoutedAttribute } from "./scouting";
import { absWeek, type World, type WorldPlayer } from "./types";
import { ROOKIE_SEASONS, makeRookieDeal } from "./extensions";

// ---------------------------------------------------------------- the weekly budget

/** Hours a week: more with a bigger headquarters and a better agent. */
export const weeklyHours = (world: World): number => Math.round(30 + (world.agency.hq ?? 0) * 5 + stafferQuality(world, "agent") * 0.5);

export interface RecruitingState {
  absWeek: number;
  hoursUsed: number;
  /** This week's hours by kind of prospect (the weekly checklist reads these). */
  kindHours?: { amateur: number; pro: number };
  showcaseSeason?: number;
  /** Visits and signings with each college's coach (a relationship). */
  coaches?: Record<string, number>;
  /** Clients signed from each school and home state (pipelines). */
  pipelines?: { schools: Record<string, number>; states: Record<string, number> };
  /** Prospects signed in each season (your recruiting class). */
  classes?: Record<number, string[]>;
  /** The rivals' recruiting, by prospect. */
  rivals?: Record<string, RivalRecruiting>;
  /** Last season's class rankings: agency and score, best first. */
  lastRanking?: { season: number; rows: { agency: string; score: number; signed: number }[] };
}

/** What the rival agencies are doing with each prospect: their interest, and their latest moves. */
export interface RivalRecruiting {
  interest: Record<string, number>;
  moves: { agency: string; text: string; absWeek: number }[];
}

export interface Prospect {
  interest: number;
  /** Absolute weeks of the last call and pitch (once a week each). */
  called?: number;
  pitched?: number;
  /** The season of his visit (once a season). */
  visited?: number;
  /** Talked to him enough to know what he cares about. */
  known?: boolean;
  /** The season you talked to a pro's caddie and coach. */
  teamSeason?: number;
}

export const recruitingOf = (world: World): RecruitingState => {
  const now = absWeek(world.season, world.week);
  const r = (world.agency.recruiting ??= { absWeek: now, hoursUsed: 0 });
  if (r.absWeek !== now) {
    r.absWeek = now;
    r.hoursUsed = 0;
    r.kindHours = { amateur: 0, pro: 0 };
  }
  return r;
};

/** This week's recruiting hours on amateurs and on pros: what the weekly checklist ticks off. */
export const spentThisWeek = (world: World): { amateur: number; pro: number } => {
  const r = recruitingOf(world);
  return r.kindHours ?? { amateur: 0, pro: 0 };
};
export const hoursLeft = (world: World): number => Math.max(0, weeklyHours(world) - recruitingOf(world).hoursUsed);

// ---------------------------------------------------------------- who and what

const idHash = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
const rngFor = (world: World, id: string, salt: number) => createRng(mixSeed(world.seed, idHash(id), salt));

/** The prospects worth recruiting: the amateurs, best ranked first. */
export const prospects = (world: World): string[] => amateurRanking(world).filter((id) => !world.players[id]?.client);

/** Pros worth recruiting: the best ranked players you don't represent (under contract elsewhere or not). */
export function proProspects(world: World, n = 60): string[] {
  const ranks = rankMap(world);
  return Object.values(world.players)
    .filter((wp) => !wp.client && wp.career.status !== "amateur" && ranks.has(wp.player.id))
    .sort((a, b) => ranks.get(a.player.id)! - ranks.get(b.player.id)!)
    .slice(0, n)
    .map((wp) => wp.player.id);
}

export const isPro = (world: World, id: string): boolean => world.players[id]?.career.status !== "amateur";

/** Stars: an amateur by the amateur ranking, a pro by the world ranking. */
export function stars(world: World, id: string): number {
  if (isPro(world, id)) {
    const r = rankMap(world).get(id) ?? 999;
    return r <= 10 ? 5 : r <= 30 ? 4 : r <= 75 ? 3 : r <= 150 ? 2 : 1;
  }
  const i = amateurRanking(world).indexOf(id);
  if (i < 0) return 1;
  return i < 5 ? 5 : i < 20 ? 4 : i < 45 ? 3 : i < 70 ? 2 : 1;
}

// ---------------------------------------------------------------- selling points

export type SellingPoint = "reputation" | "development" | "sponsors" | "stars" | "headquarters";
export const SELLING_POINTS: Record<SellingPoint, string> = {
  reputation: "The agency's name",
  development: "Player development",
  sponsors: "Sponsor deals",
  stars: "Star clients",
  headquarters: "Facilities",
};
export type Grade = "A" | "B" | "C" | "D" | "F";
const GRADE_POINTS: Record<Grade, number> = { A: 6, B: 4, C: 2, D: 0, F: -2 };

/** How the agency grades on each thing prospects care about. */
export function grades(world: World): Record<SellingPoint, Grade> {
  const rep = world.agency.reputation;
  const ranks = rankMap(world);
  const best = Math.min(999, ...clients(world).map((wp) => ranks.get(wp.player.id) ?? 999));
  const brands = (world.agency.brands ?? []).length + clients(world).reduce((s, wp) => s + wp.client!.sponsors.length, 0) / 3;
  const tier = (n: number): Grade => (["D", "C", "B", "A"] as Grade[])[clamp(n, 0, 3)]!;
  return {
    reputation: rep >= 75 ? "A" : rep >= 60 ? "B" : rep >= 45 ? "C" : rep >= 30 ? "D" : "F",
    development: tier(world.agency.center ?? 0),
    sponsors: brands >= 4 ? "A" : brands >= 2.5 ? "B" : brands >= 1 ? "C" : brands > 0 ? "D" : "F",
    stars: best <= 10 ? "A" : best <= 30 ? "B" : best <= 75 ? "C" : best <= 150 ? "D" : "F",
    headquarters: tier(world.agency.hq ?? 0),
  };
}

/** The two things a prospect cares about most (fixed by who he is). */
export function priorities(world: World, id: string): SellingPoint[] {
  const all = Object.keys(SELLING_POINTS) as SellingPoint[];
  const rng = rngFor(world, id, 5101);
  const first = all.splice(rng.int(0, all.length - 1), 1)[0]!;
  return [first, all[rng.int(0, all.length - 1)]!];
}

// ---------------------------------------------------------------- dealbreakers

export type Dealbreaker = "top10" | "center" | "rep50";
export const DEALBREAKERS: Record<Dealbreaker, string> = {
  top10: "Only an agency with a client in the world top 10",
  center: "Only an agency with a Performance Center",
  rep50: "Only an agency with a reputation of 50 or more",
};
/** About one prospect in five won't consider an agency without something. */
export function dealbreaker(world: World, id: string): Dealbreaker | null {
  const rng = rngFor(world, id, 5102);
  if (!rng.chance(0.2)) return null;
  return rng.pick(["top10", "center", "rep50"] as const);
}
export function dealbreakerMet(world: World, d: Dealbreaker | null): boolean {
  if (!d) return true;
  if (d === "rep50") return world.agency.reputation >= 50;
  if (d === "center") return (world.agency.center ?? 0) >= 1;
  const ranks = rankMap(world);
  return clients(world).some((wp) => (ranks.get(wp.player.id) ?? 999) <= 10);
}

// ---------------------------------------------------------------- interest

/** Your head start with a prospect: pipelines from his school and state, his coach, the academy. */
export function headStart(world: World, wp: WorldPlayer): { total: number; notes: string[] } {
  const r = recruitingOf(world);
  const s = schoolOf(world, wp);
  const notes: string[] = [];
  let total = 0;
  if (s?.kind === "college" || s?.kind === "high") {
    const school = s.kind === "college" ? r.pipelines?.schools[s.name] ?? 0 : 0;
    const state = s.state ? r.pipelines?.states[s.state] ?? 0 : 0;
    if (school) { total += Math.min(15, 5 * school); notes.push(`Pipeline from ${s.kind === "college" ? s.name : ""}`.trim()); }
    if (state) { total += Math.min(10, 3 * state); notes.push(`Pipeline in ${s.state}`); }
    const coach = s.kind === "college" ? r.coaches?.[s.name] ?? 0 : 0;
    if (coach) { total += Math.min(10, 2 * coach); notes.push(`Good relations with the ${s.kind === "college" ? s.name : ""} coach`); }
  }
  if (wp.academy) { total += 30; notes.push("Came through your academy"); }
  return { total, notes };
}

export function prospectOf(world: World, id: string): Prospect {
  const all = (world.agency.prospects ??= {});
  if (!all[id]) all[id] = { interest: clamp(10 + headStart(world, world.players[id]!).total, 0, 100) };
  return all[id]!;
}
/** Interest without creating a record (for lists). */
export const interestIn = (world: World, id: string): number =>
  world.agency.prospects?.[id]?.interest ?? clamp(10 + headStart(world, world.players[id]!).total, 0, 100);

/** Interest as signing odds: score points for acceptChance (only for prospects you've worked on). */
export function interestBonus(world: World, id: string): number {
  const p = world.agency.prospects?.[id];
  if (!p) return 0;
  return (p.interest - 40) * 0.12 - (dealbreakerMet(world, dealbreaker(world, id)) ? 0 : 8);
}

/** The interest at which a pro you've worked on takes your call first. */
export const FIRST_CALL = 60;

/**
 * The mark on a prospect on the desk: none if you haven't worked on him, recruiting once you have,
 * and keen once his interest reaches the first-call level (amateurs and pros alike).
 */
export type RecruitMark = "none" | "recruiting" | "keen";

export function recruitMark(world: World, id: string): RecruitMark {
  const p = world.agency.prospects?.[id];
  if (!p) return "none";
  return p.interest >= FIRST_CALL ? "keen" : "recruiting";
}

/**
 * First call: a pro this keen on you, whose deal is up (or who has no agent),
 * hears you out before the winter market, so rival bids and his current
 * agency don't count against you.
 */
export function firstCall(world: World, id: string): boolean {
  const wp = world.players[id];
  const p = world.agency.prospects?.[id];
  if (!wp || wp.client || !p || wp.career.status === "amateur") return false;
  if (wp.agent && wp.agent.untilSeason > world.season) return false;
  return p.interest >= FIRST_CALL && dealbreakerMet(world, dealbreaker(world, id));
}

/**
 * How far over his going rate a keen pro will go without it costing you:
 * nothing at interest 50, two points of commission at 75 and above.
 */
export function commissionGrace(world: World, id: string): number {
  const p = world.agency.prospects?.[id];
  if (!p || !isPro(world, id) || !dealbreakerMet(world, dealbreaker(world, id))) return 0;
  return Math.round(clamp((p.interest - 50) / 25, 0, 1) * 0.02 * 1000) / 1000;
}

// ---------------------------------------------------------------- his list of agencies

/** The agencies he's considering, best first, with how keen he is on each (rivals by their name and a little luck). */
export function agencyList(world: World, id: string): { agency: string; interest: number; you: boolean }[] {
  const theirs = rivalInterest(world, id);
  const rows = Object.entries(theirs).map(([agency, v]) => ({ agency, interest: Math.round(v), you: false }));
  const mine = dealbreakerMet(world, dealbreaker(world, id)) ? interestIn(world, id) : Math.min(interestIn(world, id), 30);
  rows.push({ agency: world.agency.name, interest: Math.round(mine), you: true });
  return rows.sort((a, b) => b.interest - a.interest || (a.you ? -1 : 1));
}

/** In his final amateur season he narrows it to three. */
export const narrowing = (wp: WorldPlayer): boolean => wp.career.status === "amateur" && wp.player.age + 1 >= PRO_AGE;
export const topThree = (world: World, id: string) => agencyList(world, id).slice(0, 3);

/** Why you can't sign him (his list doesn't include you), or null. */
export function recruitBlock(world: World, id: string): string | null {
  const wp = world.players[id];
  if (!wp || !narrowing(wp) || !world.agency.prospects?.[id]) return null;
  const top = topThree(world, id);
  if (top.some((t) => t.you)) return null;
  return `He's narrowed his list to ${top.map((t) => t.agency).join(", ")}.`;
}

// ---------------------------------------------------------------- spending hours

/**
 * Amateurs and pros are worked differently: an amateur is scouted on film and
 * at junior events and won through his family; a pro's numbers are already
 * public, so the work is in his stats, a round on tour, his camp and his team.
 */
export type RecruitAction = "film" | "event" | "call" | "visit" | "pitch" | "stats" | "walk" | "camp" | "dinner" | "team";
export const ACTIONS: Record<RecruitAction, { label: string; hours: number; blurb: string }> = {
  film: { label: "Watch film", hours: 2, blurb: "A sharper read of his game." },
  event: { label: "Attend an event", hours: 8, blurb: "A much sharper read, and he notices you came." },
  call: { label: "Call the family", hours: 3, blurb: "Builds interest; tells you what he cares about. Once a week." },
  visit: { label: "Visit", hours: 10, blurb: "A big jump in interest. Once a season." },
  pitch: { label: "Pitch the agency", hours: 5, blurb: "Sell what he cares about: better grades, more interest. Once a week." },
  stats: { label: "Study his stats", hours: 1, blurb: "His numbers are public: a quick, small sharpening of your read." },
  walk: { label: "Walk a round with him", hours: 6, blurb: "Watch him up close on tour: a sharper read, and a little interest." },
  camp: { label: "Call his camp", hours: 3, blurb: "Keeps you in his thoughts. Once a week." },
  dinner: { label: "Dinner at a tour stop", hours: 8, blurb: "A big jump in interest. Once a season." },
  team: { label: "Talk to his caddie and coach", hours: 4, blurb: "Learn what he cares about and any dealbreaker, and get a word in. Once a season." },
};
export const AMATEUR_ACTIONS: RecruitAction[] = ["film", "event", "call", "visit", "pitch"];
export const PRO_ACTIONS: RecruitAction[] = ["stats", "walk", "camp", "dinner", "team", "pitch"];
export const actionsFor = (world: World, id: string): RecruitAction[] => (isPro(world, id) ? PRO_ACTIONS : AMATEUR_ACTIONS);
export const hoursFor = (_world: World, _id: string, action: RecruitAction): number => ACTIONS[action].hours;

/** Your best scout makes every look count for more. */
const lookQuality = (world: World) => {
  const best = Math.max(0, ...world.agency.hiredScouts.map((sid) => world.agency.scouts.find((s) => s.id === sid)?.quality ?? 0));
  return 0.85 + best / 40;
};

/** Never a perfect read of a prospect: ranges always. */
export const MAX_READ = 0.95;
function sharpen(world: World, id: string, by: number): void {
  const k = world.agency.knowledge[id];
  world.agency.knowledge[id] = { accuracy: Math.min(MAX_READ, readOf(world, id) + by * lookQuality(world)), reports: (k?.reports ?? 0) + 1, absWeek: absWeek(world.season, world.week) };
}

/** Why an action can't be taken now, or null. */
/** Recruiting runs from week 10 to week 32. Weeks 1 to 9 are for watching: results, cards and the board. */
export const RECRUITING_OPENS = 10;
export const RECRUITING_CLOSES = 32;

/** Why recruiting is shut this week, or null when it's open. */
export function recruitingWindow(world: World): string | null {
  if (world.week < RECRUITING_OPENS) return `Recruiting opens in week ${RECRUITING_OPENS}. Until then, watch the results and build your board.`;
  if (world.week > RECRUITING_CLOSES) return `Recruiting closed after week ${RECRUITING_CLOSES}.`;
  return null;
}

export function actionBlock(world: World, id: string, action: RecruitAction): string | null {
  const closed = recruitingWindow(world);
  if (closed) return closed;
  if (hoursLeft(world) < hoursFor(world, id, action)) return "Not enough hours left this week.";
  const p = world.agency.prospects?.[id];
  const now = absWeek(world.season, world.week);
  if (!actionsFor(world, id).includes(action)) return isPro(world, id) ? "That's for amateurs." : "That's for pros.";
  if ((action === "call" || action === "camp") && p?.called === now) return "You've been in touch this week.";
  if (action === "pitch" && p?.pitched === now) return "You've pitched this week.";
  if ((action === "visit" || action === "dinner") && p?.visited === world.season) return action === "dinner" ? "You've had dinner this season." : "You've visited this season.";
  if (action === "team" && p?.teamSeason === world.season) return "You've talked to his team this season.";
  return null;
}

export function recruit(world: World, id: string, action: RecruitAction): string {
  const block = actionBlock(world, id, action);
  if (block) throw new Error(block);
  const wp = world.players[id]!;
  const p = prospectOf(world, id);
  const now = absWeek(world.season, world.week);
  const spent = recruitingOf(world);
  const hours = hoursFor(world, id, action);
  spent.hoursUsed += hours;
  spent.kindHours ??= { amateur: 0, pro: 0 };
  spent.kindHours[isPro(world, id) ? "pro" : "amateur"] += hours;
  const add = (n: number) => (p.interest = clamp(p.interest + n, 0, dealbreakerMet(world, dealbreaker(world, id)) ? 100 : 35));
  switch (action) {
    case "film":
      sharpen(world, id, 0.1);
      return `You watch film of ${wp.player.name}.`;
    case "event":
      sharpen(world, id, 0.28);
      add(3);
      return `You watch ${wp.player.name} play; he saw you there.`;
    case "call":
      p.called = now;
      p.known = true;
      add(6);
      return `You call ${wp.player.name}'s family.`;
    case "visit": {
      p.visited = world.season;
      p.known = true;
      const s = schoolOf(world, wp);
      if (s?.kind === "college") {
        const c = (recruitingOf(world).coaches ??= {});
        c[s.name] = (c[s.name] ?? 0) + 1;
      }
      add(16);
      return `You visit ${wp.player.name}.`;
    }
    case "stats":
      sharpen(world, id, 0.06);
      return `You go through ${wp.player.name}'s numbers.`;
    case "walk":
      sharpen(world, id, 0.2);
      add(3);
      return `You walk a round with ${wp.player.name}; he saw you there.`;
    case "camp":
      p.called = now;
      add(6);
      return `You call ${wp.player.name}'s camp.`;
    case "dinner":
      p.visited = world.season;
      p.known = true;
      add(16);
      return `You take ${wp.player.name} to dinner.`;
    case "team":
      p.teamSeason = world.season;
      p.known = true;
      add(3);
      return `You talk to ${wp.player.name}'s caddie and coach.`;
    case "pitch": {
      p.pitched = now;
      const g = grades(world);
      const pts = priorities(world, id).reduce((s, k) => s + GRADE_POINTS[g[k]], 0) / 2;
      add(3 + pts + (wp.academy ? 3 : 0));
      return `You pitch the agency to ${wp.player.name}.`;
    }
  }
}

/** A junior showcase: once a season, a first look at every high-school prospect. */
export const SHOWCASE_HOURS = 10;
export function showcaseBlock(world: World): string | null {
  const closed = recruitingWindow(world);
  if (closed) return closed;
  if (recruitingOf(world).showcaseSeason === world.season) return "Already held this season.";
  if (hoursLeft(world) < SHOWCASE_HOURS) return "Not enough hours left this week.";
  return null;
}
export function holdShowcase(world: World): number {
  const block = showcaseBlock(world);
  if (block) throw new Error(block);
  const r = recruitingOf(world);
  r.showcaseSeason = world.season;
  r.hoursUsed += SHOWCASE_HOURS;
  let n = 0;
  for (const id of prospects(world)) {
    if (schoolOf(world, world.players[id]!)?.kind !== "high") continue;
    const k = world.agency.knowledge[id];
    if ((k?.accuracy ?? 0) < 0.35) {
      world.agency.knowledge[id] = { accuracy: 0.35, reports: (k?.reports ?? 0) + 1, absWeek: absWeek(world.season, world.week) };
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- the card: what you know

/**
 * A pro's results and stats are public: everyone starts with a read of him,
 * better the longer he's been on tour (up to a good read). Amateurs start blank.
 */
export function publicRead(world: World, id: string): number {
  const wp = world.players[id];
  if (!wp || wp.career.status === "amateur") return 0;
  return clamp(0.25 + (wp.career.careerEvents / 25) * 0.04, 0.25, 0.45);
}
export const readOf = (world: World, id: string): number => Math.max(world.agency.knowledge[id]?.accuracy ?? 0, publicRead(world, id));
export const READ_TIERS = { skills: 0.2, ceiling: 0.45, details: 0.6 } as const;

/** A skill group as a range (never exact for a prospect). */
export function groupRange(world: World, id: string, group: keyof typeof ATTRIBUTE_GROUPS): { low: number; high: number } | null {
  const keys = ATTRIBUTE_GROUPS[group] as readonly AttributeKey[];
  const known = world.agency.knowledge[id];
  // Your own reports, or (for a pro you haven't scouted past it) the public read.
  const own = !!known && known.accuracy >= publicRead(world, id);
  const vals = keys.map((key) => (own ? scoutedAttribute(world, id, key) : publicRange(world, id, key))).filter((v): v is NonNullable<typeof v> => !!v);
  if (!vals.length) return null;
  const low = vals.reduce((s, v) => s + v.low, 0) / vals.length;
  const high = vals.reduce((s, v) => s + v.high, 0) / vals.length;
  const pad = high - low < 1 ? 0.5 : 0;
  return { low: Math.round((low - pad) * 2) / 2, high: Math.round((high + pad) * 2) / 2 };
}

/** His ceiling as an overall range, narrower with a better read. */
export function ceilingRange(world: World, id: string): { low: number; high: number } | null {
  const read = readOf(world, id);
  if (read < READ_TIERS.ceiling) return null;
  const wp = world.players[id]!;
  const spread = Math.max(0.5, (1 - read) * 4);
  const lean = (rngFor(world, id, 5104).next() * 2 - 1) * spread * 0.5;
  const mid = wp.development.potential + lean;
  return { low: Math.round((mid - spread) * 2) / 2, high: Math.round((mid + spread) * 2) / 2 };
}

/** A gem (better than his ranking) or a bust (worse), once you know him well enough. */
export function gemOrBust(world: World, id: string): "gem" | "bust" | null {
  if (readOf(world, id) < READ_TIERS.ceiling) return null;
  const i = amateurRanking(world).indexOf(id);
  const expected = i < 10 ? 14.5 : i < 30 ? 13.3 : 12.3;
  const d = world.players[id]!.development.potential - expected;
  return d >= 1 ? "gem" : d <= -1 ? "bust" : null;
}

// ---------------------------------------------------------------- signing, signing day and the class

/** Called when a client is signed: pipelines, coach relations and the class. */
export function noteSigning(world: World, wp: WorldPlayer): void {
  const s = wp.school;
  if (!s && wp.career.status !== "amateur") return;
  const r = recruitingOf(world);
  const pipes = (r.pipelines ??= { schools: {}, states: {} });
  if (s?.kind === "college") {
    pipes.schools[s.name] = (pipes.schools[s.name] ?? 0) + 1;
    (r.coaches ??= {})[s.name] = (r.coaches[s.name] ?? 0) + 2;
  }
  if (s && s.kind !== "national" && s.state) pipes.states[s.state] = (pipes.states[s.state] ?? 0) + 1;
  if (wp.career.status === "amateur") ((r.classes ??= {})[world.season] ??= []).push(wp.player.id);
}

/**
 * Signing day, at the season's end: a prospect you've worked on who's
 * turning pro commits to the top agency on his list. Yours: he signs at his
 * going rate for two seasons (if there's room). A rival's: he joins them.
 */
export function signingDay(world: World, wp: WorldPlayer): string | null {
  if (!world.agency.prospects?.[wp.player.id] || wp.client) return null;
  const top = agencyList(world, wp.player.id)[0]!;
  if (top.you) {
    // A full roster can't take him: he goes to the winter market instead.
    // A commitment is honoured even one over the roster limit; only a roster already past it loses him.
    if (rosterCount(world) > rosterLimit(world.agency.reputation, world.agency.hq)) return `Signing day: ${wp.player.name} wanted ${world.agency.name}, but your roster is full.`;
    signClient(world, wp.player.id, { commission: marketRate(wp), years: ROOKIE_SEASONS });
    makeRookieDeal(world, wp);
    return `Signing day: ${wp.player.name} commits to ${world.agency.name} on a ${ROOKIE_SEASONS}-season rookie deal!`;
  }
  wp.agent = { agency: top.agency, untilSeason: world.season + 2, commission: 0.1 };
  return `Signing day: ${wp.player.name} commits to ${top.agency}.`;
}

/** Season end: rank the class (yours by the prospects you signed, the rivals' by the new pros they landed). */
export function rankClasses(world: World, newPros: string[]): void {
  const r = recruitingOf(world);
  // A class is as good as its best three: quality, not volume (rivals land many new pros in the winter market).
  const score = (ids: string[]) =>
    ids.map((id) => Math.max(1, Math.round(((world.players[id]?.development.potential ?? 11) - 10) * 2) / 2)).sort((a, b) => b - a).slice(0, 3).reduce((s, x) => s + x, 0);
  const mine = [...new Set(r.classes?.[world.season] ?? [])];
  const byRival = new Map<string, string[]>();
  // Like for like: a rival's class is the prospects it recruited (and landed), not every new pro it signs in the winter market.
  for (const id of newPros) {
    const a = world.players[id]?.agent?.agency;
    if (a && (r.rivals?.[id]?.interest[a] ?? 0) >= 40) byRival.set(a, [...(byRival.get(a) ?? []), id]);
  }
  const rows = [{ agency: world.agency.name, score: score(mine), signed: mine.length }, ...[...byRival].map(([agency, ids]) => ({ agency, score: score(ids), signed: ids.length }))].sort((a, b) => b.score - a.score);
  r.lastRanking = { season: world.season, rows };
  const place = rows.findIndex((x) => x.agency === world.agency.name);
  if (mine.length && place === 0) {
    addReputation(world.agency, 3);
    world.news.unshift(`${world.agency.name} lands the season's top recruiting class.`);
  } else if (mine.length && place <= 2) addReputation(world.agency, 1.5);
  // Interest cools over the winter, yours and the rivals'; pros leave the board.
  for (const p of Object.values(world.agency.prospects ?? {})) p.interest = Math.round(p.interest * 0.8);
  for (const [id, rec] of Object.entries(r.rivals ?? {})) {
    if (world.players[id]?.career.status !== "amateur") delete r.rivals![id];
    else for (const a of Object.keys(rec.interest)) rec.interest[a] = Math.round(rec.interest[a]! * 0.8);
  }
}

// ---------------------------------------------------------------- the rivals recruit too

const rivalList = (world: World) => world.rivals?.map((r) => ({ name: r.name, rep: r.reputation, style: r.style })) ?? RIVAL_AGENCIES.map((name) => ({ name, rep: 50, style: "volume" as const }));

/** Each rival's interest in a prospect: where it stands, starting from their name and a little luck. */
export function rivalInterest(world: World, id: string): Record<string, number> {
  const stored = recruitingOf(world).rivals?.[id];
  if (stored) return stored.interest;
  const rng = rngFor(world, id, 5103);
  return Object.fromEntries(rivalList(world).map((r) => [r.name, Math.round(clamp(r.rep * 0.35 + rng.normal(5, 8), 0, 60))]));
}

/** The rivals' latest moves on a prospect, newest first. */
export const rivalMoves = (world: World, id: string) => recruitingOf(world).rivals?.[id]?.moves ?? [];

/**
 * Weekly: every rival agency works its own prospects. The big names chase the
 * five-star players, developers the high ceilings, the rest whoever is left;
 * each makes a few calls a week and the odd visit. Their moves on prospects
 * you're working on make the news.
 */
export function rivalRecruitingWeek(world: World): string[] {
  // The amateur ranking once for the week (it sorts every player).
  const ranking = amateurRanking(world);
  const pool = ranking.filter((id) => !world.players[id]?.client).slice(0, 60);
  if (!pool.length) return [];
  const starsOf = new Map(ranking.map((id, i) => [id, i < 5 ? 5 : i < 20 ? 4 : i < 45 ? 3 : i < 70 ? 2 : 1]));
  const now = absWeek(world.season, world.week);
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 5105));
  const r = recruitingOf(world);
  const all = (r.rivals ??= {});
  const news: string[] = [];
  for (const rival of rivalList(world)) {
    const picks = 2 + Math.round(rival.rep / 30);
    // Who they want: stars for the big names and star hunters, ceilings for developers, anyone for the rest.
    const want = (id: string) => {
      const st = starsOf.get(id) ?? 1;
      const fit = rival.style === "starHunter" || rival.rep >= 65 ? st : rival.style === "developer" ? world.players[id]!.development.potential - 9 : 6 - Math.abs(st - 3);
      return Math.max(0.1, fit) * (0.6 + rng.next() * 0.8);
    };
    const scored = pool.map((id) => ({ id, w: want(id) })).sort((a, b) => b.w - a.w);
    const chosen = scored.slice(0, picks).map((x) => x.id);
    for (const id of chosen) {
      const rec = (all[id] ??= { interest: { ...rivalInterest(world, id) }, moves: [] });
      const visit = rng.chance(0.12);
      rec.interest[rival.name] = clamp((rec.interest[rival.name] ?? 0) + (visit ? 8 : 2 + rng.next() * 3), 0, 100);
      rec.moves.unshift({ agency: rival.name, text: visit ? "visited him" : "called his family", absWeek: now });
      rec.moves.length = Math.min(rec.moves.length, 6);
      if (world.agency.prospects?.[id] && (visit || rng.chance(0.25)) && news.length < 2) news.push(`${rival.name} ${visit ? "visit" : "call"} ${world.players[id]!.player.name}, one of your prospects.`);
    }
  }
  return news;
}

/** A skill as the public numbers show it: a pro's range from his results alone. */
function publicRange(world: World, id: string, key: AttributeKey): { low: number; high: number } | null {
  const acc = publicRead(world, id);
  if (!acc) return null;
  const truth = world.players[id]!.player.attributes[key];
  const spread = Math.ceil((1 - acc) * 5);
  const value = clamp(Math.round(truth + (rngFor(world, id, 5106 + key.length).next() * 2 - 1) * spread), 1, 20);
  return { low: clamp(value - spread, 1, 20), high: clamp(value + spread, 1, 20) };
}
