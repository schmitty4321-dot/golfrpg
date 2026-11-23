/**
 * The agency perk tree: twenty small, permanent upgrades in four branches
 * (scouting, development, commercial, operations), five tiers each. A perk
 * costs one perk point; the agency earns one for every season it completes
 * and one for each of a few landmark achievements (see PERK_ACHIEVEMENTS).
 * Each tier needs a perk from the tier above in the same branch, so with
 * about twenty points in fifteen seasons the order you buy them in matters.
 * Perks are kept for good: there is no respec.
 *
 * Every perk nudges one thing a system already does, by 5-15% or one extra
 * unit of a small count; none repeats a staff skill, an investment or the
 * Performance Center. The numbers live in PERK_FX; each system checks
 * hasPerk() where it acts.
 *
 * This file only imports types, so any system can use it without a cycle.
 */
import type { World } from "./types";

export type PerkBranch = "scouting" | "development" | "commercial" | "operations";

export const PERK_BRANCHES: { id: PerkBranch; label: string; blurb: string }[] = [
  { id: "scouting", label: "Scouting", blurb: "Trips, first reads and intel." },
  { id: "development", label: "Development", blurb: "How fast your clients grow." },
  { id: "commercial", label: "Commercial", blurb: "Sponsors and exemptions." },
  { id: "operations", label: "Operations", blurb: "Running costs, travel and the roster." },
];

export interface PerkDef {
  id: string;
  branch: PerkBranch;
  /** 1-5: each needs a perk from the tier above in its branch. */
  tier: number;
  name: string;
  /** What it does, in one line. */
  effect: string;
}

/** The size of every perk's effect, in one place. */
export const PERK_FX = {
  /** Scout trips: share of the weekly travel bill paid. */
  tripCost: 0.85,
  /** A trip's first look at a new player (normally 0.3). */
  firstLook: 0.4,
  /** New players a scout sees each week of a trip (normally 2). */
  tripFinds: 3,
  /** Hidden gems on amateur trips: chance multiplier. */
  gemChance: 1.15,
  /** Added to a client's weekly development budget in the season. */
  devBudget: 0.05,
  /** Caddie chemistry gained per week together (normally 3). */
  chemistryRate: 3.45,
  /** Added to the budget of a week he plays an event (competing is 0.6). */
  competing: 0.06,
  /** Share of a rebuild's early penalty he still feels. */
  rebuildPenalty: 0.85,
  /** Added to a client's development budget each winter week. */
  winterBudget: 0.08,
  /** New sponsor offers' win and major bonuses. */
  sponsorBonus: 1.1,
  /** Added to a sponsor exemption's chance. */
  exemptionOdds: 0.05,
  /** Clients' commercial flights: share of the fare paid. */
  travelCost: 0.9,
  /** Per-client support costs: share paid. */
  supportCost: 0.85,
  /** The agency jet's lease or upkeep: share paid. */
  jetCost: 0.85,
  /** Added to the chance a between-rounds gamble lands. */
  callGamble: 0.05,
} as const;

export const PERKS: PerkDef[] = [
  { id: "scout-expenses", branch: "scouting", tier: 1, name: "Expense account", effect: "Scouting trips cost 15% less a week." },
  { id: "scout-first-look", branch: "scouting", tier: 2, name: "Quick study", effect: "A trip's first look at a player is sharper (40% clear, not 30%)." },
  { id: "scout-contacts", branch: "scouting", tier: 3, name: "Regional contacts", effect: "Intel on players elsewhere in the US takes one week, not two." },
  { id: "scout-wider-net", branch: "scouting", tier: 4, name: "Wider net", effect: "Scouts on a trip see three new players a week, not two." },
  { id: "scout-gems", branch: "scouting", tier: 5, name: "Gem hunter", effect: "Hidden gems turn up 15% more often on amateur trips." },

  { id: "dev-fund", branch: "development", tier: 1, name: "Development fund", effect: "Every client's weekly development budget is 5% bigger in the season." },
  { id: "dev-caddie", branch: "development", tier: 2, name: "Caddie bond", effect: "Chemistry with a caddie builds 15% faster." },
  { id: "dev-reps", branch: "development", tier: 3, name: "Tournament reps", effect: "A week he plays an event does 10% more for his development." },
  { id: "dev-rebuild", branch: "development", tier: 4, name: "Gentle rebuilds", effect: "A rebuild costs him 15% less while it settles in." },
  { id: "dev-winter", branch: "development", tier: 5, name: "Winter program", effect: "Clients grow a little more over the winter (+8% budget)." },

  { id: "com-long-deals", branch: "commercial", tier: 1, name: "Long-term partners", effect: "New sponsor offers run at least to the end of next season." },
  { id: "com-bonuses", branch: "commercial", tier: 2, name: "Bonus clauses", effect: "Win and major bonuses in new sponsor offers are 10% bigger." },
  { id: "com-exemption-odds", branch: "commercial", tier: 3, name: "Tournament friends", effect: "Sponsor exemption asks are 5 points likelier to be granted." },
  { id: "com-extra-ask", branch: "commercial", tier: 4, name: "Extra ask", effect: "One more sponsor exemption ask each season." },
  { id: "com-extra-slot", branch: "commercial", tier: 5, name: "Room on the sleeve", effect: "Every client can carry one more endorsement." },

  { id: "ops-travel", branch: "operations", tier: 1, name: "Travel desk", effect: "Clients' flights cost 10% less (not the agency jet)." },
  { id: "ops-support", branch: "operations", tier: 2, name: "Lean support", effect: "Looking after each client costs the agency 15% less a week." },
  { id: "ops-jet", branch: "operations", tier: 3, name: "Jet deal", effect: "The agency jet's lease or upkeep is 15% cheaper." },
  { id: "ops-calls", branch: "operations", tier: 4, name: "Man-manager", effect: "Gambles in between-round calls land 5 points more often." },
  { id: "ops-roster", branch: "operations", tier: 5, name: "Bigger front office", effect: "Room for one more client on the roster." },
];

