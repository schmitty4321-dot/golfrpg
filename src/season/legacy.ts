/**
 * The agency's legacy: everyone who was ever your client stays on your books
 * as an alumnus, with what he won for you. Greats go into the agency's own
 * Hall of Fame. When an alumnus retires he comes back as a coach, at a
 * loyalty discount and as good as his career was; and now and then a retired
 * one sends you a prospect from back home: a full report, and a head start
 * when you go to sign him. A legacy score and the agency's eras sit with the
 * trophies.
 */
import { clamp, type Rng } from "../engine";
import { COACH_GROUPS, overall } from "./development";
import { addDecision } from "./inbox";
import { rankMap } from "./points";
import { coachFee } from "./staff";
import type { CoachRole, World, WorldPlayer } from "./types";
import { amateurRanking } from "./amateurs";

export interface Alumnus {
  id: string;
  name: string;
  nationality: string;
  signed: number;
  left: number;
  /** Won while he was your client. */
  wins: number;
  majors: number;
  /** His best world ranking while he was yours. */
  bestRank: number;
  /** "elsewhere" (still playing), "retired", or "coaching" (on the coach market). */
  status: "elsewhere" | "retired" | "coaching";
  hallOfFame: boolean;
}

/** In the agency Hall of Fame: a major, or three wins, while he was yours. */
const hallWorthy = (a: Pick<Alumnus, "wins" | "majors">) => a.majors >= 1 || a.wins >= 3;
/** A referral's head start on signing (added to his willingness). */
export const REFERRAL_BONUS = 8;
/** Coaching fee for a former client, against the going rate. */
export const LOYALTY_DISCOUNT = 0.6;

export const alumni = (world: World): Alumnus[] => world.agency.legacy?.alumni ?? [];

function trophyCount(world: World, name: string): { wins: number; majors: number } {
  const t = (world.agency.trophies ?? []).filter((x) => x.player === name);
  return { wins: t.filter((x) => x.kind === "win" || x.kind === "major").length, majors: t.filter((x) => x.kind === "major").length };
}

/** Keeps a client's record as he leaves the agency (contract over, released or poached). */
export function recordAlumnus(world: World, wp: WorldPlayer): void {
  if (!wp.client) return;
  const legacy = (world.agency.legacy ??= { alumni: [] });
  const { wins, majors } = trophyCount(world, wp.player.name);
  const rank = rankMap(world).get(wp.player.id) ?? 999;
  const existing = legacy.alumni.find((a) => a.id === wp.player.id);
  const entry: Alumnus = existing ?? {
    id: wp.player.id,
    name: wp.player.name,
    nationality: wp.player.nationality,
    signed: wp.client.contract.signedSeason,
    left: world.season,
    wins: 0,
    majors: 0,
    bestRank: rank,
    status: "elsewhere",
    hallOfFame: false,
  };
  entry.left = world.season;
  entry.wins = wins;
  entry.majors = majors;
  entry.bestRank = Math.min(entry.bestRank, rank, wp.client.bestRank ?? 999);
  if (!existing) legacy.alumni.push(entry);
  if (!entry.hallOfFame && hallWorthy(entry)) {
    entry.hallOfFame = true;
    world.news.unshift(`${entry.name} goes into the ${world.agency.name} Hall of Fame: ${entry.wins} win${entry.wins === 1 ? "" : "s"}${entry.majors ? `, ${entry.majors} major${entry.majors === 1 ? "" : "s"}` : ""} with you.`);
  }
}

/** A client's best world ranking while he's yours, kept up week by week. */
export function trackBestRanks(world: World): void {
  const ranks = rankMap(world);
  for (const id of world.clientIds) {
    const c = world.players[id]?.client;
    if (c) c.bestRank = Math.min(c.bestRank ?? 999, ranks.get(id) ?? 999);
  }
}

/** The coaching role his game suits: the group of skills he was best at. */
function bestRole(wp: WorldPlayer): CoachRole {
  let best: CoachRole = "swing";
  let top = -Infinity;
  for (const [role, keys] of Object.entries(COACH_GROUPS) as [CoachRole, readonly string[]][]) {
    if (role === "fitness") continue;
    const avg = keys.reduce((t, k) => t + (wp.player.attributes[k as keyof typeof wp.player.attributes] ?? 0), 0) / keys.length;
    if (avg > top) {
      top = avg;
      best = role;
    }
  }
  return best;
}

