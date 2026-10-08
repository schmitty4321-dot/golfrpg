import type { AttributeKey, Attributes, Course, Player, RoundPlan, RoundStats, StrokesGained } from "../engine";

/** "dev" events are the developmental tour, a level below the main tour. */
export type EventTier = "major" | "signature" | "standard" | "opposite" | "playoff" | "finale" | "dev";
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
  /** Season points for the winner, when not the tier's usual (THE PLAYERS pays like a major). */
  winnerPoints?: number;
  /** Played as match play (groups, then a knockout bracket) instead of 72 holes of stroke play. */
  format?: "matchplay";
  /** A developmental tour Finals event (1-4; 4 is the championship). */
  devFinals?: 1 | 2 | 3 | 4;
}

/**
 * Tour membership, best to worst:
 * - exempt: fully exempt (top 100 last season, or a recent winner)
 * - graduate: came up from the developmental tour
 * - conditional: finished 126-150, gets in when fields aren't full
 * - none: no main-tour status; plays the developmental tour and Monday qualifiers
 * - amateur: not yet a professional; plays college and amateur golf
 */
export type TourStatus = "exempt" | "graduate" | "conditional" | "none" | "amateur";

export const STATUS_LABELS: Record<TourStatus, string> = {
  exempt: "Fully exempt",
  graduate: "Developmental tour graduate",
  conditional: "Conditional status",
  none: "No status",
  amateur: "Amateur",
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
  /** Developmental tour points this season. */
  devPoints: number;
  /** Developmental tour wins this season (three earn a main-tour card on the spot). */
  seasonDevWins?: number;
  /** The season he was promoted mid-season from the developmental tour (he keeps the card through the next). */
  promotedSeason?: number;
  /** Full developmental tour status through this season (finished 21-60 on its points list). */
  devExemptThrough?: number;
  /** Career counters that survive the pruning of old results. */
  careerMajors: number;
  careerEvents: number;
  careerTop10s: number;
  careerCuts: number;
  /** Seasons finished top of the main tour's points list. */
  pointsTitles: number;
  /** Seasons in a row he has ended without a main-tour card (older saves: 0). */
  noCardSeasons?: number;
  /** This season's main-tour stats (missing in older saves until the next event). */
  stats?: SeasonStats;
  /** Last season's, kept through the next season for comparison. */
  lastStats?: SeasonStats;
  /** One line per finished season as a pro, for the career chart (older saves start empty). */
  seasonLog?: SeasonLine[];
  /** Course familiarity, 0-100, by course id (see engine/familiarity.ts). */
  familiarity?: Record<string, number>;
}

/** A finished season in brief: where he stood, how well he played. */
export interface SeasonLine {
  season: number;
  age: number;
  /** Overall level (golf skills) at the season's end, one decimal. */
  overall: number;
  /** Main-tour strokes gained per round, or null with no main-tour rounds. */
  sgPerRound: number | null;
  rounds: number;
  events: number;
  wins: number;
  top10s: number;
  majors: number;
  pointsRank: number | null;
}

/** A season of main-tour golf, added up event by event. */
export interface SeasonStats {
  season: number;
  events: number;
  rounds: number;
  strokes: number;
  cuts: number;
  wins: number;
  top10s: number;
  earnings: number;
  points: number;
  /** Strokes gained against the field, summed over rounds. */
  sg: StrokesGained;
  /** Shot-by-shot stats from the replays (the same numbers the round stats show). */
  shots: RoundStats;
}

export type TrainingFocus = "balanced" | "longGame" | "approach" | "shortGame" | "putting" | "mental" | "fitness";
export type Intensity = "light" | "normal" | "heavy";
/** What a client does with the off-season (older saves: standard). */
export type WinterProgram = "standard" | "camp" | "fitness" | "rest";
export interface TrainingPlan {
  focus: TrainingFocus;
  intensity: Intensity;
  winter?: WinterProgram;
}

export type CoachRole = "swing" | "shortGame" | "putting" | "mental" | "fitness";

export interface Coach {
  id: string;
  name: string;
  role: CoachRole;
  /** 1-20. */
  quality: number;
  weeklyFee: number;
  /** A former client of yours, coaching at a friend's rate (see legacy.ts). */
  formerClient?: boolean;
}

/** A development director: runs one client's coaching staff when you let him (see managers.ts). */
export interface Manager {
  id: string;
  name: string;
  /** 1-20: his eye for talent, and what he's paid. */
  quality: number;
  /** Skill ids from managerFx.ts (MANAGER_SKILLS), one to three. */
  skills: string[];
  weeklyFee: number;
}

