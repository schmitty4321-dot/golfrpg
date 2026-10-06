/**
 * The week in review, for the screen after an event: each client's week
 * (result, money, rankings, how his game held up, his best and worst holes,
 * the calls you made, goals, mood and what's next), the agency's week, and
 * the event's story. Built from a snapshot taken as the week starts and the
 * world as it stands afterwards.
 */
import { SG_CATEGORIES, standingsAfterRound, type StrokesGained, type TournamentResult } from "../engine";
import { ACHIEVEMENTS } from "./achievements";
import { DEV_GRADUATES } from "./calendar";
import { goalProgress } from "./goals";
import { pointsList, rankMap } from "./points";
import type { AgencyLedger, World } from "./types";
import type { WeekReport } from "./week";
import { FULL_CARD, devPointsList } from "./world";

export interface WeekSnapshot {
  bank: number;
  reputation: number;
  ledger: AgencyLedger;
  achievements: string[];
  clients: Record<string, { worldRank: number | null; pointsRank: number | null; devRank: number | null; happiness: number; trust: number; followers: number }>;
}

/** Where the agency and each client stand as a week begins. */
export function takeSnapshot(world: World): WeekSnapshot {
  const ranks = rankMap(world);
  const points = pointsList(world);
  const dev = devPointsList(world);
  const clients: WeekSnapshot["clients"] = {};
  for (const id of world.clientIds) {
    const c = world.players[id]?.client;
    if (!c) continue;
    const pr = points.indexOf(id);
    const dr = dev.indexOf(id);
    clients[id] = { worldRank: ranks.get(id) ?? null, pointsRank: pr >= 0 ? pr + 1 : null, devRank: dr >= 0 ? dr + 1 : null, happiness: c.happiness, trust: c.trust ?? 60, followers: c.followers ?? 0 };
  }
  return { bank: world.agency.bank, reputation: world.agency.reputation, ledger: { ...world.agency.ledger }, achievements: Object.keys(world.achievements ?? {}), clients };
}

export interface ClientWeek {
  id: string;
  name: string;
  eventName: string;
  label: string;
  toPar: number;
  madeCut: boolean;
  earnings: number;
  commission: number;
  points: number;
  devTour: boolean;
  worldRank: { before: number | null; after: number | null };
  /** The list that decides his card (main-tour points, or the dev tour's), before and after. */
  race: { label: string; before: number | null; after: number | null; line: number; lineLabel: string };
  /** Strokes gained against the field, by category, for the week. */
  sg: StrokesGained;
  best: { round: number; hole: number; toPar: number } | null;
  worst: { round: number; hole: number; toPar: number } | null;
  /** Holes where you made the call. */
  callsMade: number;
  roundCalls: string[];
  goals: { text: string; met: boolean }[];
  mood: { before: number; after: number };
  trust: { before: number; after: number };
  condition: number;
  form: number;
  nextWeek: string;
}

export interface AgencyWeek {
  commission: number;
  costs: number;
  net: number;
  bankBefore: number;
  bankAfter: number;
  reputation: { before: number; after: number };
  achievements: string[];
  /** The best finish by each rival agency's players in your clients' events. */
  rivals: { agency: string; name: string; label: string; eventName: string }[];
}

export interface EventStory {
  eventName: string;
  winner: string;
  winningScore: number;
  playoff: string[];
  lowRound: { name: string; score: number; round: number } | null;
  cutLine: number | null;
  mover: { name: string; places: number } | null;
}

export interface WeekSummary {
  clients: ClientWeek[];
  agency: AgencyWeek | null;
  events: EventStory[];
}

const COSTS = ["office", "scouts", "development", "facility", "interest", "staff", "clientCare"];

