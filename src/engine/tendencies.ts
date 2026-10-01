import { TOUR_AVERAGE } from "./attributes";
import { traceSeed } from "./tracer";
import { windMultiplier } from "./round";
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
  /** With the lead on the weekend, or chasing: who he plays better as. */
  pressure: "front-runner" | "neutral" | "chaser";
  /** When in the week he plays his best golf. */
  rhythm: "fast starter" | "even" | "strong finisher";
  /** How weather affects him (from wind tolerance and trajectory control). */
  weather: "bad-weather" | "neutral" | "fair-weather";
  consistency: "streaky" | "normal" | "steady";
  /** Multiplier on his round-to-round swings (on top of what focus gives). */
  streak: number;
}

const roll = (p: Player, what: string) => (traceSeed(p.id, what) % 1000) / 1000;

/**
 * Strokes a round his round-level habits add (+) or save (-): early- or
 * late-week form, and how he handles leading or chasing on the weekend.
 * Balanced so a whole field scores the same on average.
 */
export function roundTendencyShift(t: Tendencies, round: number, shotsBehind: number | null): number {
  let shift = 0;
  if (t.rhythm === "fast starter") shift += round <= 2 ? -0.3 : 0.3;
  if (t.rhythm === "strong finisher") shift += round <= 2 ? 0.3 : -0.3;
  if (round >= 3 && shotsBehind !== null) {
    const leading = shotsBehind <= 1;
    const chasing = shotsBehind >= 2 && shotsBehind <= 7;
    if (t.pressure === "front-runner") shift += leading ? -0.4 : chasing ? 0.2 : 0;
    if (t.pressure === "chaser") shift += leading ? 0.4 : chasing ? -0.3 : 0;
  }
  return shift;
}

// Tendencies are asked for on every hole of every replay: cache them per player
// while the attributes they depend on are unchanged.
const cache = new WeakMap<Player, { id: string; a: Player["attributes"]; v: number[]; t: Tendencies }>();
const keyOf = (a: Player["attributes"]) => [a.aggression, a.courseManagement, a.trajectoryControl, a.windTolerance, a.speedControl, a.sundayNerves, a.stamina, a.focus];

export function tendencies(p: Player): Tendencies {
  const a = p.attributes;
  const hit = cache.get(p);
  if (hit && hit.id === p.id) {
    // Same attributes object and nothing it depends on changed (attributes can be edited in place).
    const v = hit.v;
    if (
      hit.a === a && v[0] === a.aggression && v[1] === a.courseManagement && v[2] === a.trajectoryControl && v[3] === a.windTolerance &&
      v[4] === a.speedControl && v[5] === a.sundayNerves && v[6] === a.stamina && v[7] === a.focus
    ) return hit.t;
    if (keyOf(a).every((x, i) => x === v[i])) {
      hit.a = a;
      return hit.t;
    }
  }
  const t = computeTendencies(p);
  cache.set(p, { id: p.id, a, v: keyOf(a), t });
  return t;
}

function computeTendencies(p: Player): Tendencies {
  const a = p.attributes;
  const missRight = 0.3 + ((traceSeed(p.id, "miss") % 1000) / 1000) * 0.4;
  const flightScore = (a.trajectoryControl + a.windTolerance) / 2 - TOUR_AVERAGE;
  const attack = a.aggression - TOUR_AVERAGE - (a.courseManagement - TOUR_AVERAGE) * 0.3;
  const paceRoll = roll(p, "pace");
  const pressureRoll = roll(p, "pressure") + (a.sundayNerves - TOUR_AVERAGE) * 0.03;
  const rhythmRoll = roll(p, "rhythm") + (a.stamina - TOUR_AVERAGE) * 0.02;
  const streak = 0.85 + roll(p, "streak") * 0.35;
  const focusSpread = Math.min(1.3, Math.max(0.7, 1 - (a.focus - TOUR_AVERAGE) * 0.02));
  const wind = windMultiplier(p);
  return {
    missRight,
    shape: missRight > 0.56 ? "fade" : missRight < 0.44 ? "draw" : "straight",
    flight: flightScore >= 2 ? "low" : flightScore <= -2 ? "high" : "mid",
    strategy: attack >= 2.5 ? "aggressive" : attack <= -2.5 ? "conservative" : "balanced",
    puttingPace: a.speedControl >= 15 ? "balanced" : paceRoll < 0.4 ? "charger" : paceRoll > 0.75 ? "dier" : "balanced",
    pressure: pressureRoll > 0.72 ? "front-runner" : pressureRoll < 0.28 ? "chaser" : "neutral",
    rhythm: rhythmRoll < 0.25 ? "fast starter" : rhythmRoll > 0.75 ? "strong finisher" : "even",
    weather: wind <= 0.9 ? "bad-weather" : wind >= 1.1 ? "fair-weather" : "neutral",
    consistency: streak * focusSpread > 1.1 ? "streaky" : streak * focusSpread < 0.92 ? "steady" : "normal",
    streak,
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
    {
      label: "Under pressure",
      value: t.pressure === "front-runner" ? "Front-runner" : t.pressure === "chaser" ? "Chaser" : "Neutral",
      detail:
        t.pressure === "front-runner"
          ? "At his best protecting a weekend lead (about 0.4 a round better), less so coming from behind."
          : t.pressure === "chaser"
            ? "Loves hunting down a leader (about 0.3 a round better), but tightens up with the lead."
            : "Plays the same whether leading or chasing.",
    },
    {
      label: "Week rhythm",
      value: t.rhythm === "fast starter" ? "Fast starter" : t.rhythm === "strong finisher" ? "Strong finisher" : "Even",
      detail:
        t.rhythm === "fast starter"
          ? "Scores best on Thursday and Friday, and fades a little at the weekend."
          : t.rhythm === "strong finisher"
            ? "Slow out of the blocks, but at his best at the weekend."
            : "No strong pattern through the week.",
    },
    {
      label: "Weather",
      value: t.weather === "bad-weather" ? "Bad-weather player" : t.weather === "fair-weather" ? "Fair-weather player" : "Neutral",
      detail:
        t.weather === "bad-weather"
          ? "Wind costs him less than most: he gains on the field when it blows."
          : t.weather === "fair-weather"
            ? "Wind costs him more than most: he wants calm days."
            : "Handles wind like a typical tour player.",
    },
    {
      label: "Consistency",
      value: t.consistency === "streaky" ? "Streaky" : t.consistency === "steady" ? "Steady" : "Normal",
      detail:
        t.consistency === "streaky"
          ? "Big swings: a 64 one day, a 75 the next."
          : t.consistency === "steady"
            ? "Rarely has a big number or a blazing round."
            : "Typical round-to-round swings.",
    },
  ];
}
