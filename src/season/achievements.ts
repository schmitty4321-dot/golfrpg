/**
 * Achievements: milestones for your agency, from a first win to a dynasty.
 * Each unlocks once, is announced in the news, and gives a small, one-off
 * boost to your reputation (1-3): a nod, not power. Checked at the end of
 * every week and every season.
 *
 * A few count things the game doesn't otherwise keep (promises kept, deals
 * closed on a counter, decisions answered): those systems call bump().
 */
import { HQ_TIERS, addReputation } from "./agency";
import { agencyProfit } from "./business";
import { masteries, masteryTier } from "./mastery";
import { agencyTable } from "./market";
import { rankMap } from "./points";
import { playerRecord } from "./ryderCup";
import { followers } from "./showcase";
import type { World } from "./types";

export type AchievementGroup = "Career" | "Agency" | "Management" | "Story";

export interface AchievementDef {
  id: string;
  title: string;
  detail: string;
  group: AchievementGroup;
  /** Reputation it's worth when it unlocks. */
  reward: number;
  check: (world: World) => boolean;
}

const trophies = (w: World) => w.agency.trophies ?? [];
const wins = (w: World) => trophies(w).filter((t) => t.kind === "win" || t.kind === "major").length;
const majors = (w: World) => trophies(w).filter((t) => t.kind === "major").length;
const clientsOf = (w: World) => w.clientIds.map((id) => w.players[id]!).filter(Boolean);
const count = (w: World, key: string) => w.agency.counts?.[key] ?? 0;
const MAJORS = ["Masters Tournament", "PGA Championship", "U.S. Open", "The Open Championship"];

