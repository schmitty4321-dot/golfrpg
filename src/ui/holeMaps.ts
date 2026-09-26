import { useEffect, useState } from "react";

/** One hole's real outlines, in the tracer's yards frame (tee at 0,0, green up the y axis). */
export interface HoleMap {
  fairway: number[][][];
  green: number[][][];
  tee: number[][][];
  bunker: number[][][];
  water: number[][][];
  rough: number[][][];
  wood: number[][][];
  path: number[][][];
  tree: number[][];
  /** Where the hole sits on the course map: origin (course yards), rotation, scale. */
  frame: [number, number, number, number];
}
/** A public-domain aerial photo of the course, and the box it covers in course yards. */
export interface Aerial {
  file: string;
  box: [number, number, number, number];
  credit: string;
}
interface CourseMap {
  attribution: string;
  holes: Record<string, HoleMap>;
  aerial?: Aerial;
}

// Each course's outlines are a separate file, loaded the first time one of its holes is replayed.
const cache = new Map<string, Promise<CourseMap | null>>();

function loadCourse(courseId: string): Promise<CourseMap | null> {
  let p = cache.get(courseId);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}holes/${courseId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<CourseMap>) : null))
      .catch(() => null);
    cache.set(courseId, p);
  }
  return p;
}

/** The real outlines of a hole (and the course's aerial photo), or null while loading or when the hole has none. */
export function useHoleMap(real: { courseId: string; hole: number } | undefined): (HoleMap & { aerial?: Aerial }) | null {
  const [map, setMap] = useState<{ key: string; hole: (HoleMap & { aerial?: Aerial }) | null } | null>(null);
  const key = real ? `${real.courseId}/${real.hole}` : "";
  useEffect(() => {
    if (!real) return;
    let live = true;
    void loadCourse(real.courseId).then((c) => {
      const hole = c?.holes[String(real.hole)];
      if (live) setMap({ key: `${real.courseId}/${real.hole}`, hole: hole ? { ...hole, ...(c?.aerial ? { aerial: c.aerial } : {}) } : null });
    });
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return map && map.key === key ? map.hole : null;
}

/**
 * Lays the course's aerial photo under a hole. The photo is north-up in course
 * yards; the hole is drawn tee-at-the-bottom, so the photo is moved, rotated and
 * scaled by the hole's frame (the transform its outlines went through). Returns
 * an SVG matrix(a b c d e f) taking (x, -y) in course yards to drawing
 * coordinates (x - minX, maxY - y) in the hole's frame.
 */
export function aerialMatrix(frame: [number, number, number, number], minX: number, maxY: number): [number, number, number, number, number, number] {
  const [ox, oy, th, s] = frame;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  return [s * c, -s * sn, s * sn, s * c, -s * c * ox + s * sn * oy - minX, maxY + s * sn * ox + s * c * oy];
}
