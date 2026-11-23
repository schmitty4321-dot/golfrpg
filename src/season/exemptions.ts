/**
 * Sponsor exemptions: a tournament's own invitations into a field a player
 * isn't in on status. Each regular event gives 4 and each signature event 2
 * (major invitations stay as they are). Your agency can ask for one for a
 * client a few times a season; the answer comes by that event's Monday. The
 * computer agencies' players take the spots nobody you manage got: former
 * winners of the event, top amateurs just turned pro, young players with a high ceiling, and
 * the developmental tour's leaders. Exemptions come off the bottom of the
 * status order, as on the real tour, so a field's size never changes.
 *
 * Events in this game have no brand title sponsors, so the sponsor link in the
 * odds is the agency's own title partnership (investments.ts): asking for that
 * event is all but certain.
 */
import { clamp, createRng, traceSeed } from "../engine";
import { NATIONS } from "../engine/nations";
import { addDecision } from "./inbox";
import { invitedField, isInvitational, mixSeed, weekContext, type WeekContext } from "./entries";
import { titleEvent } from "./investments";
import { qRating } from "./lifestyle";
import { ryderCupPlayers } from "./ryderCup";
import type { TourEvent, World, WorldPlayer } from "./types";

/** Sponsor exemptions in each regular (open) event. */
export const REGULAR_EXEMPTIONS = 4;
/** Sponsor exemptions in each signature event. */
export const SIGNATURE_EXEMPTIONS = 2;
/** Asks an agency gets each season before reputation adds more. */
export const BASE_ASKS = 3;

export interface ExemptionAsk {
  playerId: string;
  eventId: string;
  season: number;
  /** The week you asked. */
  week: number;
  /** Set by the event's Monday. */
  answer?: "yes" | "no";
}

/** How many sponsor exemptions an event gives (0: none, e.g. majors, playoffs, match play, the developmental tour). */
export function exemptionSpots(event: TourEvent): number {
  if (event.format === "matchplay") return 0;
  if (event.tier === "standard" || event.tier === "opposite") return REGULAR_EXEMPTIONS;
  if (event.tier === "signature") return SIGNATURE_EXEMPTIONS;
  return 0;
}

/** Asks a season: 3, one more at reputation 50 and another at 80. */
export const asksAllowed = (world: World): number => BASE_ASKS + (world.agency.reputation >= 50 ? 1 : 0) + (world.agency.reputation >= 80 ? 1 : 0);

/** This season's asks (older ones are dropped as new ones are made). */
export const exemptionAsks = (world: World): ExemptionAsk[] => (world.agency.exemptions ?? []).filter((a) => a.season === world.season);

/** Every ask counts, a "no" as much as a "yes". */
export const asksLeft = (world: World): number => Math.max(0, asksAllowed(world) - exemptionAsks(world).length);

export const askFor = (world: World, clientId: string, eventId: string): ExemptionAsk | undefined =>
  exemptionAsks(world).find((a) => a.playerId === clientId && a.eventId === eventId);

/** Your clients given an exemption into this event this season. */
export const grantedClients = (world: World, eventId: string): string[] =>
  exemptionAsks(world).filter((a) => a.eventId === eventId && a.answer === "yes" && world.clientIds.includes(a.playerId)).map((a) => a.playerId);

export const hasExemption = (world: World, clientId: string, eventId: string): boolean => askFor(world, clientId, eventId)?.answer === "yes";

const eventById = (world: World, eventId: string): TourEvent | undefined => world.schedule.find((e) => e.id === eventId);

/** His wins on the developmental tour this season and last. */
function recentDevWins(world: World, wp: WorldPlayer): number {
  return wp.career.results.filter((r) => r.tier === "dev" && r.position === 1 && r.season >= world.season - 1).length;
}

export interface ExemptionOdds {
  /** 0-1. */
  chance: number;
  /** A rough read in plain words. */
  read: string;
  /** What helps, in plain words. */
  reasons: string[];
}

/** A rough read of a chance, in plain words. */
export function oddsWord(chance: number): string {
  if (chance >= 0.9) return "Nearly certain";
  if (chance >= 0.65) return "Good chance";
  if (chance >= 0.45) return "About even";
  if (chance >= 0.25) return "Long shot";
  return "Very unlikely";
}

/**
 * The chance the tournament says yes: your agency's name, his Q rating, a home
 * event, recent developmental tour wins, and your title partnership. Signature
 * events have half the spots and twice the demand.
 */
