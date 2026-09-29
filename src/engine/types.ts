import type { ArchetypeId } from "./archetypes";
import type { Attributes } from "./attributes";

export type Grass = "bentgrass" | "bermuda" | "poa";
export type CourseStyle = "links" | "parkland" | "desert" | "resort";

export interface Player {
  id: string;
  name: string;
  nationality: string;
  age: number;
  attributes: Attributes;
  /** Hidden: the grass the player grew up putting on. */
  grassPreference: Grass;
  /** Hidden: 1-20 comfort per course style (12 = neutral). */
  styleComfort: Record<CourseStyle, number>;
  /** Hidden: the age the player peaks at (for the development model). */
  peakAge: number;
  /** Current form / confidence, -1 (slump) to +1 (on fire). */
  form: number;
  /** Physical and mental freshness, 0-100. Travel and events drain it. */
  condition: number;
  /**
   * Temporary strokes-gained adjustments per round, e.g. while a swing
   * rebuild is bedding in. Absent for most players.
   */
  sgAdjust?: Partial<StrokesGained>;
  /** Trait ids (see traits.ts). Rolled once, then kept; absent until assigned. */
  traits?: string[];
  /** The shape of his game (see archetypes.ts). Absent in older saves until filled in on load. */
  archetype?: ArchetypeId;
  /** Model ids in his bag by slot (see equipment.ts); tour standard where absent. */
  equipment?: Partial<Record<"driver" | "irons" | "wedges" | "putter", string>>;
}

export interface Hole {
  number: number;
  par: 3 | 4 | 5;
  yards: number;
  /** Width of the landing area in yards (tour average ~30). Ignored on par 3s. */
  fairwayWidth: number;
  /** 0-1: water, OB and other trouble that produces big numbers. */
  hazard: number;
  /** Greenside bunkers, 0-4. */
  bunkers: number;
  /** 0-1: how exposed the hole is to wind. */
  exposure: number;
  /** Strokes added to the hole's modelled average so it plays like the real hole (real courses only). */
  adjust?: number;
  /** The real tour field's scoring average on this hole, when known. */
  tourAverage?: number;
}

/** A course's photo, from Wikimedia Commons, with the credit its licence asks for. */
export interface CoursePhoto {
  /** Path of the image under the site's public folder. */
  file: string;
  artist: string;
  license: string;
  licenseUrl: string;
  /** The image's page on Wikimedia Commons. */
  page: string;
}

/** Facts about a real venue. */
export interface CourseInfo {
  city: string;
  country: string;
  designer?: string;
  established?: string;
  /** Where the hole data came from, e.g. "PGA TOUR course stats, 2026". */
  source?: string;
  /** True when no hole-by-hole data was found and the layout is a stand-in. */
  estimated?: boolean;
  photo?: CoursePhoto;
}

export interface Course {
  id: string;
  name: string;
  style: CourseStyle;
  grass: Grass;
  holes: Hole[];
  /** Stimpmeter, tour average ~12. */
  greenSpeed: number;
  /** 0-1: how penal the rough is. */
  roughPenalty: number;
  /**
   * Strokes a round the tour's setup adds to this course (longer tees, thicker
   * rough, tucked pins), spread evenly over the holes. Set each season so real
   * courses keep playing to their real averages as the players improve.
   */
  setup?: number;
  /** 0-1: typical wind at this venue. */
  windiness: number;
  /** 0-1: green firmness in dry weather. */
  firmness: number;
  /** Real venues only. */
  info?: CourseInfo;
}

export type Wave = "AM" | "PM";

export interface RoundWeather {
  /** Sustained wind in mph for each wave. */
  windMph: Record<Wave, number>;
  /** Rain softens greens and makes the course play easier to hit into. */
  rain: boolean;
}

/** Strokes gained broken into the four standard categories. */
export interface StrokesGained {
  offTheTee: number;
  approach: number;
  aroundTheGreen: number;
  putting: number;
}

export const SG_CATEGORIES = ["offTheTee", "approach", "aroundTheGreen", "putting"] as const;
export type SgCategory = (typeof SG_CATEGORIES)[number];
