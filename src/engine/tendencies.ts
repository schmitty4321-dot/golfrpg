import { TOUR_AVERAGE } from "./attributes";
import { traceSeed } from "./tracer";
import type { Player } from "./types";

/**
 * A player's habits: how he misses, shapes and flies the ball, how he plays
 * a hole, and how he putts. Fixed per player (from who he is, not luck on the
 * day) and used by the shot tracer, so they show up in replays and stats.
 */
export interface Tendencies {
  /** Share of missed fairways that go right, 0.3-0.7. */
  missRight: number;
  shape: "draw" | "fade" | "straight";
  flight: "low" | "mid" | "high";
  strategy: "aggressive" | "balanced" | "conservative";
  puttingPace: "charger" | "balanced" | "dier";
}

export function tendencies(p: Player): Tendencies {
  const a = p.attributes;
  const missRight = 0.3 + ((traceSeed(p.id, "miss") % 1000) / 1000) * 0.4;
  const flightScore = (a.trajectoryControl + a.windTolerance) / 2 - TOUR_AVERAGE;
  const attack = a.aggression - TOUR_AVERAGE - (a.courseManagement - TOUR_AVERAGE) * 0.3;
  const paceRoll = (traceSeed(p.id, "pace") % 1000) / 1000;
  return {
    missRight,
    shape: missRight > 0.56 ? "fade" : missRight < 0.44 ? "draw" : "straight",
    flight: flightScore >= 2 ? "low" : flightScore <= -2 ? "high" : "mid",
    strategy: attack >= 2.5 ? "aggressive" : attack <= -2.5 ? "conservative" : "balanced",
    puttingPace: a.speedControl >= 15 ? "balanced" : paceRoll < 0.4 ? "charger" : paceRoll > 0.75 ? "dier" : "balanced",
  };
}

/** Plain-words descriptions for the profile. */
export function describeTendencies(t: Tendencies): { label: string; value: string; detail: string }[] {
  const right = Math.round(t.missRight * 100);
  return [
    {
      label: "Miss bias",
      value: right >= 55 ? `Right (${right}%)` : right <= 45 ? `Left (${100 - right}%)` : "Both ways",
      detail: `When he misses a fairway it goes right ${right}% of the time and left ${100 - right}%.`,
    },
    {
      label: "Shot shape",
      value: t.shape === "draw" ? "Draw" : t.shape === "fade" ? "Fade" : "Straight",
      detail: t.shape === "draw" ? "Works it right to left; the miss is a hook." : t.shape === "fade" ? "Works it left to right; the miss is a slice." : "Hits it straight, with no strong shape either way.",
    },
    {
      label: "Ball flight",
      value: t.flight === "low" ? "Low, penetrating" : t.flight === "high" ? "High" : "Medium",
      detail: t.flight === "low" ? "Keeps it under the wind." : t.flight === "high" ? "Lands it softly, but the wind gets hold of it." : "A standard tour flight.",
    },
    {
      label: "Strategy",
      value: t.strategy === "aggressive" ? "Aggressive" : t.strategy === "conservative" ? "Conservative" : "Balanced",
      detail: t.strategy === "aggressive" ? "Goes for par 5s in two and attacks pins." : t.strategy === "conservative" ? "Lays up and plays to the middle of greens." : "Picks his moments.",
    },
    {
      label: "Putting pace",
      value: t.puttingPace === "charger" ? "Charger" : t.puttingPace === "dier" ? "Dies it in" : "Good pace",
      detail: t.puttingPace === "charger" ? "Rams putts past: more holed, longer comebacks." : t.puttingPace === "dier" ? "Lags it to the hole: fewer three-putts, fewer bold makes." : "Controls his speed well.",
    },
  ];
}
