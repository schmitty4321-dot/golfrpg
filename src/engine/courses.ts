import { REAL_COURSES } from "./realCourses";
import type { Course, CourseStyle, Grass, Hole } from "./types";

/** [par, yards, fairwayWidth, hazard, bunkers, exposure] */
type HoleSpec = [3 | 4 | 5, number, number, number, number, number];

function buildCourse(
  meta: Omit<Course, "holes">,
  specs: HoleSpec[],
): Course {
  if (specs.length !== 18) throw new Error(`${meta.name}: expected 18 holes, got ${specs.length}`);
  const holes: Hole[] = specs.map(([par, yards, fairwayWidth, hazard, bunkers, exposure], i) => ({
    number: i + 1,
    par,
    yards,
    fairwayWidth,
    hazard,
    bunkers,
    exposure,
  }));
  return { ...meta, holes };
}

const course = (
  id: string,
  name: string,
  style: CourseStyle,
  grass: Grass,
  greenSpeed: number,
  roughPenalty: number,
  windiness: number,
  firmness: number,
  specs: HoleSpec[],
) => buildCourse({ id, name, style, grass, greenSpeed, roughPenalty, windiness, firmness }, specs);

/** Fictional venues. Real courses can be added later through the editor. */
export const COURSES: Course[] = [
  course("harrow-pines", "Harrow Pines", "parkland", "bentgrass", 13, 0.8, 0.3, 0.55, [
    [4, 445, 28, 0.1, 2, 0.3], [5, 575, 32, 0.2, 3, 0.3], [4, 410, 26, 0.1, 2, 0.4],
    [3, 195, 0, 0.3, 3, 0.4], [4, 470, 27, 0.1, 2, 0.3], [4, 380, 25, 0.2, 3, 0.3],
    [3, 165, 0, 0.1, 2, 0.4], [5, 600, 30, 0.1, 2, 0.4], [4, 455, 28, 0.1, 2, 0.3],
    [4, 430, 29, 0.1, 2, 0.3], [4, 480, 27, 0.2, 2, 0.4], [3, 215, 0, 0.3, 2, 0.5],
    [5, 560, 31, 0.3, 3, 0.4], [4, 400, 26, 0.1, 3, 0.3], [4, 465, 27, 0.1, 2, 0.3],
    [3, 180, 0, 0.4, 2, 0.4], [5, 590, 30, 0.2, 2, 0.3], [4, 470, 26, 0.3, 3, 0.4],
  ]),
  course("kilbrannan-links", "Kilbrannan Links", "links", "bentgrass", 10.5, 0.45, 0.75, 0.85, [
    [4, 420, 34, 0.1, 3, 0.9], [4, 450, 32, 0.1, 4, 0.9], [3, 175, 0, 0.1, 4, 1.0],
    [4, 480, 30, 0.2, 3, 0.9], [5, 565, 33, 0.1, 4, 1.0], [4, 395, 31, 0.1, 3, 0.9],
    [3, 210, 0, 0.1, 3, 1.0], [4, 440, 30, 0.2, 3, 0.9], [4, 410, 32, 0.1, 3, 0.9],
    [4, 460, 31, 0.1, 3, 0.9], [3, 185, 0, 0.2, 4, 1.0], [4, 430, 30, 0.2, 3, 0.9],
    [5, 540, 33, 0.1, 3, 1.0], [4, 470, 29, 0.2, 4, 1.0], [4, 415, 31, 0.1, 3, 0.9],
    [3, 230, 0, 0.1, 3, 1.0], [4, 490, 29, 0.3, 4, 1.0], [4, 450, 30, 0.2, 3, 0.9],
  ]),
  course("saguaro-wells", "Saguaro Wells", "desert", "bermuda", 12, 0.3, 0.35, 0.6, [
    [4, 460, 36, 0.3, 2, 0.5], [5, 610, 38, 0.3, 2, 0.5], [4, 490, 35, 0.4, 2, 0.5],
    [3, 220, 0, 0.4, 2, 0.6], [4, 440, 34, 0.3, 2, 0.5], [4, 380, 33, 0.5, 2, 0.5],
    [3, 190, 0, 0.3, 2, 0.6], [4, 505, 34, 0.3, 2, 0.5], [4, 465, 35, 0.3, 2, 0.5],
    [4, 425, 34, 0.3, 2, 0.5], [5, 590, 37, 0.4, 2, 0.6], [4, 480, 33, 0.3, 2, 0.5],
    [3, 240, 0, 0.5, 2, 0.6], [4, 455, 34, 0.3, 2, 0.5], [5, 575, 36, 0.5, 3, 0.5],
    [3, 165, 0, 0.5, 3, 0.6], [4, 350, 32, 0.6, 2, 0.5], [4, 485, 34, 0.4, 2, 0.5],
  ]),
  course("marisol-bay", "Marisol Bay", "resort", "poa", 11.5, 0.45, 0.5, 0.5, [
    [4, 390, 32, 0.2, 2, 0.6], [5, 530, 34, 0.2, 2, 0.6], [4, 400, 31, 0.2, 2, 0.6],
    [3, 160, 0, 0.3, 2, 0.8], [4, 430, 31, 0.2, 2, 0.6], [5, 545, 33, 0.3, 2, 0.6],
    [3, 125, 0, 0.5, 2, 0.9], [4, 420, 30, 0.4, 2, 0.8], [4, 470, 29, 0.4, 2, 0.8],
    [4, 440, 30, 0.4, 2, 0.8], [4, 385, 32, 0.2, 2, 0.6], [3, 200, 0, 0.2, 2, 0.6],
    [4, 400, 31, 0.2, 2, 0.6], [5, 575, 33, 0.3, 2, 0.6], [4, 395, 31, 0.2, 2, 0.6],
    [3, 180, 0, 0.3, 2, 0.6], [4, 455, 30, 0.2, 2, 0.6], [5, 545, 32, 0.4, 3, 0.8],
  ]),
];

export const coursePar = (c: Course): number => c.holes.reduce((s, h) => s + h.par, 0);
export const courseYards = (c: Course): number => c.holes.reduce((s, h) => s + h.yards, 0);

export function getCourse(id: string): Course {
  const c = COURSES.find((x) => x.id === id) ?? REAL_COURSES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown course ${id}`);
  return c;
}
