import { clamp, type Rng } from "./rng";
import type { Course, RoundWeather } from "./types";

/**
 * Weather for one round. Wind usually builds through the day, so the
 * afternoon wave tends to get the worse of it: "the bad side of the draw".
 */
export function drawWeather(course: Course, rng: Rng): RoundWeather {
  const am = clamp(rng.normal(course.windiness * 18, 4), 0, 35);
  const pm = clamp(am + rng.normal(2.5, 3), 0, 40);
  return { windMph: { AM: am, PM: pm }, rain: rng.chance(0.12) };
}
