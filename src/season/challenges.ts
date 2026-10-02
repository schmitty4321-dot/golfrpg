/**
 * Challenges: careers with a twist, a goal and a deadline. Each starts as a
 * normal agency (or the journeyman start) with something changed (no money,
 * a fading star, a rule to live by), and is checked every week and at every
 * season's end. Win it early for a better score; miss the deadline, or break
 * its rule, and it's lost (the career carries on either way).
 */
import { clamp } from "../engine";
import { agencyProfit } from "./business";
import { GOLF_SKILLS } from "./development";
import { agencyTable } from "./market";
import { rankMap } from "./points";
import type { Scenario } from "./world";
import type { World } from "./types";

export interface ChallengeDef {
  id: string;
  title: string;
  blurb: string;
  goal: string;
  /** How many seasons you have (season 1 counts as the first). */
  seasons: number;
  scenario: Scenario;
  setup?: (world: World) => void;
  /** Checked weekly and at season's end: "won", "lost", or null to carry on. */
  check: (world: World, when: "week" | "season") => "won" | "lost" | null;
}

export interface ChallengeState {
  id: string;
  startSeason: number;
  /** The last season it can be won in. */
  deadline: number;
  status: "active" | "won" | "lost";
  endedSeason?: number;
  endedWeek?: number;
  score?: number;
}

const trophies = (w: World) => w.agency.trophies ?? [];
const over = (w: World, when: "week" | "season") => when === "season" && w.season >= (w.challenge?.deadline ?? 0);
const ageAtSigning = (w: World, id: string) => {
  const wp = w.players[id];
  return wp?.client ? wp.player.age - (w.season - wp.client.contract.signedSeason) : 99;
};
const ryderTeamOfThree = (w: World) =>
  (w.ryderCup?.history ?? []).some((r) => (["USA", "Europe"] as const).some((t) => [...r.teams[t].automatic, ...r.teams[t].picks].filter((id) => w.players[id]?.client).length >= 3));

