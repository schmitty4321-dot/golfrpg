/**
 * Season goals: each season a client is offered four goals that suit where
 * he stands, and you agree two with him. At the season's end each goal met
 * lifts his mood and your agency's name (more for a stretch); each missed
 * one costs a little mood. Unagreed goals are picked for you by week 4.
 */
import { clamp } from "../engine";
import { overall } from "./development";
import { pointsList, rankMap } from "./points";
import type { SeasonGoal, World, WorldPlayer } from "./types";
import { addReputation } from "./agency";

export const GOALS_TO_AGREE = 2;
const AUTO_PICK_WEEK = 4;

/** Four goals that fit his level: a modest one, two middling, a stretch. */
export function offerGoals(world: World, wp: WorldPlayer): SeasonGoal[] {
  const lvl = overall(wp.player);
  const rank = rankMap(world).get(wp.player.id) ?? 400;
  const g = (kind: SeasonGoal["kind"], target: number, label: string, difficulty: 1 | 2 | 3): SeasonGoal => ({ id: `${kind}-${target}`, kind, target, label, difficulty });
  if (wp.career.status === "amateur") {
    return [g("cuts", 1, "Make a cut in a professional event", 2), g("top10s", 1, "A top 10 in any event", 2), g("win", 1, "Win an event", 3), g("cuts", 2, "Make two cuts", 3)];
  }
  if (wp.career.status === "none" || lvl < 12.3) {
    return [g("cuts", 6, "Make 6 cuts", 1), g("top10s", 2, "Two top-10 finishes", 2), g("card", 100, "Earn a main-tour card (top 100)", 2), g("win", 1, "Win an event", 3)];
  }
  if (rank > 60 || lvl < 13.5) {
    return [g("card", 100, "Keep his card (top 100 on points)", 1), g("top10s", 3, "Three top-10 finishes", 2), g("playoffs", 70, "Make the playoffs (top 70)", 2), g("win", 1, "Win an event", 3)];
  }
  if (rank > 15) {
    return [g("playoffs", 70, "Make the playoffs (top 70)", 1), g("top10s", 5, "Five top-10 finishes", 2), g("win", 1, "Win an event", 2), g("points-top", 30, "Reach the Tour Championship (top 30)", 3)];
  }
  return [g("points-top", 30, "Reach the Tour Championship (top 30)", 1), g("top10s", 8, "Eight top-10 finishes", 2), g("major-top10", 1, "A top 10 in a major", 2), g("win", 2, "Win twice", 3)];
}

/** How far along a goal is this season: current against target. */
export function goalProgress(world: World, wp: WorldPlayer, goal: SeasonGoal): { current: number; target: number; met: boolean; text: string } {
  const season = wp.career.results.filter((r) => r.season === world.season);
  const main = season.filter((r) => r.tier !== "dev");
  const rank = pointsList(world).indexOf(wp.player.id) + 1 || 999;
  switch (goal.kind) {
    case "cuts": {
      const n = season.filter((r) => r.madeCut).length;
      return { current: n, target: goal.target, met: n >= goal.target, text: `${n} of ${goal.target}` };
    }
    case "top10s": {
      const n = season.filter((r) => r.madeCut && r.position <= 10).length;
      return { current: n, target: goal.target, met: n >= goal.target, text: `${n} of ${goal.target}` };
    }
    case "win": {
      const n = main.filter((r) => r.position === 1).length;
      return { current: n, target: goal.target, met: n >= goal.target, text: `${n} of ${goal.target}` };
    }
    case "major-top10": {
      const n = season.filter((r) => r.tier === "major" && r.madeCut && r.position <= 10).length;
      return { current: n, target: goal.target, met: n >= goal.target, text: n ? "Done" : "Not yet" };
    }
    case "card":
    case "playoffs":
    case "points-top":
      return { current: rank, target: goal.target, met: rank <= goal.target, text: rank < 999 ? `#${rank} now (needs top ${goal.target})` : `Not on the list yet (needs top ${goal.target})` };
  }
}

/** Every client has this season's offers; after week 4, two goals are agreed whether you picked or not. */
export function ensureGoals(world: World): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    const c = wp?.client;
    if (!wp || !c) continue;
    if (c.goalsSeason !== world.season) {
      c.goalsSeason = world.season;
      c.goalOffers = offerGoals(world, wp);
      c.goals = [];
    }
    if ((c.goals?.length ?? 0) < GOALS_TO_AGREE && world.week >= AUTO_PICK_WEEK) {
      const pick = (c.goalOffers ?? []).filter((g) => !c.goals!.some((x) => x.id === g.id)).sort((a, b) => a.difficulty - b.difficulty);
      c.goals = [...(c.goals ?? []), ...pick.slice(0, GOALS_TO_AGREE - (c.goals?.length ?? 0))];
    }
  }
}

/** Agree (or un-agree) a goal; at most two, and only before week 4. */
export function toggleGoal(world: World, clientId: string, goalId: string): void {
  const c = world.players[clientId]?.client;
  if (!c || world.week >= AUTO_PICK_WEEK) return;
  const goals = (c.goals ??= []);
  const i = goals.findIndex((g) => g.id === goalId);
  if (i >= 0) goals.splice(i, 1);
  else if (goals.length < GOALS_TO_AGREE) {
    const g = c.goalOffers?.find((x) => x.id === goalId);
    if (g) goals.push({ ...g });
  }
}

export const goalsLocked = (world: World): boolean => world.week >= AUTO_PICK_WEEK;

/** Season end: settle the goals. Returns one news line per client with goals. */
export function settleGoals(world: World): string[] {
  const lines: string[] = [];
  for (const id of world.clientIds) {
    const wp = world.players[id];
    const c = wp?.client;
    if (!wp || !c?.goals?.length || c.goalsSeason !== world.season) continue;
    let met = 0;
    for (const g of c.goals) {
      g.done = goalProgress(world, wp, g).met;
      if (g.done) {
        met++;
        c.happiness = clamp(c.happiness + 4 + g.difficulty * 2, 0, 100);
        addReputation(world.agency, g.difficulty * 1.5);
      } else c.happiness = clamp(c.happiness - 5, 0, 100);
    }
    lines.push(`${wp.player.name} met ${met} of his ${c.goals.length} season goals.`);
  }
  return lines;
}