export interface Injury {
  name: string;
  weeksLeft: number;
  /** How long it was expected to last when it happened. */
  totalWeeks?: number;
}

export interface SwingRebuild {
  weeksLeft: number;
  totalWeeks: number;
  /** What's being rebuilt (older saves: the swing). */
  area?: RebuildArea;
}

/** What a rebuild works on: the full swing, the short game, or the putting stroke. */
export type RebuildArea = "swing" | "shortGame" | "putting";

export interface Development {
  /** Hidden: the overall level (average golf attribute) the player can grow to. */
  potential: number;
  /** Fractional progress towards the next point up (+1) or down (-1), per attribute. */
  progress: Partial<Record<AttributeKey, number>>;
  /** Attributes at the start of the season, to show what changed. */
  seasonStart: Attributes;
}

export type SponsorCategory = "equipment" | "apparel" | "watch" | "financial" | "automotive" | "beverage";

/** What an apparel deal puts him in. */
export type ApparelItem = "hat" | "shirt" | "shoes";

export interface Sponsorship {
  id: string;
  sponsor: string;
  category: SponsorCategory;
  /** Apparel only: what the deal covers (older deals: the full kit). */
  items?: ApparelItem[];
  /** Why the sponsor came calling ("after his win at the Farmers"). */
  reason?: string;
  /** Paid in weekly instalments over the season. */
  annualValue: number;
  winBonus: number;
  majorBonus: number;
  /** Last season (inclusive) the deal runs. */
  untilSeason: number;
  /** Win and major bonuses this deal has paid so far. */
  earned?: number;
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
  /** Ladder or star structure, a majors rate, win bonuses, a release clause (see contractTerms.ts). */
  extras?: import("./contractTerms").DealExtras;
  /** Commission over his going rate he agreed to because he was keen on you: it doesn't rankle. */
  keenGrace?: number;
  /** A rookie deal from signing day: three full pro seasons, and the rate doesn't rankle while it runs. */
  rookie?: boolean;
}

/** Everything the agency manages for one client. */
export interface ClientManagement {
  contract: ClientContract;
  /** The season he first signed with you (older saves: the current contract's). */
  joinedSeason?: number;
  /** What he wants from his next deal (see extensions.ts), and how many of them you've found out. */
  wishes?: string[];
  wishesKnown?: number;
  /** The week you last talked his next deal over with him. */
  talkedWeek?: number;
  /** How hard the rivals have tapped him up in his final season (adds to his leverage). */
  tapped?: number;
  /** The week he last went public about his contract. */
  holdoutWeek?: number;
  /** You've agreed to let him go at the end of his deal: his place is free now, and he leaves on good terms. */
  farewell?: boolean;
  training: TrainingPlan;
  /** Coach id per role. */
  staff: Partial<Record<CoachRole, string>>;
  /** The development director in charge of his staff (id in World.managers), and whether he's let hire the coaches. */
  manager?: string;
  autoHire?: boolean;
  finances: Finances;
  /** 0-100: how he feels about the agency. Low at contract end and he walks. */
  happiness: number;
  sponsors: Sponsorship[];
  offers: SponsorOffer[];
  /** Grateful Underdogs: the last season his mood can't fall below 40. */
  gratefulUntil?: number;
  /** His caddie (id in World.caddies) and how many weeks they've worked together. */
  caddieId?: string;
  caddieWeeks?: number;
  /** This season's practice targets: two or three skills he works on above the rest (see progression.ts). */
  skillTargets?: import("./progression").SkillTargets;
  /** Career breakthroughs already had (see progression.ts). */
  breakthroughs?: string[];
  /** 0-100: built by training load and events, cleared by rest; past 60 he grows slower and gets hurt more. */
  fatigue?: number;
  /** The last few seasons' development, with milestones. */
  devReports?: import("./progression").DevelopmentReport[];
  /** How he plays the calls you don't make at events (older saves: "steady"). */
  roundPlan?: RoundPlan;
  /** How he flies between events (the agency jet, when you have one, beats all of these). */
  travelClass?: TravelClass;
  /** Equipment models he owns (tour standard is always free). */
  ownedEquipment?: string[];
  /** Share of his coaching and camps the agency pays (0, 0.5 or 1; older saves: 0). */
  devFunding?: 0 | 0.5 | 1;
  /** A development deal: the agency funds his coaching and camps in return for better terms. */
  devDeal?: DevDeal;
  /** His media following (older saves: worked out from his standing when first needed). */
  followers?: number;
  /** This season's goals, agreed with him (see goals.ts), and the ones on offer. */
  goals?: SeasonGoal[];
  goalOffers?: SeasonGoal[];
  goalsSeason?: number;
  /** -0.3 to +0.3: sponsor interest from the press and his choices, fading week by week. */
  buzz?: number;
  /** 0-100: how far he believes what you tell him (see promises.ts; 60 to start). */
  trust?: number;
  /** What you promised him to sign or stay. */
  promises?: import("./promises").ClientPromise[];
  /** Sits out every week up to and including this one (absolute week). */
  restUntil?: number;
  /** His best world ranking while he's been yours. */
  bestRank?: number;
  /** He made a bold claim this week (absolute): his next start tests it. */
  boldClaim?: number;
}