export function exemptionOdds(world: World, wp: WorldPlayer, event: TourEvent): ExemptionOdds {
  const reasons: string[] = [];
  if (event.id === titleEvent(world)) return { chance: 0.97, read: oddsWord(0.97), reasons: ["Your agency's name is on the event"] };
  const rep = world.agency.reputation;
  let p = 0.08 + rep / 250;
  if (rep >= 50) reasons.push("your agency's name");
  const q = qRating(world, wp);
  p += clamp((q - 40) * 0.008, -0.08, 0.3);
  if (q >= 50) reasons.push(`his Q rating (${Math.round(q)})`);
  const course = world.courses.find((c) => c.id === event.courseId);
  const code = NATIONS[wp.player.nationality]?.code;
  if (code && course?.info?.country === code) {
    p += code === "USA" ? 0.04 : 0.15;
    if (code !== "USA") reasons.push("a home event");
  }
  const wins = recentDevWins(world, wp);
  if (wins > 0) {
    p += Math.min(0.25, wins * 0.1);
    reasons.push(`${wins} developmental tour win${wins === 1 ? "" : "s"}`);
  }
  if (event.tier === "signature") p *= 0.5;
  const chance = Math.round(clamp(p, 0.03, 0.9) * 100) / 100;
  return { chance, read: oddsWord(chance), reasons };
}

/** Whether he needs an exemption to play: no status for a regular event, or no invitation for a signature event. */
function needsOne(world: World, wp: WorldPlayer, event: TourEvent, ctx?: WeekContext): boolean {
  if (event.tier === "signature") return !invitedField(world, ctx ?? weekContext(world), event).includes(wp.player.id);
  return wp.career.status === "none" || wp.career.status === "conditional";
}

/** Why you can't ask for this client and event now, or null when you can. */
export function askBlock(world: World, clientId: string, eventId: string, ctx?: WeekContext): string | null {
  const wp = world.players[clientId];
  if (!wp?.client) return "He isn't your client.";
  const event = eventById(world, eventId);
  if (!event) return "No such event.";
  if (event.week < world.week) return "That event has been played.";
  if (exemptionSpots(event) === 0) {
    if (event.tier === "major") return "Majors invite their own fields.";
    if (event.tier === "dev") return "The developmental tour has no sponsor exemptions.";
    return isInvitational(event.tier) ? "This field is decided by points or ranking only." : "No sponsor exemptions here.";
  }
  if (wp.career.status === "amateur") return "Amateurs can't take one here. Turn him pro first.";
  const asked = askFor(world, clientId, eventId);
  if (asked) return asked.answer === "yes" ? "He has an exemption." : asked.answer === "no" ? "They said no." : "You've asked; the answer comes by the Monday.";
  if (!needsOne(world, wp, event, ctx)) return event.tier === "signature" ? "He's in the field already." : "He gets in on status.";
  if (asksLeft(world) <= 0) return `No asks left this season (${asksAllowed(world)} used).`;
  return null;
}

/** Asks the tournament for an exemption. The answer comes by the event's Monday (straight away for this week's events). */
export function askExemption(world: World, clientId: string, eventId: string): string {
  const block = askBlock(world, clientId, eventId);
  if (block) return block;
  const event = eventById(world, eventId)!;
  const name = world.players[clientId]!.player.name;
  world.agency.exemptions = [...exemptionAsks(world), { playerId: clientId, eventId, season: world.season, week: world.week }];
  if (event.week <= world.week) {
    answerExemptions(world);
    return askFor(world, clientId, eventId)?.answer === "yes" ? `${event.name} said yes: ${name} has a sponsor exemption.` : `${event.name} said no to ${name}.`;
  }
  return `You asked ${event.name} for an exemption for ${name}. The answer comes by week ${event.week}'s Monday.`;
}

/** Answers every ask whose event is this week (called as each week begins). Each answer is fixed by the seed. */
export function answerExemptions(world: World): void {
  for (const a of exemptionAsks(world)) {
    if (a.answer) continue;
    const event = eventById(world, a.eventId);
    const wp = world.players[a.playerId];
    if (!event || !wp?.client) {
      a.answer = "no";
      continue;
    }
    if (event.week > world.week) continue;
    const { chance } = exemptionOdds(world, wp, event);
    const rng = createRng(mixSeed(world.seed, world.season, event.week, traceSeed("exemption", a.eventId, a.playerId)));
    a.answer = rng.next() < chance ? "yes" : "no";
    const yes = a.answer === "yes";
    const name = wp.player.name;
    addDecision(world, {
      kind: "message",
      key: `exemption-${a.eventId}`,
      clientId: a.playerId,
      from: event.name,
      title: yes ? `Sponsor exemption for ${name}` : `No exemption for ${name}`,
      text: yes
        ? `${event.name} has given ${name} one of its sponsor exemptions for week ${event.week}. Enter him that week; his schedule shows "Sponsor exemption".`
        : `${event.name} can't find a spot for ${name} this year. The ask still counts against this season's ${asksAllowed(world)}.${event.tier === "signature" ? "" : " He can still try the Monday qualifier."}`,
      choices: [{ id: "ok", label: "Noted", detail: yes ? "He's in if you enter him." : "Nothing more to do.", effects: [] }],
      defaultChoice: "ok",
      big: false,
    });
    world.news.unshift(yes ? `${name} gets a sponsor exemption into ${event.name}.` : `${event.name} turned down ${name}'s request for an exemption.`);
  }
}

