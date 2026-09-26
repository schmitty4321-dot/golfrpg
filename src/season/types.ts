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

export interface WorldPlayer {
  player: Player;
  career: Career;
  /** How many starts this player aims for in a season (AI scheduling). */
  targetEvents: number;
  development: Development;
  injury: Injury | null;
  rebuild: SwingRebuild | null;
}

export interface Finances {
  prizeMoney: number;
  caddie: number;
  travel: number;
  /** Coaching staff wages, paid by the client. */
  coaching: number;
  /** Your agency's cut. */
  commission: number;
}

export interface SeasonSummary {
  season: number;
  pointsLeaders: { name: string; points: number; wins: number }[];
  majors: { event: string; winner: string; toPar: number }[];
  client: {
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
  };
}

export const SAVE_VERSION = 2;

export interface World {
  version: typeof SAVE_VERSION;
  seed: number;
  season: number;
  /** Next week to be played. */
  week: number;
  players: Record<string, WorldPlayer>;
  courses: Course[];
  schedule: TourEvent[];
  clientId: string;
  /** Agency commission on the client's prize money. */
  commissionRate: number;
  finances: Finances;
  agencyBank: number;
  pastSeasons: SeasonSummary[];
  /** Most recent headlines, newest first. */
  news: string[];
  /** Coaches available to hire. */
  coaches: Coach[];
  /** The client's staff: a coach id per role. */
  staff: Partial<Record<CoachRole, string>>;
  training: TrainingPlan;
}

export const absWeek = (season: number, week: number): number => season * 52 + week;