/** Who represents a player. */
export interface Representation {
  agency: string;
  untilSeason: number;
  /** The commission he signed for (older saves: standard). */
  commission?: number;
  /** His agency funds extra coaching (a rival's development deal). */
  deal?: boolean;
  /** The winter programme his agency chose for the coming off-season. */
  winter?: WinterProgram;
}

/** How a rival agency does business (see rivals.ts). */
export type RivalStyle = "starHunter" | "developer" | "volume" | "boutique";

/** A rival agency: reputation, style, and last winter's moves for the Rivals screen. */
export interface RivalAgency {
  name: string;
  style: RivalStyle;
  reputation: number;
  /** Reputation at the end of each season, oldest first. */
  repHistory: number[];
  /** Signings, deals and departures from the last market, newest first. */
  moves: string[];
  /** -100 (hostile) to 100 (friendly): how its head agent feels about you (older saves: 0). */
  relationship?: number;
  /** Players it has lost to you lately (each counts for less every season): a rival you keep raiding shrinks. */
  lostToYou?: number;
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
  /** An amateur's school: a college, or high school and his home state (see schools.ts). */
  school?: import("./schools").School;
  /** Came through the agency's junior academy (rivals leave him alone while he's an amateur). */
  academy?: boolean;
  /** A breakout or slump season, drawn each winter (strokes gained a round). */
  seasonForm?: { season: number; sg: number };
  /** Present only for your agency's clients. */
  client?: ClientManagement;
  /** Comeback Kids: weeks of faster development left after a long injury. */
  comebackWeeks?: number;
  /** Bronze-silver-gold progress for his traits and archetype, by trait id or "archetype" (see mastery.ts). */
  mastery?: Record<string, number>;
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
  /** Development costs the agency funded for its clients. */
  development?: number;
  /** Performance Center upkeep. */
  facility?: number;
  /** Interest on the credit line. */
  interest?: number;
  /** Agency staff wages. */
  staff?: number;
  /** Brand partnership fees received. */
  brands?: number;
  /** Brand partnership goal bonuses, paid at season end. */
  brandBonuses?: number;
  /** Agency events: takings less costs. */
  events?: number;
  /** Buyout fees from rivals who poached a client. */
  buyouts?: number;
  /** What inbox decisions cost: retention bonuses, psychologists, travel home. */
  clientCare?: number;
  /** Running each client: admin, travel support and the team around him. */
  support?: number;
  /** Signing bonuses paid to new clients. */
  signingBonuses?: number;
  /** Win bonuses clients paid under their contracts. */
  winBonuses?: number;
  /** Weekly retainers clients paid under their contracts. */
  retainers?: number;
  /** Winter returns less running costs of the agency's investments (see investments.ts). */
  investments?: number;
  /** Capital put into investments (less sales): an asset, not a cost. */
  invested?: number;
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
  /** The absolute week of the agency's last signing offer (one a week). */
  offerWeek?: number;
  /** Staff cards played in extension talks this season (see extensions.ts). */
  cards?: { season: number; used: Record<string, number> };
  /** The week a media day last earned reputation: one a week across the agency counts. */
  mediaWeek?: number;
  /** Recruiting: this week's hours, pipelines, coach relations, classes (see recruiting.ts). */
  recruiting?: import("./recruiting").RecruitingState;
  /** Prospects you've worked on: their interest in you. */
  prospects?: Record<string, import("./recruiting").Prospect>;
  /** The agency's private jet: leased by the week, or owned. */
  jet?: "lease" | "own" | null;
  /** The agency's Performance Center tier (0 = none). */
  center?: number;
  /** Headquarters tier (0 = the boutique office you start in). */
  hq?: number;
  /** Owed on the credit line. */
  loan?: number;
  /** Bank balance at the end of each week, for the finance chart. */
  bankHistory?: { season: number; week: number; bank: number }[];
  /** People the agency could hire, and who it has (one per role). */
  staffMarket?: AgencyStaffer[];
  staffHired?: Partial<Record<StaffRole, string>>;
  /** The owners' targets for the season and their patience (see board.ts). */
  board?: import("./board").BoardState;
  /** Foundations, an invitational, brand stakes, a course (see investments.ts). */
  investments?: import("./investments").Investment[];
  /** Each hire's contract, by role (older saves: written when first needed). */
  staffContracts?: Partial<Record<StaffRole, StaffContract>>;
  /** Players on the recruitment board, by id. */
  shortlist?: string[];
  /** Agency-wide brand partnerships, and the ones on offer this season. */
  brands?: BrandDeal[];
  /** Long sims stop when a big decision lands in the inbox (on unless switched off). */
  pauseOnDecisions?: boolean;
  /** Running counts the achievements use (promises kept, deals on a counter...). */
  counts?: Record<string, number>;
  /** Everyone who was ever your client (see legacy.ts). */
  legacy?: { alumni: import("./legacy").Alumnus[] };
  /** Prospects an alumnus sent you: player id to the last season the head start lasts. */
  referrals?: Record<string, number>;
  /** Scouts away on trips (see scoutTrips.ts). */
  trips?: import("./scoutTrips").ScoutTrip[];
  /** Players a rival's scout also found on one of your trips: player id to the rival. */
  contested?: Record<string, string>;
  brandOffers?: BrandDeal[];
  /** This season's counts for brand goals the stats don't keep. */
  brandTally?: import("./brandGoals").BrandTally;
  /** Each brand's last verdict: the share of its goals the agency met. */
  brandHistory?: Record<string, number>;
  /** Agency events held, by season. */
  eventsHeld?: Record<number, AgencyEventKind[]>;
  /** Your clients' wins and titles, and the agency's awards. */
  trophies?: Trophy[];
  /** Reputation at each season's end. */
  repHistory?: { season: number; reputation: number }[];
}

