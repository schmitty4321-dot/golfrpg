/**
 * Contract extras beyond the headline commission: how the commission scales
 * with a big season, a separate rate on majors, a bonus per win, a signing
 * bonus, and a release clause a rival can trigger. Each one changes what the
 * deal pays the agency and how the player feels about it.
 */
import type { WorldPlayer } from "./types";

/** How the prize commission scales: flat, a ladder (more on a big year), or a star deal (less on a big year). */
export type CommissionStructure = "flat" | "ladder" | "star";

export interface DealExtras {
  structure?: CommissionStructure;
  /** The agency's share of major prize money, when it differs from the headline rate. */
  majorCommission?: number;
  /** Paid to the agency for every tour win. */
  winBonus?: number;
  /** Paid by the agency to the player when he signs. */
  signingBonus?: number;
  /** What a rival must pay to take him before the deal ends (none: he can only be poached when he's miserable). */
  releaseClause?: number;
}

/** The season prize money at which a ladder or star deal changes rate, and by how much. */
export const STRUCTURE_AT = 3_000_000;
export const STRUCTURE_STEP = 0.04;

export const STRUCTURE_LABELS: Record<CommissionStructure, { label: string; blurb: string }> = {
  flat: { label: "Flat", blurb: "The same rate on every dollar." },
  ladder: { label: "Ladder", blurb: `+${STRUCTURE_STEP * 100} points on prize money above $${STRUCTURE_AT / 1e6}M a season. Good earners resist it.` },
  star: { label: "Star deal", blurb: `−${STRUCTURE_STEP * 100} points above $${STRUCTURE_AT / 1e6}M a season. Stars love it.` },
};

export const WIN_BONUS_STEPS = [0, 25_000, 50_000, 100_000];
export const SIGNING_BONUS_STEPS = [0, 50_000, 150_000, 300_000];
export const RELEASE_CLAUSE_STEPS = [0, 500_000, 1_500_000, 4_000_000];

/**
 * The agency's cut of one event's prize money: the rate for this event (majors can differ),
 * moved up or down on the part of the season's earnings above the structure line.
 */
export function prizeCut(contract: { commission: number; extras?: DealExtras }, seasonPrizeBefore: number, earnings: number, major: boolean): number {
  const x = contract.extras ?? {};
  const rate = major && x.majorCommission !== undefined ? x.majorCommission : contract.commission;
  if (!x.structure || x.structure === "flat" || earnings <= 0) return Math.round(earnings * rate);
  const below = Math.max(0, Math.min(earnings, STRUCTURE_AT - seasonPrizeBefore));
  const above = earnings - below;
  const step = x.structure === "ladder" ? STRUCTURE_STEP : -STRUCTURE_STEP;
  return Math.round(below * rate + above * Math.max(0, rate + step));
}

/**
 * How the extras sit with a player, in the same score points the acceptance chance uses:
 * stars care about how big seasons are taxed and about majors, everyone likes a signing
 * bonus (the hungry most), and nobody likes paying for wins.
 */
export function extrasAppeal(wp: WorldPlayer, worldRank: number, x: DealExtras | undefined, headline: number): number {
  if (!x) return 0;
  const star = worldRank <= 30 ? 1 : worldRank <= 80 ? 0.6 : worldRank <= 150 ? 0.3 : 0.1;
  let score = 0;
  if (x.structure === "ladder") score -= 2 + 8 * star;
  if (x.structure === "star") score += 1 + 8 * star;
  if (x.majorCommission !== undefined) score += (headline - x.majorCommission) * 100 * 1.5 * (0.3 + star);
  if (x.winBonus) score -= (x.winBonus / 25_000) * (1 + 2 * star);
  if (x.signingBonus) score += (x.signingBonus / 50_000) * (worldRank > 100 ? 2.5 : worldRank > 30 ? 1.8 : 1.2);
  // A release clause is a way out: the lower it is, the freer he feels.
  if (x.releaseClause) score += x.releaseClause <= 500_000 ? 4 : x.releaseClause <= 1_500_000 ? 2.5 : 1;
  if (wp.player.attributes.ambition >= 15 && x.releaseClause) score += 1;
  return score;
}

/** Plain words for a set of extras, for the negotiation and the roster. */
export function describeExtras(x: DealExtras | undefined): string {
  if (!x) return "";
  const k = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1000)}k`);
  const parts: string[] = [];
  if (x.structure && x.structure !== "flat") parts.push(STRUCTURE_LABELS[x.structure].label.toLowerCase());
  if (x.majorCommission !== undefined) parts.push(`${Math.round(x.majorCommission * 100)}% on majors`);
  if (x.winBonus) parts.push(`${k(x.winBonus)} a win`);
  if (x.signingBonus) parts.push(`${k(x.signingBonus)} signing bonus`);
  if (x.releaseClause) parts.push(`${k(x.releaseClause)} release clause`);
  return parts.join(", ");
}

/** Drops empty extras so saves and comparisons stay tidy. */
export function cleanExtras(x: DealExtras | undefined): DealExtras | undefined {
  if (!x) return undefined;
  const out: DealExtras = {};
  if (x.structure && x.structure !== "flat") out.structure = x.structure;
  if (x.majorCommission !== undefined) out.majorCommission = x.majorCommission;
  if (x.winBonus) out.winBonus = x.winBonus;
  if (x.signingBonus) out.signingBonus = x.signingBonus;
  if (x.releaseClause) out.releaseClause = x.releaseClause;
  return Object.keys(out).length ? out : undefined;
}
