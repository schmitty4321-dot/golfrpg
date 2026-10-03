/**
 * Calls between rounds: after each of the first three rounds, at most one
 * quick decision per client, drawn from where he stands (a rough day, the
 * cut line looming, in contention, holding the lead, a hot round). A choice
 * can lift or drag his form for the next round, change his round plan for
 * the rest of the event, and carry effects that land when the week closes
 * (mood, trust, money, followers), through the inbox's effects. The default
 * always does nothing, so a week you don't stop for plays exactly as the
 * simulation is calibrated.
 */
import { createRng, liveSnapshot, traceSeed, type LiveTournament, type RoundPlan } from "../engine";
import { mixSeed } from "./entries";
import { applyEffects, describeEffects, type Effect } from "./inbox";
import type { LiveEvent } from "./week";
import type { World } from "./types";

/** A gamble: `p` chance of the first outcome. */
interface Gamble {
  p: number;
  then: { edge: number; line: string; effects?: Effect[] };
  else: { edge: number; line: string; effects?: Effect[] };
}

export interface RoundChoice {
  id: string;
  label: string;
  /** What it does, in plain words. */
  detail: string;
  /** Strokes per round on his next round (+: sharper). */
  edge?: number;
  /** His round plan for the rest of the event. */
  plan?: RoundPlan;
  /** Lands when the week closes. */
  effects?: Effect[];
  gamble?: Gamble;
}

export interface RoundCall {
  /** `${eventId}:${clientId}:${round}`. */
  id: string;
  eventId: string;
  clientId: string;
  /** The round just finished (1-3); the call shapes the next one. */
  round: number;
  key: "lead" | "contending" | "bubble" | "rough" | "hot";
  title: string;
  text: string;
  choices: RoundChoice[];
  defaultChoice: string;
}

export interface RoundCallAnswer {
  choice: string;
  label: string;
  edge: number;
  /** What happened, for the screen. */
  line: string;
  /** A gamble's outcome, for the news. */
  outcome?: string;
  effects: Effect[];
}

const surname = (name: string) => name.split(" ").pop() ?? name;

/** The calls on offer after `round`, one per client at most (none after the final round). */
export function roundCallsFor(world: World, ev: LiveEvent): RoundCall[] {
  const t = ev.tournament;
  const round = t.round;
  if (round < 1 || round > 3 || Object.keys(t.live).length) return [];
  const snap = liveSnapshot(t);
  const rows = snap.leaderboard;
  if (!rows.length) return [];
  const today = rows.filter((r) => r.rounds.length >= round).map((r) => r.rounds[round - 1]!);
  const fieldAvg = today.reduce((a, b) => a + b, 0) / Math.max(1, today.length);
  const leader = rows[0]!.toPar;
  const out: RoundCall[] = [];
  for (const id of ev.clientIds) {
    const row = rows.find((r) => r.player.id === id);
    const wp = world.players[id];
    if (!row || !wp || row.rounds.length < round || !t.entries.find((e) => e.player.id === id)?.active) continue;
    const name = wp.player.name;
    const last = surname(name);
    const score = row.rounds[round - 1]!;
    const diff = score - fieldAvg;
    const behind = row.toPar - leader;
    const cutTop = t.config.cutTop;
    const base = { id: `${ev.event.id}:${id}:${round}`, eventId: ev.event.id, clientId: id, round };
    const where = `${row.positionLabel} at ${row.toPar > 0 ? "+" : ""}${row.toPar === 0 ? "E" : row.toPar}`;
    if (round >= 2 && behind <= 0) {
      out.push({
        ...base,
        key: "lead",
        title: `${name} leads the ${ev.event.name}`,
        text: `${where} after ${round} rounds. He's never slept on a lead like this. How do you handle tonight?`,
        defaultChoice: "usual",
        choices: [
          { id: "usual", label: "Business as usual", detail: "Same dinner, same routine." },
          { id: "psych", label: "Book a sports psychologist", detail: "A late call to settle the nerves. Sharper tomorrow; $15,000.", edge: 0.2, effects: [{ k: "agencyCost", v: 15_000 }] },
          { id: "go", label: "Tell him to go for it", detail: "Attack every flag from here. He loves the backing.", plan: "attack", effects: [{ k: "trust", v: 2 }] },
        ],
      });
    } else if (round >= 2 && (row.position <= 5 || behind <= 3)) {
      out.push({
        ...base,
        key: "contending",
        title: `${name} is in the hunt`,
        text: `${where}, ${behind} back. The media want time with him, and he's buzzing.`,
        defaultChoice: "routine",
        choices: [
          { id: "routine", label: "Protect his routine", detail: "No distractions." },
          { id: "media", label: "Line up a media day", detail: "Followers and an appearance fee, but a scattered head tomorrow.", edge: -0.15, effects: [{ k: "followers", v: 0.03 }, { k: "buzz", v: 0.04 }, { k: "clientMoney", v: 20_000 }] },
          {
            id: "fire",
            label: "Fire him up",
            detail: "A big speech. It either lands or it doesn't.",
            gamble: { p: 0.55, then: { edge: 0.25, line: `It landed: ${last} is wired.` }, else: { edge: -0.2, line: `Too much: ${last} looks tight.` } },
          },
        ],
      });
    } else if (round === 1 && cutTop !== undefined && row.position > cutTop - 20 && row.position < cutTop + 25) {
      out.push({
        ...base,
        key: "bubble",
        title: `${name} is near the cut line`,
        text: `${where} after day one, around the projected cut of the top ${cutTop}. Friday decides his week.`,
        defaultChoice: "routine",
        choices: [
          { id: "routine", label: "Keep the routine", detail: "Trust what got him here." },
          { id: "range", label: "Range session till dark", detail: "Grind it out tonight. Sharper tomorrow, but it costs him energy.", edge: 0.2, effects: [{ k: "condition", v: -5 }] },
          { id: "safe", label: "Simplify the game plan", detail: "Fairways and middle of the greens from here: no big numbers.", plan: "protect" },
        ],
      });
    } else if (diff >= 3) {
      out.push({
        ...base,
        key: "rough",
        title: `${name} shot ${score}`,
        text: `${Math.round(diff)} worse than the field today. He's slamming lockers.`,
        defaultChoice: "leave",
        choices: [
          { id: "leave", label: "Leave him alone", detail: "He'll sleep it off." },
          {
            id: "talk",
            label: "Talk it through",
            detail: "Sit down with him tonight. Could settle him, could wind him up.",
            gamble: { p: 0.6, then: { edge: 0.25, line: `${last} settled down after the talk.`, effects: [{ k: "mood", v: 2 }] }, else: { edge: -0.1, line: `${last} didn't want to hear it.`, effects: [{ k: "mood", v: -3 }] } },
          },
          { id: "range", label: "Extra range session", detail: "Find the fault before tomorrow. Better swing, tired legs.", edge: 0.15, effects: [{ k: "condition", v: -4 }] },
        ],
      });
    } else if (diff <= -4) {
      out.push({
        ...base,
        key: "hot",
        title: `${name} shot ${score}`,
        text: `${Math.round(-diff)} better than the field today, and every outlet wants him.`,
        defaultChoice: "focus",
        choices: [
          { id: "focus", label: "Keep him focused", detail: "Straight back to the hotel." },
          { id: "interviews", label: "Do the interviews", detail: "Ride the wave: followers and buzz, a little less focus.", edge: -0.1, effects: [{ k: "followers", v: 0.04 }, { k: "buzz", v: 0.05 }] },
        ],
      });
    }
  }
  return out;
}