export type TravelClass = "economy" | "business" | "charter";

export interface Caddie {
  id: string;
  name: string;
  /** 1-20. */
  greenReading: number;
  clubbing: number;
  calm: number;
  weeklyFee: number;
  /** Share of prize money on top of the fee. */
  share: number;
}

/** A goal agreed with a client for the season. */
export interface SeasonGoal {
  id: string;
  kind: "card" | "top10s" | "win" | "playoffs" | "major-top10" | "points-top" | "cuts";
  /** The number to reach (top 10s, cuts, a points rank...). */
  target: number;
  label: string;
  /** How hard it looks, for the reward: 1 (modest) to 3 (stretch). */
  difficulty: 1 | 2 | 3;
  done?: boolean;
}

/** One client's money for the season. */
export interface Finances {
  /** What looking after him cost the agency this season (support). */
  agencySupport?: number;
  /** Development the agency paid for this season. */
  agencyFunded?: number;
  /** Signing bonus the agency paid him this season. */
  agencyBonus?: number;
  prizeMoney: number;
  endorsements: number;
  caddie: number;
  travel: number;
  /** Coaching staff wages, paid by the client. */
  coaching: number;
  /** Winter programs and other training he paid for. */
  training?: number;
  /** Clubs bought. */
  equipment?: number;
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
  /** The course setup before and after the winter's change (strokes a round). */
  courseSetup?: { from: number; to: number };
}

/** One entry in a record book. */
export interface RecordEntry {
  value: number;
  playerId: string;
  name: string;
  event: string;
  season: number;
}

export interface Records {
  /** Lowest single round (strokes), main tour. */
  lowestRound: RecordEntry | null;
  /** Lowest 72-hole score to par, main tour. */
  lowest72: RecordEntry | null;
  /** Largest winning margin in strokes. */
  biggestMargin: RecordEntry | null;
  /** Most main-tour wins in a season. */
  mostWinsSeason: RecordEntry | null;
  /** Youngest and oldest winners (age). */
  youngestWinner: RecordEntry | null;
  oldestWinner: RecordEntry | null;
}

export interface SeasonRecord {
  season: number;
  pointsChampion: { playerId: string; name: string; points: number; wins: number } | null;
  moneyLeader: { playerId: string; name: string; earnings: number } | null;
  devChampion: { playerId: string; name: string; points: number } | null;
  amateurChampion: { playerId: string; name: string } | null;
  winners: { eventId: string; event: string; tier: EventTier; playerId: string; name: string; toPar: number }[];
  qSchool: { playerId: string; name: string; toPar: number; position: number }[];
  /** Who earned a main-tour card for next season, and how. */
  graduates: { playerId: string; name: string; via: "dev" | "qschool" }[];
}

