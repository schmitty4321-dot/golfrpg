import type { AttributeKey, Attributes, Course, Player } from "../engine";

export type EventTier = "major" | "signature" | "standard" | "opposite" | "finale";
export type Region = "NA" | "EU" | "ASIA" | "AUS";

export const REGION_NAMES: Record<Region, string> = {
  NA: "North America",
  EU: "Europe",
  ASIA: "Asia",
  AUS: "Australia",
};

export interface TourEvent {
  id: string;
  name: string;
  /** Week of the season, 1-based. Two events can share a week (main + opposite field). */
  week: number;
  tier: EventTier;
  courseId: string;
  purse: number;
  fieldSize: number;
  /** Top N and ties after 36 holes; null = no cut. */
  cutTop: number | null;
  region: Region;
}

/**
 * Tour membership, best to worst:
 * - exempt: fully exempt (top 125 last season, or a recent winner)
 * - graduate: came up from the developmental tour
 * - conditional: finished 126-150, gets in when fields aren't full
 * - none: no status; can only Monday qualify
 */
export type TourStatus = "exempt" | "graduate" | "conditional" | "none";

export const STATUS_LABELS: Record<TourStatus, string> = {
  exempt: "Fully exempt",
  graduate: "Developmental tour graduate",
  conditional: "Conditional status",
  none: "No status",
};

export interface EventRecord {
  eventId: string;
  eventName: string;
  tier: EventTier;
  season: number;
  week: number;
  position: number;
  label: string;
  toPar: number;
  earnings: number;
  seasonPoints: number;
  owgrPoints: number;
  sgPerRound: number;
  madeCut: boolean;
  /** "monday" when the player got in through a Monday qualifier. */
  via: "field" | "monday";
}

export interface Career {
  status: TourStatus;
  /** Last season (inclusive) covered by a winner's exemption, if any. */
  exemptThrough: number | null;
  seasonPoints: number;
  seasonEarnings: number;
  seasonEvents: number;
  seasonWins: number;
  /** Rank on last season's points list, if the player was on it. */
  priorPointsRank: number | null;
  lastRegion: Region | null;
  /** World ranking points earned, by absolute week (season * 52 + week). */
  owgr: { absWeek: number; points: number }[];
  results: EventRecord[];
  careerEarnings: number;
  careerWins: number;
}

export type TrainingFocus = "balanced" | "longGame" | "approach" | "shortGame" | "putting" | "mental" | "fitness";
export type Intensity = "light" | "normal" | "heavy";
export interface TrainingPlan {
  focus: TrainingFocus;
  intensity: Intensity;
}

export type CoachRole = "swing" | "shortGame" | "putting" | "mental" | "fitness";

export interface Coach {
  id: string;
  name: string;
  role: CoachRole;
  /** 1-20. */
  quality: number;
  weeklyFee: number;
}

export interface Injury {
  name: string;
  weeksLeft: number;
}

export interface SwingRebuild {
  weeksLeft: number;
  totalWeeks: number;
}

export interface Development {
  /** Hidden: the overall level (average golf attribute) the player can grow to. */
  potential: number;
  /** Fractional progress towards the next point up (+1) or down (-1), per attribute. */
  progress: Partial<Record<AttributeKey, number>>;
  /** Attributes at the start of the season, to show what changed. */
  seasonStart: Attributes;
}

export type SponsorCategory = "equipment" | "apparel" | "watch" | "financial" | "automotive" | "beverage";

export interface Sponsorship {
  id: string;
  sponsor: string;
  category: SponsorCategory;
  /** Paid in weekly instalments over the season. */
  annualValue: number;
  winBonus: number;
  majorBonus: number;
  /** Last season (inclusive) the deal runs. */
  untilSeason: number;
}

export interface SponsorOffer extends Sponsorship {
  /** Absolute week after which the offer lapses. */
  expiresAbsWeek: number;
}

export interface ClientContract {
  /** Agency's share of prize money. */
  commission: number;
  /** Agency's share of endorsement income. */
  endorsementCommission: number;
  signedSeason: number;
  /** Last season (inclusive) of the deal; he leaves after it unless extended. */
  untilSeason: number;
}

/** Everything the agency manages for one client. */
export interface ClientManagement {
  contract: ClientContract;
  training: TrainingPlan;
  /** Coach id per role. */
  staff: Partial<Record<CoachRole, string>>;
  finances: Finances;
  /** 0-100: how he feels about the agency. Low at contract end and he walks. */
  happiness: number;
  sponsors: Sponsorship[];
  offers: SponsorOffer[];
}

/** Who represents a player. */
export interface Representation {
  agency: string;
  untilSeason: number;
}

export interface WorldPlayer {
  player: Player;
  career: Career;
  /** How many starts this player aims for in a season (AI scheduling). */
  targetEvents: number;
  development: Development;
  injury: Injury | null;
  rebuild: SwingRebuild | null;
  /** A rival agency, or null for a free agent. Your clients use `client` instead. */
  agent: Representation | null;
  /** Present only for your agency's clients. */
  client?: ClientManagement;
}

export interface Scout {
  id: string;
  name: string;
  /** 1-20: how accurate his reports are. */
  quality: number;
  weeklyFee: number;
}

/** What your agency knows about a player. */
export interface Knowledge {
  /** 0-1. Clients are known exactly (1). */
  accuracy: number;
  reports: number;
  absWeek: number;
}

/** The agency's own money for the season. */
export interface AgencyLedger {
  prizeCommission: number;
  endorsementCommission: number;
  office: number;
  scouts: number;
}

export interface Agency {
  name: string;
  bank: number;
  /** 0-100: decides who will sign with you and how big the sponsors are. */
  reputation: number;
  scouts: Scout[];
  /** Ids of the scouts on the payroll. */
  hiredScouts: string[];
  /** Players waiting to be scouted, in order. */
  scoutingQueue: string[];
  knowledge: Record<string, Knowledge>;
  ledger: AgencyLedger;
  /** Player id → absolute week before which he won't hear another offer. */
  cooldowns: Record<string, number>;
}

/** One client's money for the season. */
export interface Finances {
  prizeMoney: number;
  endorsements: number;
  caddie: number;
  travel: number;
  /** Coaching staff wages, paid by the client. */
  coaching: number;
  /** Your agency's cut of prize money and endorsements. */
  commission: number;
}

export interface ClientSeasonSummary {
    id: string;
    name: string;
    statusBefore: TourStatus;
    statusAfter: TourStatus;
    pointsRank: number | null;
    points: number;
    events: number;
    wins: number;
    top10s: number;
    cutsMade: number;
    earnings: number;
    owgrRank: number;
    finances: Finances;
}

export interface SeasonSummary {
  season: number;
  pointsLeaders: { name: string; points: number; wins: number }[];
  majors: { event: string; winner: string; toPar: number }[];
  clients: ClientSeasonSummary[];
  agency: { reputationBefore: number; reputationAfter: number; ledger: AgencyLedger; departures: string[] };
}

export const SAVE_VERSION = 3;

export interface World {
  version: typeof SAVE_VERSION;
  seed: number;
  season: number;
  /** Next week to be played. */
  week: number;
  players: Record<string, WorldPlayer>;
  courses: Course[];
  schedule: TourEvent[];
  /** Your agency's clients, in the order they signed. */
  clientIds: string[];
  agency: Agency;
  pastSeasons: SeasonSummary[];
  /** Most recent headlines, newest first. */
  news: string[];
  /** Coaches available to hire (a coach can work with several players). */
  coaches: Coach[];
}

export const absWeek = (season: number, week: number): number => season * 52 + week;