export const ACHIEVEMENTS: AchievementDef[] = [
  // Career: what your clients win.
  { id: "first-win", title: "First win", detail: "A client wins a tour event.", group: "Career", reward: 1, check: (w) => wins(w) >= 1 },
  { id: "five-wins", title: "Winning habit", detail: "Five wins by your clients.", group: "Career", reward: 2, check: (w) => wins(w) >= 5 },
  { id: "twenty-wins", title: "Win machine", detail: "Twenty wins by your clients.", group: "Career", reward: 3, check: (w) => wins(w) >= 20 },
  { id: "first-major", title: "Major champion", detail: "A client wins a major.", group: "Career", reward: 3, check: (w) => majors(w) >= 1 },
  { id: "three-majors", title: "Major factory", detail: "Three majors by your clients.", group: "Career", reward: 3, check: (w) => majors(w) >= 3 },
  { id: "dynasty", title: "Dynasty", detail: "Ten majors by your clients.", group: "Career", reward: 3, check: (w) => majors(w) >= 10 },
  {
    id: "grand-slam",
    title: "Career Grand Slam",
    detail: "One client wins all four majors while he's yours.",
    group: "Career",
    reward: 3,
    check: (w) => {
      const by = new Map<string, Set<string>>();
      for (const t of trophies(w)) if (t.kind === "major" && t.player) (by.get(t.player) ?? by.set(t.player, new Set()).get(t.player)!).add(t.title);
      return [...by.values()].some((s) => MAJORS.every((m) => s.has(m)));
    },
  },
  { id: "points-title", title: "Season champion", detail: "A client tops the season points list.", group: "Career", reward: 3, check: (w) => trophies(w).some((t) => t.kind === "pointsTitle") },
  { id: "players-champ", title: "The fifth major", detail: "A client wins THE PLAYERS.", group: "Career", reward: 2, check: (w) => trophies(w).some((t) => /PLAYERS/.test(t.title)) },
  { id: "match-play", title: "Last man standing", detail: "A client wins the Match Play Championship.", group: "Career", reward: 2, check: (w) => trophies(w).some((t) => /Match Play/.test(t.title)) },
  { id: "top-ten", title: "Top ten", detail: "A client inside the world's top 10.", group: "Career", reward: 2, check: (w) => clientsOf(w).some((wp) => (rankMap(w).get(wp.player.id) ?? 999) <= 10) },
  { id: "world-no1", title: "World No. 1", detail: "A client at the top of the world ranking.", group: "Career", reward: 3, check: (w) => clientsOf(w).some((wp) => rankMap(w).get(wp.player.id) === 1) },
  {
    id: "ryder-three",
    title: "Ryder Cup factory",
    detail: "Three of your clients on one Ryder Cup team.",
    group: "Career",
    reward: 2,
    check: (w) =>
      (w.ryderCup?.history ?? []).some((r) => (["USA", "Europe"] as const).some((t) => [...r.teams[t].automatic, ...r.teams[t].picks].filter((id) => w.players[id]?.client).length >= 3)),
  },
  {
    id: "ryder-hero",
    title: "Ryder Cup hero",
    detail: "A client wins four matches in one Ryder Cup.",
    group: "Career",
    reward: 2,
    check: (w) => (w.ryderCup?.history ?? []).some((r) => w.clientIds.some((id) => r.names[id] && playerRecord(r, id).w >= 4)),
  },
  { id: "ace", title: "Hole-in-one", detail: "A client makes an ace.", group: "Career", reward: 1, check: (w) => (w.highlights ?? []).some((h) => h.client && h.score === 1) },
  { id: "hall-of-famer", title: "Hall of Famer", detail: "A client who won for you is elected to the Hall of Fame.", group: "Career", reward: 3, check: (w) => w.history.hallOfFame.some((h) => trophies(w).some((t) => t.player === h.name)) },

  // Agency: the business.
  { id: "rep-50", title: "On the map", detail: "Reputation 50.", group: "Agency", reward: 1, check: (w) => w.agency.reputation >= 50 },
  { id: "rep-75", title: "A big name", detail: "Reputation 75.", group: "Agency", reward: 2, check: (w) => w.agency.reputation >= 75 },
  { id: "rep-90", title: "The agency", detail: "Reputation 90.", group: "Agency", reward: 3, check: (w) => w.agency.reputation >= 90 },
  { id: "roster-5", title: "Growing stable", detail: "Five clients at once.", group: "Agency", reward: 1, check: (w) => w.clientIds.length >= 5 },
  { id: "roster-10", title: "Full house", detail: "Ten clients at once.", group: "Agency", reward: 2, check: (w) => w.clientIds.length >= 10 },
  { id: "millionaire", title: "Seven figures", detail: "$1 million in the bank.", group: "Agency", reward: 1, check: (w) => w.agency.bank >= 1_000_000 },
  { id: "ten-million", title: "Eight figures", detail: "$10 million in the bank.", group: "Agency", reward: 2, check: (w) => w.agency.bank >= 10_000_000 },
  { id: "profit-season", title: "Big year", detail: "A season with $1 million profit.", group: "Agency", reward: 2, check: (w) => w.pastSeasons.some((s) => agencyProfit(s.agency.ledger) >= 1_000_000) },
  { id: "center", title: "Training ground", detail: "Build a Performance Center.", group: "Agency", reward: 1, check: (w) => (w.agency.center ?? 0) >= 1 },
  { id: "hq-top", title: "Corner office", detail: "The top headquarters tier.", group: "Agency", reward: 2, check: (w) => (w.agency.hq ?? 0) >= HQ_TIERS.length - 1 },
  { id: "top-agency", title: "Top of the league", detail: "Your clients out-earn every rival's in a season.", group: "Agency", reward: 3, check: (w) => w.week > 30 && agencyTable(w)[0]?.yours === true },
  { id: "survivor", title: "Five seasons", detail: "Five seasons in business.", group: "Agency", reward: 1, check: (w) => w.season >= 6 },

  // Management: how you run it.
  { id: "gold", title: "Gold standard", detail: "A client reaches gold mastery.", group: "Management", reward: 2, check: (w) => clientsOf(w).some((wp) => masteries(wp).some((m) => masteryTier(wp, m.key) === "gold")) },
  { id: "promises-5", title: "A man of your word", detail: "Keep five promises.", group: "Management", reward: 2, check: (w) => count(w, "promisesKept") >= 5 },
  { id: "counter-deal", title: "Meet in the middle", detail: "Close a deal on his counter-offer.", group: "Management", reward: 1, check: (w) => count(w, "counterDeals") >= 1 },
  { id: "decisions-25", title: "Hands-on", detail: "Answer 25 inbox decisions yourself.", group: "Management", reward: 1, check: (w) => count(w, "decisions") >= 25 },
  { id: "press-10", title: "Media trained", detail: "Ten press conferences.", group: "Management", reward: 1, check: (w) => count(w, "press") >= 10 },
  { id: "sponsors-3", title: "Brand ambassador", detail: "A client with three sponsors at once.", group: "Management", reward: 1, check: (w) => clientsOf(w).some((wp) => (wp.client?.sponsors.length ?? 0) >= 3) },
  { id: "followers-1m", title: "Superstar", detail: "A client with a million followers.", group: "Management", reward: 2, check: (w) => clientsOf(w).some((wp) => followers(w, wp) >= 1_000_000) },

  // Story: the people.
  { id: "friend", title: "Friends in the business", detail: "A friendly relationship (50+) with a rival agent.", group: "Story", reward: 1, check: (w) => (w.rivals ?? []).some((r) => (r.relationship ?? 0) >= 50) },
  { id: "enemy", title: "Bad blood", detail: "A hostile relationship (-50) with a rival agent.", group: "Story", reward: 1, check: (w) => (w.rivals ?? []).some((r) => (r.relationship ?? 0) <= -50) },
  { id: "grudge", title: "Grudge match", detail: "A rivalry at heat 80.", group: "Story", reward: 1, check: (w) => (w.rivalries ?? []).some((r) => r.heat >= 80) },
  { id: "domination", title: "Owns him", detail: "A client leads a rivalry by five.", group: "Story", reward: 2, check: (w) => (w.rivalries ?? []).some((r) => r.aWins - r.bWins >= 5) },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Counts a thing the achievements care about (promises kept, deals on a counter, decisions answered...). */
export function bump(world: World, key: string, by = 1): void {
  const c = (world.agency.counts ??= {});
  c[key] = (c[key] ?? 0) + by;
}

/** Unlocks whatever has been earned; returns the new ones. */
export function checkAchievements(world: World): AchievementDef[] {
  if (world.clientIds.length === 0 && !world.achievements) return [];
  const got = (world.achievements ??= {});
  const fresh: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.id] || !a.check(world)) continue;
    got[a.id] = { season: world.season, week: world.week };
    addReputation(world.agency, a.reward);
    world.news.unshift(`Achievement unlocked: ${a.title}. ${a.detail} (+${a.reward} reputation)`);
    fresh.push(a);
  }
  return fresh;
}
