import { clamp, type Rng } from "./rng";
import type { Course, CourseStyle, Grass, Hole } from "./types";

interface StyleProfile {
  yardsShift: number;
  fairwayWidth: number;
  hazard: number;
  bunkers: [number, number];
  exposure: number;
  greenSpeed: number;
  roughPenalty: number;
  windiness: number;
  firmness: number;
  grass: Grass[];
}

/** Typical set-up by style, matching the hand-built venues in courses.ts. */
const PROFILES: Record<CourseStyle, StyleProfile> = {
  parkland: { yardsShift: 0, fairwayWidth: 28, hazard: 0.15, bunkers: [2, 3], exposure: 0.35, greenSpeed: 12.5, roughPenalty: 0.65, windiness: 0.3, firmness: 0.55, grass: ["bentgrass", "poa", "bermuda"] },
  links: { yardsShift: -5, fairwayWidth: 31, hazard: 0.12, bunkers: [3, 4], exposure: 0.92, greenSpeed: 10.5, roughPenalty: 0.45, windiness: 0.7, firmness: 0.82, grass: ["bentgrass"] },
  desert: { yardsShift: 12, fairwayWidth: 35, hazard: 0.38, bunkers: [2, 3], exposure: 0.5, greenSpeed: 12, roughPenalty: 0.3, windiness: 0.35, firmness: 0.6, grass: ["bermuda"] },
  resort: { yardsShift: -12, fairwayWidth: 31, hazard: 0.3, bunkers: [2, 2], exposure: 0.7, greenSpeed: 11.5, roughPenalty: 0.45, windiness: 0.5, firmness: 0.5, grass: ["poa", "bermuda"] },
};

/** Par-3/par-5 counts for par 72, 71 and 70 layouts. */
const LAYOUTS: Record<70 | 71 | 72, { par3: number; par5: number }> = {
  72: { par3: 4, par5: 4 },
  71: { par3: 4, par5: 3 },
  70: { par3: 4, par5: 2 },
};

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A plausible 18-hole tour venue of the given style. */
export function generateCourse(rng: Rng, id: string, name: string, style: CourseStyle): Course {
  const p = PROFILES[style];
  const par = rng.pick([72, 72, 71, 70] as const);
  const { par3, par5 } = LAYOUTS[par];
  const pars = shuffle<3 | 4 | 5>(
    [...Array<3>(par3).fill(3), ...Array<5>(par5).fill(5), ...Array<4>(18 - par3 - par5).fill(4)],
    rng,
  );
  // The 1st hole is never a par 3 on a tour venue.
  if (pars[0] === 3) {
    const k = pars.findIndex((x) => x !== 3);
    [pars[0], pars[k]] = [pars[k]!, pars[0]!];
  }

  const holes: Hole[] = pars.map((holePar, i) => {
    const yards =
      holePar === 3
        ? clamp(rng.normal(190, 25), 125, 250)
        : holePar === 4
          ? clamp(rng.normal(440, 35), 330, 515)
          : clamp(rng.normal(575, 30), 520, 635);
    return {
      number: i + 1,
      par: holePar,
      yards: Math.round((yards + p.yardsShift) / 5) * 5,
      fairwayWidth: holePar === 3 ? 0 : Math.round(clamp(rng.normal(p.fairwayWidth, 2.5), 22, 40)),
      hazard: Math.round(clamp(rng.normal(p.hazard, 0.12), 0, 0.7) * 10) / 10,
      bunkers: rng.int(p.bunkers[0] - 1, p.bunkers[1] + 1),
      exposure: Math.round(clamp(rng.normal(p.exposure, 0.1), 0.2, 1) * 10) / 10,
    };
  });

  return {
    id,
    name,
    style,
    grass: rng.pick(p.grass),
    holes,
    greenSpeed: Math.round(clamp(rng.normal(p.greenSpeed, 0.5), 9.5, 14) * 2) / 2,
    roughPenalty: Math.round(clamp(rng.normal(p.roughPenalty, 0.08), 0.1, 0.9) * 100) / 100,
    windiness: Math.round(clamp(rng.normal(p.windiness, 0.08), 0.1, 0.9) * 100) / 100,
    firmness: Math.round(clamp(rng.normal(p.firmness, 0.06), 0.3, 0.95) * 100) / 100,
  };
}
