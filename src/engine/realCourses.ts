import { createRng } from "./rng";
import { generateCourse } from "./courseGen";
import data from "./realCourses.json";
import photos from "./realCoursePhotos.json";
import type { Course, CoursePhoto, CourseStyle, Grass, Hole } from "./types";

/** [par, yards, fairwayWidth, hazard, bunkers, exposure, tourAverage, adjust] */
type RawHole = [number, number, number, number, number, number, number | null, number];

interface RawCourse {
  id: string;
  name: string;
  city: string;
  country: string;
  region: string;
  style: string;
  grass: string;
  greenSpeed: number;
  roughPenalty: number;
  windiness: number;
  firmness: number;
  designer?: string;
  established?: string | null;
  source?: string;
  holes: RawHole[] | null;
}

function sourceLabel(id: string | undefined): string | undefined {
  // Event ids look like R2026006: tour, season, tournament.
  return id ? `PGA TOUR course stats, ${id.slice(1, 5)}` : undefined;
}

function build(raw: RawCourse): Course {
  const photo = (photos as Record<string, CoursePhoto>)[raw.id];
  const info = {
    city: raw.city,
    country: raw.country,
    ...(raw.designer ? { designer: raw.designer } : {}),
    ...(raw.established ? { established: raw.established } : {}),
    ...(raw.source ? { source: sourceLabel(raw.source) } : {}),
    ...(photo ? { photo } : {}),
  };
  const base = {
    id: raw.id,
    name: raw.name,
    style: raw.style as CourseStyle,
    grass: raw.grass as Grass,
    greenSpeed: raw.greenSpeed,
    roughPenalty: raw.roughPenalty,
    windiness: raw.windiness,
    firmness: raw.firmness,
  };
  if (!raw.holes) {
    // No hole-by-hole data yet (a new venue): a stand-in layout of the right style.
    const stand = generateCourse(createRng(raw.id.length * 7919), raw.id, raw.name, base.style);
    return { ...stand, ...base, info: { ...info, estimated: true } };
  }
  const holes: Hole[] = raw.holes.map(([par, yards, fairwayWidth, hazard, bunkers, exposure, tourAverage, adjust], i) => ({
    number: i + 1,
    par: par as 3 | 4 | 5,
    yards,
    fairwayWidth,
    hazard,
    bunkers,
    exposure,
    ...(adjust ? { adjust } : {}),
    ...(tourAverage !== null ? { tourAverage } : {}),
  }));
  return { ...base, holes, info };
}

/**
 * The real tour's venues: every hole's par and yardage from the PGA TOUR's
 * course stats, each hole tuned to play to its real scoring average (see
 * scripts/fitRealCourses.ts). Fairway widths, bunkers and wind exposure are
 * estimates from the style of course.
 */
export const REAL_COURSES: Course[] = (data as RawCourse[]).map(build);

/** Region of each real venue, for travel. */
export const REAL_COURSE_REGION: Record<string, string> = Object.fromEntries((data as RawCourse[]).map((c) => [c.id, c.region]));

export const isRealCourse = (course: Course): boolean => !!course.info;
