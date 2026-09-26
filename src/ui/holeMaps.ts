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
}
interface CourseMap {
  attribution: string;
  holes: Record<string, HoleMap>;
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

/** The real outlines of a hole, or null while loading or when the hole has none. */
export function useHoleMap(real: { courseId: string; hole: number } | undefined): HoleMap | null {
  const [map, setMap] = useState<{ key: string; hole: HoleMap | null } | null>(null);
  const key = real ? `${real.courseId}/${real.hole}` : "";
  useEffect(() => {
    if (!real) return;
    let live = true;
    void loadCourse(real.courseId).then((c) => {
      if (live) setMap({ key: `${real.courseId}/${real.hole}`, hole: c?.holes[String(real.hole)] ?? null });
    });
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return map && map.key === key ? map.hole : null;
}