/**
 * Who the computer agencies get in: former winners of the event first, then
 * the top amateurs who just turned pro (one an event), young players with a high ceiling, and the
 * developmental tour's leaders (for a signature event: the best-ranked pros not
 * invited). Players with an agent get a small push. Seeded, so a week replays
 * the same.
 */
export function aiExemptionPicks(world: World, event: TourEvent, spots: number, exclude: Set<string>): string[] {
  if (spots <= 0) return [];
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 44, traceSeed(event.id)));
  const signature = event.tier === "signature";
  const ryder = new Set(ryderCupPlayers(world));
  const topDev = Math.max(1, ...Object.values(world.players).map((wp) => wp.career.devPoints));
  const scored: { id: string; score: number; amateur: boolean }[] = [];
  for (const wp of Object.values(world.players).sort((a, b) => a.player.id.localeCompare(b.player.id))) {
    const id = wp.player.id;
    const jitter = rng.next() * 0.3;
    if (wp.client || wp.injury || exclude.has(id) || ryder.has(id) || wp.player.condition < 50) continue;
    const c = wp.career;
    // Amateurs only ever play majors in this game, so "top amateurs" are the top of the
    // amateur standing who turned pro this season or last.
    if (c.status === "amateur" || (!signature && c.status !== "none")) continue;
    const place = c.proEntry && c.proEntry.season >= world.season - 1 ? (c.proEntry.place ?? 999) : 999;
    const amateur = place <= 10;
    let score = jitter;
    if (c.results.some((r) => r.eventId === event.id && r.position === 1)) score += 3;
    if (amateur) score += 2.2 - place * 0.2;
    if (wp.player.age <= 24) score += clamp((wp.development.potential - 13) * 0.5, 0, 2);
    if (signature) score += clamp(1.5 - (c.priorPointsRank ?? 200) / 100, 0, 1.5);
    else score += (c.devPoints / topDev) * 1.5;
    if (wp.agent) score += 0.3;
    scored.push({ id, score, amateur });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const out: string[] = [];
  let amateurs = 0;
  for (const s of scored) {
    if (out.length >= spots) break;
    if (s.amateur && amateurs >= 1) continue;
    if (s.amateur) amateurs++;
    out.push(s.id);
  }
  return out;
}

/** One client's place in an upcoming event's exemptions, for the schedule. */
export interface ExemptionRow {
  clientId: string;
  name: string;
  /** "ask": you can ask now; otherwise the state of his ask. */
  state: "ask" | "pending" | "yes" | "no";
  odds: ExemptionOdds;
}

/**
 * For each upcoming event that gives exemptions, your clients who could ask or
 * already have. Worked out once for the whole schedule.
 */
export function exemptionBoard(world: World): Map<string, ExemptionRow[]> {
  const out = new Map<string, ExemptionRow[]>();
  if (!world.clientIds.length) return out;
  const ctx = weekContext(world);
  const invited = new Map<string, Set<string>>();
  for (const event of world.schedule) {
    if (event.week < world.week || exemptionSpots(event) === 0) continue;
    const rows: ExemptionRow[] = [];
    for (const id of world.clientIds) {
      const wp = world.players[id]!;
      if (wp.career.status === "amateur") continue;
      const ask = askFor(world, id, event.id);
      const odds = exemptionOdds(world, wp, event);
      if (ask) {
        rows.push({ clientId: id, name: wp.player.name, state: ask.answer ?? "pending", odds });
        continue;
      }
      if (event.tier === "signature") {
        if (!invited.has(event.id)) invited.set(event.id, new Set(invitedField(world, ctx, event)));
        if (invited.get(event.id)!.has(id)) continue;
      } else if (!(wp.career.status === "none" || wp.career.status === "conditional")) continue;
      rows.push({ clientId: id, name: wp.player.name, state: "ask", odds });
    }
    if (rows.length) out.set(event.id, rows);
  }
  return out;
}