export interface HallOfFamer {
  playerId: string;
  name: string;
  nationality: string;
  wins: number;
  majors: number;
  pointsTitles: number;
  inducted: number;
}

export interface History {
  seasons: SeasonRecord[];
  records: Records;
  hallOfFame: HallOfFamer[];
}

export const SAVE_VERSION = 4;

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
  /** Development directors available to hire, one client each (older saves get them on load). */
  managers?: Manager[];
  /** Caddies available to hire (older saves get them on load). */
  caddies?: Caddie[];
  history: History;
  /** This generation's strength: added to each new amateur class (older saves: 0). */
  generation?: number;
  /** Realism setting chosen at the start of the career (older saves: realistic). */
  style?: WorldStyle;
  /** Strokes a round the tour's course setup adds this season (see courseSetup.ts). Missing in older saves: 0. */
  courseSetup?: number;
  /** This season's scoring on real courses against their real averages, for next winter's setup. */
  setupTally?: { strokes: number; rounds: number };
  /** Ryder Cup holder and past matches (older saves start with Europe holding it). */
  ryderCup?: import("./ryderCup").RyderCupState;
  /** The latest match-play event's draw, for the bracket screen. */
  lastBracket?: { season: number; week: number; eventId: string; name: string; venue: string; bracket: import("../engine").MatchPlayBracket; names: Record<string, string> };
  /** The challenge this career is playing, if any (see challenges.ts). */
  challenge?: import("./challenges").ChallengeState;
  /** Achievements unlocked, by id (see achievements.ts). */
  achievements?: Record<string, { season: number; week: number }>;
  /** The shots of the week, newest last (see highlights.ts). */
  highlights?: import("./highlights").Highlight[];
  /** Your clients' rivalries with other players (see rivalries.ts). */
  rivalries?: import("./rivalries").Rivalry[];
  /** Talks going on (or just finished) at the negotiation table (see negotiation.ts). */
  negotiation?: import("./negotiation").Negotiation;
  /** Signing talks, by player: they run over weeks, while he thinks your offers over. */
  talks?: Record<string, import("./negotiation").Negotiation>;
  /** Decisions waiting in the inbox, and the last few answered (see inbox.ts). */
  inbox?: import("./inbox").Decision[];
  /** The rival agencies (older saves get them on load). */
  rivals?: RivalAgency[];
  /** Set once anything has been changed in the editor, like an "edited" save in FM. */
  edited?: boolean;
}

export const absWeek = (season: number, week: number): number => season * 52 + week;

/** What the agency gave and got in a development deal. */
export interface DevDeal {
  share: 0.5 | 1;
  terms: "commission" | "years";
  since: number;
  /** What the agency has paid towards his development under the deal. */
  funded: number;
  /** Commission earned from him since the deal began. */
  commissionSince: number;
}

/** Agency staff: an agent closes deals, an analyst reads ceilings, marketing finds sponsors, a lawyer keeps contracts. */
export type StaffRole = "agent" | "analyst" | "marketing" | "lawyer";

/** A staffer's deal with the agency. */
export interface StaffContract {
  stafferId: string;
  signedSeason: number;
  /** Last season (inclusive) of the deal. */
  untilSeason: number;
  /** Fixed for the length of the deal. */
  weeklyFee: number;
  /** Full seasons with the agency: each one is a year of loyalty, and a point on their rating. */
  seasonsServed: number;
}

export interface AgencyStaffer {
  id: string;
  name: string;
  role: StaffRole;
  /** 1-20. */
  quality: number;
  weeklyFee: number;
}

/** An agency-wide deal with a brand: a yearly fee, and its sponsorship offers to your clients are worth more. */
export interface BrandDeal {
  id: string;
  brand: string;
  category: SponsorCategory;
  /** Paid to the agency each season, by the week. */
  annual: number;
  /** Extra value on this category's sponsorship offers to your clients. */
  lift: number;
  untilSeason: number;
  /** Goals for this season's bonuses (older deals: none, the whole fee is paid by the week). See brandGoals.ts. */
  goals?: import("./brandGoals").BrandGoal[];
  /** A renewal from a brand whose goals were met last time. */
  renewal?: boolean;
  /** An offer: the week it lapses, and why the brand came calling. */
  expiresAbsWeek?: number;
  reason?: string;
}

export type AgencyEventKind = "clinic" | "proAm" | "exhibition";

export interface Trophy {
  season: number;
  kind: "win" | "major" | "pointsTitle" | "award";
  title: string;
  player?: string;
}

/** Realistic: tuned to Data Golf. Lively: more scatter, more breakouts and slumps, bigger swings between generations. */
export type WorldStyle = "realistic" | "lively";
