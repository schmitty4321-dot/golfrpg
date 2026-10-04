/**
 * The rivals' head agents: each agency gets a face and a voice. They message
 * you when they poach a client, when their player beats yours, when yours
 * wins, when they sign someone off your board, and (the friendly ones) with
 * the odd tip-off. How you answer moves your relationship with them, from
 * hostile (-100) to friendly (100): hostile agents bid harder against you and
 * come for your unhappy clients first; friendly ones ease off and share tips.
 */
import { clamp, type Rng } from "../engine";
import { addDecision, lastFired, type Choice } from "./inbox";
import { absWeek, type World } from "./types";
import type { WeekReport } from "./week";
import { ensureRivals } from "./rivals";
import { amateurRanking } from "./amateurs";

export type Voice = "smug" | "fast" | "polished" | "fatherly" | "brash" | "warm";

/** Each head agent has his (or her) own picture: seasoned faces, no two alike (see public/people). */
export const RIVAL_AGENTS: Record<string, { agent: string; voice: Voice; portrait: number }> = {
  "Apex Sports Management": { agent: "Grant Sterling", voice: "smug", portrait: 188 },
  "Fairway Global": { agent: "Rick Moreno", voice: "fast", portrait: 108 },
  "Links & Co.": { agent: "Fiona Ashby", voice: "polished", portrait: 98 },
  "Pinnacle Talent": { agent: "Walt Brennan", voice: "fatherly", portrait: 65 },
  "Clubhouse Partners": { agent: "Tommy Vance", voice: "brash", portrait: 141 },
  "Eagle Rock Agency": { agent: "Maya Okonkwo", voice: "warm", portrait: 137 },
};

export const agentOf = (agency: string): { agent: string; voice: Voice; portrait?: number } => RIVAL_AGENTS[agency] ?? { agent: "Their head agent", voice: "polished" };
export const relationshipOf = (world: World, agency: string): number => world.rivals?.find((r) => r.name === agency)?.relationship ?? 0;

export function relationshipWord(v: number): string {
  if (v >= 50) return "Friendly";
  if (v >= 20) return "Warm";
  if (v > -20) return "Neutral";
  if (v > -50) return "Cool";
  return "Hostile";
}

/** How hard a rival bids against you: hostile up to 1.5 times as hard, friendly as little as half. */
export const bidPressure = (world: World, agency: string): number => 1 - relationshipOf(world, agency) / 200;

type Trigger = "poach" | "beatYours" | "yourWin" | "boardSigning" | "tip";

const LINES: Record<Voice, Record<Trigger, (who: string) => string>> = {
  smug: {
    poach: (w) => `"${w} wanted a winner's agency. No hard feelings. Well, a few."`,
    beatYours: (w) => `"Saw ${w} finished behind our guy again. Happens a lot, doesn't it?"`,
    yourWin: (w) => `"Nice win for ${w}. Enjoy it, they don't come along often for you."`,
    boardSigning: (w) => `"${w} called us first, you know. They always do."`,
    tip: (w) => `"Between us: keep an eye on ${w}. Don't say I never gave you anything."`,
  },
  fast: {
    poach: (w) => `"Business is business, pal. ${w} is with us now. Call me sometime."`,
    beatYours: (w) => `"Tough break for ${w}! Our kid was on fire, what can you do."`,
    yourWin: (w) => `"Hey, ${w} won! Good for you. Seriously. Lunch sometime?"`,
    boardSigning: (w) => `"${w} signed with us this morning. You snooze, you lose!"`,
    tip: (w) => `"Hot tip, no charge: ${w}. Trust me on this one."`,
  },
  polished: {
    poach: (w) => `"We've welcomed ${w} to the agency. I trust you'll understand."`,
    beatYours: (w) => `"A fine contest. ${w} pushed our player all the way."`,
    yourWin: (w) => `"Congratulations on ${w}'s win. Well managed."`,
    boardSigning: (w) => `"${w} felt we were the better fit. I wish you luck elsewhere."`,
    tip: (w) => `"A quiet word: ${w} is worth your time."`,
  },
  fatherly: {
    poach: (w) => `"${w} needed a fresh start. We'll look after the lad."`,
    beatYours: (w) => `"${w} will get there. Tell him an old man said so."`,
    yourWin: (w) => `"Proud day for ${w}. You're doing right by your players."`,
    boardSigning: (w) => `"I know you liked ${w}. We'll bring him along gently."`,
    tip: (w) => `"Here's one for you: ${w}. Good kid. Needs a good home."`,
  },
  brash: {
    poach: (w) => `"${w} is ours now. Maybe pay your players some attention."`,
    beatYours: (w) => `"Ha! Our guy ate ${w} alive on Sunday."`,
    yourWin: (w) => `"${w} won? Weak field."`,
    boardSigning: (w) => `"Grabbed ${w} off your board. Too slow, friend."`,
    tip: (w) => `"Fine. ${w}. You owe me one."`,
  },
  warm: {
    poach: (w) => `"I'm sorry it happened this way. ${w} came to us; I hope we can stay on good terms."`,
    beatYours: (w) => `"${w} played beautifully this week. Next time it's his."`,
    yourWin: (w) => `"Huge congratulations to ${w} and your whole team!"`,
    boardSigning: (w) => `"${w} chose us, but he spoke very highly of you."`,
    tip: (w) => `"Thought you'd want to know about ${w}. We're full up."`,
  },
};

