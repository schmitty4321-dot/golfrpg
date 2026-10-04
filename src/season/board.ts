/**
 * The owners: a few targets each season (profit, reputation, a client near
 * the top of the points list), a bonus for hitting them, and patience that
 * runs out. Two losing seasons running bring a warning; a third, a bailout
 * that keeps the doors open at a cost to the agency's name.
 */
import { addReputation } from "./agency";
import { agencyProfit } from "./business";
import { pointsList } from "./points";
import type { AgencyLedger, World } from "./types";

export type ObjectiveKind = "profit" | "reputation" | "clientRank";

export interface Objective {
  kind: ObjectiveKind;
  target: number;
  label: string;
  met?: boolean;
}

export interface BoardState {
  season: number;
  objectives: Objective[];
  /** Losing seasons in a row. */
  losses: number;
  /** What the owners said last winter. */
  verdict?: string;
}

/** Cash bonus, as a share of the profit target, for meeting every objective. */
const FULL_MARKS_BONUS = 0.25;
export const BAILOUT = 1_000_000;

export const boardOf = (world: World): BoardState | undefined => world.agency.board;

/** This season's targets, set from where the agency stands. */
export function setObjectives(world: World): BoardState {
  const rep = world.agency.reputation;
  const profit = Math.max(100_000, Math.round((rep * 15_000) / 50_000) * 50_000);
  const repTarget = Math.min(90, Math.round(rep + 3));
  const rank = rep >= 60 ? 30 : rep >= 30 ? 100 : 150;
  const prev = world.agency.board;
  const board: BoardState = {
    season: world.season,
    losses: prev?.losses ?? 0,
    ...(prev?.verdict ? { verdict: prev.verdict } : {}),
    objectives: [
      { kind: "profit", target: profit, label: `Make a profit of $${(profit / 1000).toLocaleString("en-US")}k` },
      { kind: "reputation", target: repTarget, label: `Reach reputation ${repTarget}` },
      { kind: "clientRank", target: rank, label: `A client in the top ${rank} of the points list` },
    ],
  };
  world.agency.board = board;
  return board;
}

/** How each objective stands right now. */
export function objectiveProgress(world: World, o: Objective, ledger: AgencyLedger = world.agency.ledger): { now: number; met: boolean } {
  if (o.kind === "profit") {
    const now = agencyProfit(ledger);
    return { now, met: now >= o.target };
  }
  if (o.kind === "reputation") return { now: Math.round(world.agency.reputation), met: world.agency.reputation >= o.target };
  const list = pointsList(world);
  const best = Math.min(999, ...world.clientIds.map((id) => list.indexOf(id) + 1).filter((r) => r > 0));
  return { now: best, met: best <= o.target };
}

/** The owners' verdict on the season, from its closing books. Returns a line for the news. */
export function settleBoard(world: World, ledger: AgencyLedger): string | null {
  const board = world.agency.board;
  if (!board || board.season !== world.season) return null;
  let met = 0;
  for (const o of board.objectives) {
    o.met = objectiveProgress(world, o, ledger).met;
    if (o.met) met++;
  }
  const profit = agencyProfit(ledger);
  board.losses = profit < 0 ? board.losses + 1 : 0;
  let verdict: string;
  if (met === board.objectives.length) {
    const bonus = Math.round(board.objectives[0]!.target * FULL_MARKS_BONUS);
    world.agency.bank += bonus;
    addReputation(world.agency, 2);
    verdict = `The owners are delighted: every target met. A $${Math.round(bonus / 1000)}k bonus goes into the bank.`;
  } else if (board.losses >= 3) {
    // Not a gift: the money goes on the credit line, with interest, and word gets around.
    world.agency.bank += BAILOUT;
    world.agency.loan = (world.agency.loan ?? 0) + BAILOUT;
    world.agency.reputation = Math.max(0, world.agency.reputation - 8);
    board.losses = 1;
    verdict = `Three losing seasons: the owners lend the agency $${BAILOUT / 1e6}M to keep the doors open (it goes on the credit line), and word gets around. Turn a profit, or else.`;
  } else if (board.losses === 2) {
    verdict = "Two losing seasons running. The owners want a profit next season.";
  } else {
    verdict = `The owners note ${met} of ${board.objectives.length} targets met.`;
  }
  board.verdict = verdict;
  return verdict;
}