export const CHALLENGES: ChallengeDef[] = [
  {
    id: "bankrupt",
    title: "Bankrupt",
    blurb: "You've inherited an agency $400,000 in the red. Turn it round before the bank does it for you.",
    goal: "Finish a season in profit by the end of season 2 (and don't sink below -$2M).",
    seasons: 2,
    scenario: "agency",
    setup: (w) => {
      w.agency.bank = -400_000;
    },
    check: (w, when) => {
      if (w.agency.bank < -2_000_000) return "lost";
      if (when === "season") {
        const last = w.pastSeasons.at(-1);
        if (last?.season === w.season && agencyProfit(last.agency.ledger) > 0) return "won";
      }
      return over(w, when) ? "lost" : null;
    },
  },
  {
    id: "journeyman",
    title: "Journeyman to winner",
    blurb: "One client: a 32-year-old grinder who has never won. Everyone says he never will.",
    goal: "A win for one of your clients within 3 seasons.",
    seasons: 3,
    scenario: "journeyman",
    check: (w, when) => (trophies(w).some((t) => t.kind === "win" || t.kind === "major") ? "won" : over(w, when) ? "lost" : null),
  },
  {
    id: "amateur-hunter",
    title: "Amateur hunter",
    blurb: "Find them young, sign them early, and build a major champion.",
    goal: "A client you signed at 22 or younger wins a major within 6 seasons.",
    seasons: 6,
    scenario: "agency",
    setup: (w) => {
      w.agency.reputation = Math.max(w.agency.reputation, 25);
    },
    check: (w, when) => {
      const won = trophies(w).some((t) => t.kind === "major" && t.season === w.season && w.clientIds.some((id) => w.players[id]!.player.name === t.player && ageAtSigning(w, id) <= 22));
      return won ? "won" : over(w, when) ? "lost" : null;
    },
  },
  {
    id: "ryder-factory",
    title: "Ryder Cup factory",
    blurb: "Captains will be calling you about their picks.",
    goal: "Three of your clients on one Ryder Cup team within 6 seasons.",
    seasons: 6,
    scenario: "agency",
    check: (w, when) => (ryderTeamOfThree(w) ? "won" : over(w, when) ? "lost" : null),
  },
  {
    id: "boutique",
    title: "Boutique",
    blurb: "Small and elite. No more than four clients, ever.",
    goal: "Reputation 70 within 5 seasons, never with more than four clients.",
    seasons: 5,
    scenario: "agency",
    check: (w, when) => (w.clientIds.length > 4 ? "lost" : w.agency.reputation >= 70 ? "won" : over(w, when) ? "lost" : null),
  },
  {
    id: "comeback",
    title: "The comeback",
    blurb: "Your veteran was a top-10 player before his back went. He's 38, he's hurt, and he wants one more run.",
    goal: "Get him into the world's top 30 within 2 seasons.",
    seasons: 2,
    scenario: "agency",
    setup: (w) => {
      const wp = w.players.client3;
      if (!wp?.client) return;
      wp.player.age = 38;
      for (const k of GOLF_SKILLS) wp.player.attributes[k] = clamp(wp.player.attributes[k] + 2, 1, 20);
      wp.development.potential = Math.max(wp.development.potential, 14);
      wp.injury = { name: "Back spasm", weeksLeft: 10, totalWeeks: 10 };
      wp.client.contract.untilSeason = w.season + 1;
    },
    check: (w, when) => {
      if (!w.players.client3?.client) return "lost";
      return (rankMap(w).get("client3") ?? 999) <= 30 ? "won" : over(w, when) ? "lost" : null;
    },
  },
  {
    id: "rival-takedown",
    title: "Rival takedown",
    blurb: "Apex Sports Management run golf. Prove them wrong.",
    goal: "Your clients out-earn Apex Sports Management's over a season, within 5 seasons.",
    seasons: 5,
    scenario: "agency",
    check: (w, when) => {
      if (when !== "season") return null;
      const table = agencyTable(w);
      const mine = table.find((r) => r.yours)?.earnings ?? 0;
      const apex = table.find((r) => r.name === "Apex Sports Management")?.earnings ?? Infinity;
      return mine > apex ? "won" : over(w, when) ? "lost" : null;
    },
  },
  {
    id: "dynasty",
    title: "Dynasty",
    blurb: "The long game: build the greatest agency in golf.",
    goal: "Ten majors by your clients within 15 seasons.",
    seasons: 15,
    scenario: "agency",
    check: (w, when) => (trophies(w).filter((t) => t.kind === "major").length >= 10 ? "won" : over(w, when) ? "lost" : null),
  },
];

export const CHALLENGE_BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));

/** Sets a new career up for a challenge (after createWorld). */
export function applyChallenge(world: World, id: string): void {
  const def = CHALLENGE_BY_ID.get(id);
  if (!def) return;
  def.setup?.(world);
  world.challenge = { id, startSeason: world.season, deadline: world.season + def.seasons - 1, status: "active" };
  world.news.unshift(`Challenge: ${def.title}. ${def.goal}`);
}

/** Your score for a finished challenge: more for finishing early, and for the name you've made. */
export function challengeScore(world: World, won: boolean): number {
  const c = world.challenge!;
  if (!won) return 0;
  return 1000 + 300 * Math.max(0, c.deadline - world.season) + Math.round(world.agency.reputation) * 5;
}

/** Checks the challenge; returns the result if it has just ended. */
export function checkChallenge(world: World, when: "week" | "season"): "won" | "lost" | null {
  const c = world.challenge;
  if (!c || c.status !== "active") return null;
  const def = CHALLENGE_BY_ID.get(c.id);
  if (!def) return null;
  const result = def.check(world, when);
  if (!result) return null;
  c.status = result;
  c.endedSeason = world.season;
  c.endedWeek = world.week;
  c.score = challengeScore(world, result === "won");
  world.news.unshift(result === "won" ? `Challenge complete: ${def.title}! Score ${c.score}.` : `Challenge failed: ${def.title}. The career goes on.`);
  return result;
}