export const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p]));

/** Achievements that earn a perk point as well as reputation. */
export const PERK_ACHIEVEMENTS = ["first-major", "three-majors", "points-title", "world-no1", "hall-of-famer", "grand-slam", "top-agency", "top50-five"] as const;
const PERK_ACHIEVEMENT_SET = new Set<string>(PERK_ACHIEVEMENTS);
export const earnsPerkPoint = (achievementId: string): boolean => PERK_ACHIEVEMENT_SET.has(achievementId);

type HasAgency = Pick<World, "agency">;

export const perksOf = (world: HasAgency): string[] => world.agency.perks ?? [];
export const hasPerk = (world: HasAgency, id: string): boolean => (world.agency.perks ?? []).includes(id);
export const perkPoints = (world: HasAgency): number => world.agency.perkPoints ?? 0;

/** Every point the agency has earned so far: one a completed season, one per landmark achievement. */
export function perkPointsEarned(world: World): number {
  const seasons = Math.max(0, world.season - 1);
  const got = world.achievements ?? {};
  return seasons + PERK_ACHIEVEMENTS.filter((id) => got[id]).length;
}

/** Saves from before the perk tree: the points their seasons and achievements have earned. */
export function ensurePerks(world: World): void {
  world.agency.perks ??= [];
  if (world.agency.perkPoints === undefined) world.agency.perkPoints = Math.max(0, perkPointsEarned(world) - world.agency.perks.length);
}

/** A point earned: added and announced. */
export function awardPerkPoint(world: World, why: string): void {
  world.agency.perks ??= [];
  world.agency.perkPoints = perkPoints(world) + 1;
  world.news.unshift(`${why}: a perk point to spend (Agency › Perks). ${world.agency.perkPoints} to spend.`);
}

/** What a perk's tier needs: the perks in the tier above in its branch (none for tier 1). */
export const perkNeeds = (p: PerkDef): PerkDef[] => PERKS.filter((q) => q.branch === p.branch && q.tier === p.tier - 1);

export type PerkState = "owned" | "available" | "locked";

/** Owned, available to buy now, or locked (by the tier above or a lack of points). */
export function perkState(world: HasAgency, id: string): PerkState {
  if (hasPerk(world, id)) return "owned";
  return perkBlock(world, id) ? "locked" : "available";
}

/** Why a perk can't be bought now, or null when it can. */
export function perkBlock(world: HasAgency, id: string): string | null {
  const p = PERK_BY_ID.get(id);
  if (!p) return "No such perk.";
  if (hasPerk(world, id)) return "Already yours.";
  const needs = perkNeeds(p);
  if (needs.length && !needs.some((q) => hasPerk(world, q.id))) return `Needs ${needs.map((q) => q.name).join(" or ")} first.`;
  if (perkPoints(world) < 1) return "No perk points to spend.";
  return null;
}

/** Spends a point on a perk (kept for good). */
export function buyPerk(world: World, id: string): void {
  const block = perkBlock(world, id);
  if (block) throw new Error(block);
  const p = PERK_BY_ID.get(id)!;
  (world.agency.perks ??= []).push(id);
  world.agency.perkPoints = perkPoints(world) - 1;
  world.news.unshift(`${world.agency.name} adds a perk: ${p.name}. ${p.effect}`);
}
