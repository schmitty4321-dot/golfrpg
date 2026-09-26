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
  /** 0-1: typical wind at this venue. */
  windiness: number;
  /** 0-1: green firmness in dry weather. */
  firmness: number;
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