/** The week in review (no agency part when there's no snapshot). */
export function weekSummary(world: World, report: WeekReport): WeekSummary {
  const before = report.before;
  const ranks = rankMap(world);
  const points = pointsList(world);
  const dev = devPointsList(world);
  const clients: ClientWeek[] = [];
  for (const [id, cw] of Object.entries(report.clients)) {
    const wp = world.players[id];
    const rec = cw.record;
    const result = cw.result;
    if (!wp?.client || !rec || !result) continue;
    const row = result.leaderboard.find((r) => r.player.id === id);
    if (!row) continue;
    const snap = before?.clients[id];
    const devTour = rec.tier === "dev";
    const pr = points.indexOf(id);
    const dr = dev.indexOf(id);
    const race = devTour
      ? { label: "Dev tour points", before: snap?.devRank ?? null, after: dr >= 0 ? dr + 1 : null, line: DEV_GRADUATES, lineLabel: `top ${DEV_GRADUATES} graduate` }
      : { label: "Season points", before: snap?.pointsRank ?? null, after: pr >= 0 ? pr + 1 : null, line: FULL_CARD, lineLabel: `top ${FULL_CARD} keep a card` };
    // Best and worst holes against par.
    let best: ClientWeek["best"] = null;
    let worst: ClientWeek["worst"] = null;
    row.holes.forEach((holes, r) =>
      holes.forEach((score, h) => {
        const d = score - result.course.holes[h]!.par;
        if (!best || d < best.toPar) best = { round: r + 1, hole: h + 1, toPar: d };
        if (!worst || d > worst.toPar) worst = { round: r + 1, hole: h + 1, toPar: d };
      }),
    );
    // Your own calls only: the round plan's automatic choices aren't yours.
    const callsMade = row.yourCalls ?? 0;
    const c = wp.client;
    const goals = (c.goals ?? []).map((g) => {
      const p = goalProgress(world, wp, g);
      return { text: `${g.label} (${p.text})`, met: p.met };
    });
    const condition = Math.round(wp.player.condition);
    const nextWeek = wp.injury ? `Injured: out about ${wp.injury.weeksLeft} weeks.` : condition < 70 ? "Running on empty: a rest week would help." : condition < 82 ? "A bit tired: rest or pick a light week." : "Fresh enough to play next week.";
    clients.push({
      id,
      name: wp.player.name,
      eventName: rec.eventName,
      label: rec.label,
      toPar: rec.toPar,
      madeCut: rec.madeCut,
      earnings: rec.earnings,
      commission: Math.round(rec.earnings * c.contract.commission),
      points: rec.seasonPoints,
      devTour,
      worldRank: { before: snap?.worldRank ?? null, after: ranks.get(id) ?? null },
      race,
      sg: row.sg,
      best,
      worst,
      callsMade,
      roundCalls: (report.calls ?? []).filter((line) => line.startsWith(wp.player.name)),
      goals,
      mood: { before: snap?.happiness ?? c.happiness, after: c.happiness },
      trust: { before: snap?.trust ?? c.trust ?? 60, after: c.trust ?? 60 },
      condition,
      form: wp.player.form,
      nextWeek,
    });
  }

  let agency: AgencyWeek | null = null;
  if (before) {
    const l = world.agency.ledger as unknown as Record<string, number>;
    const b = before.ledger as unknown as Record<string, number>;
    const diff = (k: string) => (l[k] ?? 0) - (b[k] ?? 0);
    const commission = diff("prizeCommission") + diff("endorsementCommission");
    const costs = COSTS.reduce((s, k) => s + diff(k), 0);
    const had = new Set(before.achievements);
    const achievements = Object.keys(world.achievements ?? {})
      .filter((id) => !had.has(id))
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title ?? id);
    agency = {
      commission,
      costs,
      net: world.agency.bank - before.bank,
      bankBefore: before.bank,
      bankAfter: world.agency.bank,
      reputation: { before: before.reputation, after: world.agency.reputation },
      achievements,
      rivals: rivalFinishes(world, report),
    };
  }

  const events: EventStory[] = [];
  const seen = new Set<string>();
  for (const cw of Object.values(report.clients)) {
    const result = cw.result;
    if (!result || !cw.record || seen.has(cw.record.eventId)) continue;
    seen.add(cw.record.eventId);
    events.push(eventStory(cw.record.eventName, result));
  }
  return { clients, agency, events };
}

function rivalFinishes(world: World, report: WeekReport): AgencyWeek["rivals"] {
  const best = new Map<string, AgencyWeek["rivals"][number] & { position: number }>();
  const seen = new Set<string>();
  for (const cw of Object.values(report.clients)) {
    if (!cw.result || !cw.record || seen.has(cw.record.eventId)) continue;
    seen.add(cw.record.eventId);
    for (const row of cw.result.leaderboard) {
      const agency = world.players[row.player.id]?.agent?.agency;
      if (!agency || !row.madeCut) continue;
      const cur = best.get(agency);
      if (!cur || row.position < cur.position) best.set(agency, { agency, name: row.player.name, label: row.positionLabel, eventName: cw.record.eventName, position: row.position });
    }
  }
  return [...best.values()].sort((a, b) => a.position - b.position).slice(0, 4).map((r) => ({ agency: r.agency, name: r.name, label: r.label, eventName: r.eventName }));
}

function eventStory(eventName: string, result: TournamentResult): EventStory {
  const winner = result.leaderboard[0]!;
  let low: EventStory["lowRound"] = null;
  for (const r of result.leaderboard) {
    r.rounds.forEach((s, i) => {
      if (!low || s < low.score) low = { name: r.player.name, score: s, round: i + 1 };
    });
  }
  const rounds = Math.max(...result.leaderboard.map((r) => r.rounds.length));
  let mover: EventStory["mover"] = null;
  if (rounds >= 2) {
    for (const s of standingsAfterRound(result, rounds)) {
      if (s.active && s.movement !== null && (!mover || s.movement > mover.places)) mover = { name: s.player.name, places: s.movement };
    }
  }
  return {
    eventName,
    winner: winner.player.name,
    winningScore: winner.toPar,
    playoff: result.playoff ? result.playoff.players.map((id) => result.leaderboard.find((r) => r.player.id === id)?.player.name ?? id) : [],
    lowRound: low,
    cutLine: result.cutLine,
    mover,
  };
}

/** The strongest and weakest parts of his game this week. */
export function sgExtremes(sg: StrokesGained): { best: keyof StrokesGained; worst: keyof StrokesGained } {
  const sorted = [...SG_CATEGORIES].sort((a, b) => sg[b] - sg[a]);
  return { best: sorted[0]!, worst: sorted[sorted.length - 1]! };
}