/** What a choice does, in short words for the card. */
export function describeRoundChoice(c: RoundChoice): string {
  const parts: string[] = [];
  if (c.edge) parts.push(c.edge > 0 ? "sharper tomorrow" : "less focused tomorrow");
  if (c.gamble) parts.push(`${Math.round(c.gamble.p * 100)}% it works`);
  if (c.plan) parts.push(`plays ${c.plan === "attack" ? "aggressively" : "safe"} from here`);
  const fx = c.effects?.length ? describeEffects(c.effects) : "";
  if (fx) parts.push(fx);
  return parts.join(" · ");
}

/** Makes a call: sets his next round's form and plan now; the rest lands when the week closes. Returns what happened. */
export function answerRoundCall(world: World, ev: LiveEvent, call: RoundCall, choiceId: string): RoundCallAnswer {
  const answers = (ev.answers ??= {});
  if (answers[call.id]) return answers[call.id]!;
  const choice = call.choices.find((c) => c.id === choiceId) ?? call.choices.find((c) => c.id === call.defaultChoice)!;
  const t: LiveTournament = ev.tournament;
  let edge = choice.edge ?? 0;
  let line = "";
  let outcome: string | undefined;
  const effects = [...(choice.effects ?? [])];
  if (choice.gamble) {
    const rng = createRng(mixSeed(world.seed, world.season, world.week, 2301, traceSeed(call.id)));
    const out = rng.chance(choice.gamble.p) ? choice.gamble.then : choice.gamble.else;
    edge = out.edge;
    line = outcome = out.line;
    effects.push(...(out.effects ?? []));
  }
  if (edge) t.boosts[`${call.clientId}:${call.round + 1}`] = edge;
  if (choice.plan) t.plans[call.clientId] = choice.plan;
  if (!line) line = edge > 0 ? "He should be sharper tomorrow." : edge < 0 ? "It may cost him some focus tomorrow." : choice.plan ? "New plan for the rest of the week." : "";
  const answer: RoundCallAnswer = { choice: choice.id, label: choice.label, edge, line, effects, ...(outcome ? { outcome } : {}) };
  answers[call.id] = answer;
  return answer;
}

/** Lands the week's calls (mood, trust, money, followers) and puts them in the news. Call once the week has been played. */
export function settleRoundCalls(world: World, events: LiveEvent[]): string[] {
  const out: string[] = [];
  for (const ev of events) {
    for (const [id, a] of Object.entries(ev.answers ?? {})) {
      const [, clientId, round] = id.split(":") as [string, string, string];
      const wp = world.players[clientId];
      if (!wp?.client) continue;
      const lines: string[] = [];
      const rng = createRng(mixSeed(world.seed, world.season, world.week, 2302, traceSeed(id)));
      if (a.effects.length) applyEffects(world, wp, a.effects, rng, lines);
      // Only the calls you actually made make the news.
      if (a.edge || a.effects.length || a.line) {
        const line = [`${wp.player.name}, after round ${round} of the ${ev.event.name}: ${a.label}.`, a.outcome, ...lines].filter(Boolean).join(" ");
        world.news.unshift(line);
        out.push(line);
      }
    }
  }
  return out;
}