const TITLES: Record<Trigger, string> = {
  poach: "takes one of yours",
  beatYours: "has a word after Sunday",
  yourWin: "on your client's win",
  boardSigning: "signed someone off your board",
  tip: "has a tip for you",
};

function replies(agency: string, trigger: Trigger, clientId: string, tipId?: string): { choices: Choice[]; defaultChoice: string } {
  if (trigger === "tip") {
    return {
      choices: [
        { id: "thank", label: "Thank them", detail: "Your scouts get a full report on the player.", effects: [{ k: "scoutBoost", playerId: tipId!, v: 0.7 }, { k: "relationship", agency, v: 4 }] },
        { id: "ignore", label: "Ignore it", detail: "No report, and they notice.", effects: [{ k: "relationship", agency, v: -3 }] },
      ],
      defaultChoice: "thank",
    };
  }
  const backed = clientId ? [{ k: "mood" as const, v: 2 }] : [];
  if (trigger === "yourWin") {
    return {
      choices: [
        { id: "thank", label: "Thank them", detail: "Gracious.", effects: [{ k: "relationship", agency, v: 4 }] },
        { id: "needle", label: "Needle them back", detail: "Your client likes it; they won't.", effects: [{ k: "relationship", agency, v: -8 }, ...backed] },
        { id: "ignore", label: "Say nothing", detail: "Nothing changes.", effects: [] },
      ],
      defaultChoice: "ignore",
    };
  }
  return {
    choices: [
      { id: "gracious", label: "Take it graciously", detail: "They warm to you.", effects: [{ k: "relationship", agency, v: 6 }] },
      { id: "fire", label: "Fire back", detail: "Your clients like that you fight; they'll remember.", effects: [{ k: "relationship", agency, v: -12 }, ...backed] },
      { id: "ignore", label: "Say nothing", detail: "Nothing changes.", effects: [] },
    ],
    defaultChoice: "ignore",
  };
}

/** A message from a rival's head agent (at most one a month per agent, except a poaching). */
export function rivalMessage(world: World, agency: string, trigger: Trigger, aboutName: string, clientId = "", tipId?: string): boolean {
  const key = `msg-${agency}`;
  const last = lastFired(world, key);
  if (last !== null && absWeek(world.season, world.week) - last < 4 && trigger !== "poach") return false;
  const { agent, voice } = agentOf(agency);
  const r = replies(agency, trigger, clientId, tipId);
  addDecision(world, {
    kind: "message",
    key,
    clientId,
    from: agency,
    title: `${agent} (${agency}) ${TITLES[trigger]}`,
    text: LINES[voice][trigger](aboutName),
    choices: r.choices,
    defaultChoice: r.defaultChoice,
    big: false,
  });
  return true;
}

/**
 * Messages after a week: a rival's player beat yours into the places, or yours
 * won; and now and then a friendly agent's tip-off. Returns how many arrived.
 */
export function weeklyRivalMessages(world: World, report: WeekReport, rng: Rng, room: number): number {
  if (room <= 0) return 0;
  let added = 0;
  const mine = new Set(world.clientIds);
  for (const { event, result } of report.results) {
    if (added >= room || event.tier === "dev") continue;
    const winner = result.leaderboard[0];
    if (!winner) continue;
    if (mine.has(winner.player.id)) {
      // Your client won: a friendly agent congratulates you, a hostile one has a dig.
      const r = ensureRivals(world).find((x) => Math.abs(x.relationship ?? 0) >= 25);
      if (r && rng.chance(0.5) && rivalMessage(world, r.name, "yourWin", winner.player.name, winner.player.id)) added++;
      continue;
    }
    const winnerAgency = world.players[winner.player.id]?.agent?.agency;
    if (!winnerAgency) continue;
    const beaten = result.leaderboard.find((row) => mine.has(row.player.id) && row.madeCut && row.position >= 2 && row.position <= 5);
    if (beaten && rng.chance(0.45) && rivalMessage(world, winnerAgency, "beatYours", beaten.player.name, beaten.player.id)) added++;
  }
  // A friendly agent's tip-off: a promising amateur your scouts haven't seen.
  if (added < room && rng.chance(0.04)) {
    const friend = ensureRivals(world).filter((r) => (r.relationship ?? 0) >= 40).sort((a, b) => (b.relationship ?? 0) - (a.relationship ?? 0))[0];
    const tip = friend && amateurRanking(world).slice(3, 15).find((id) => !(world.agency.knowledge[id]?.accuracy ?? 0));
    if (friend && tip && rivalMessage(world, friend.name, "tip", world.players[tip]!.player.name, "", tip)) added++;
  }
  return added;
}

/** A rival poached your client: its agent lets you know. */
export const poachMessage = (world: World, agency: string, name: string): void => void rivalMessage(world, agency, "poach", name);

/** At the winter market, a rival signed someone off your recruitment board. */
export function boardSigningMessages(world: World, signed: { agency: string; name: string; id: string }[]): void {
  const board = new Set(world.agency.shortlist ?? []);
  for (const s of signed) if (board.has(s.id)) rivalMessage(world, s.agency, "boardSigning", s.name);
}

/** Relationships drift back towards neutral over a winter. */
export function rivalRelationshipsSeasonEnd(world: World): void {
  for (const r of ensureRivals(world)) if (r.relationship) r.relationship = Math.round(clamp(r.relationship * 0.85, -100, 100));
}