/**
 * An alumnus retires: he comes back as a coach on the market, as good as his
 * career was, at a loyalty discount for you. Called before he leaves the world.
 */
export function alumnusRetires(world: World, wp: WorldPlayer): void {
  const a = alumni(world).find((x) => x.id === wp.player.id);
  if (!a || a.status !== "elsewhere") return;
  const quality = Math.round(
    clamp(8 + wp.career.careerWins * 0.5 + wp.career.careerMajors * 1.5 + (a.bestRank <= 10 ? 3 : a.bestRank <= 50 ? 2 : 0) + (overall(wp.player) - 12) * 0.5, 8, 19),
  );
  const role = bestRole(wp);
  world.coaches.push({ id: `alum-${wp.player.id}`, name: wp.player.name, role, quality, weeklyFee: Math.round(coachFee(quality) * LOYALTY_DISCOUNT), formerClient: true });
  a.status = "coaching";
  world.news.unshift(`${wp.player.name} retires and offers his services to ${world.agency.name}: a ${role === "shortGame" ? "short-game" : role} coach (quality ${quality}), at a friend's rate.`);
}

/**
 * A winter's referrals: each retired alumnus has a one-in-four chance of
 * sending a prospect from home. It arrives in the inbox.
 */
export function alumniReferrals(world: World, rng: Rng): void {
  const ranked = amateurRanking(world);
  for (const a of alumni(world)) {
    if (a.status === "elsewhere" || !rng.chance(0.25)) continue;
    const prospect = ranked.slice(0, 40).find((id) => {
      const wp = world.players[id];
      return wp && wp.player.nationality === a.nationality && !(world.agency.knowledge[id]?.accuracy ?? 0) && !(world.agency.referrals ?? {})[id];
    });
    if (!prospect) continue;
    const name = world.players[prospect]!.player.name;
    (world.agency.referrals ??= {})[prospect] = world.season + 1;
    addDecision(world, {
      kind: "message",
      key: `referral-${a.id}`,
      clientId: "",
      from: a.name,
      title: `${a.name} has a prospect for you`,
      text: `"There's a kid back home, ${name}. He's the real thing. I've told him you're the people to see."`,
      choices: [
        { id: "thanks", label: "Thank him and take a look", detail: "A full report, and a head start when you go to sign him.", effects: [{ k: "scoutBoost", playerId: prospect, v: 0.75 }] },
        { id: "pass", label: "Not now", detail: "You keep the head start, but no report.", effects: [] },
      ],
      defaultChoice: "thanks",
      big: false,
    });
  }
}

/** The head start from a referral, while it lasts (this season and next). */
export const referralBonus = (world: World, id: string): number => ((world.agency.referrals?.[id] ?? -1) >= world.season ? REFERRAL_BONUS : 0);

/** The agency's legacy score: what its players won for it, past and present. */
export function legacyScore(world: World): number {
  const t = world.agency.trophies ?? [];
  const wins = t.filter((x) => x.kind === "win").length;
  const majors = t.filter((x) => x.kind === "major").length;
  const titles = t.filter((x) => x.kind === "pointsTitle").length;
  const ours = new Set([...world.clientIds, ...alumni(world).map((a) => a.id)]);
  const ryder = (world.ryderCup?.history ?? []).reduce((n, r) => n + Object.keys(r.names).filter((id) => ours.has(id)).length, 0);
  const hall = alumni(world).filter((a) => a.hallOfFame).length;
  return wins * 2 + majors * 10 + titles * 8 + ryder * 3 + hall * 15;
}

/** The agency's eras: five-season spans, each named after its biggest winner. */
export function eras(world: World): { from: number; to: number; name: string; wins: number }[] {
  const t = (world.agency.trophies ?? []).filter((x) => (x.kind === "win" || x.kind === "major") && x.player);
  if (!t.length) return [];
  const first = Math.min(...t.map((x) => x.season));
  const last = Math.max(...t.map((x) => x.season));
  const out: { from: number; to: number; name: string; wins: number }[] = [];
  for (let from = first; from <= last; from += 5) {
    const span = t.filter((x) => x.season >= from && x.season < from + 5);
    const by = new Map<string, number>();
    for (const x of span) by.set(x.player!, (by.get(x.player!) ?? 0) + (x.kind === "major" ? 3 : 1));
    const top = [...by].sort((a, b) => b[1] - a[1])[0];
    if (top) out.push({ from, to: Math.min(from + 4, last), name: top[0], wins: span.filter((x) => x.player === top[0]).length });
  }
  return out;
}
