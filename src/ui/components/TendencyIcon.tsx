import { useId } from "react";
import {
  Activity, ArrowDownToLine, ArrowUp, ArrowUpFromLine, ChartNoAxesColumn, CircleDotDashed,
  CloudRainWind, CloudSun, Crown, Crosshair, Equal, FlagTriangleRight, Gauge, MoveLeft,
  MoveRight, Redo2, Rocket, Scale, Shield, ShieldCheck, Snail, Split, Sun, Target, Undo2,
  Waves, Zap, type LucideIcon,
} from "lucide-react";

const COLORS: Record<string, string> = {
  "Miss bias": "#278E87",
  "Shot shape": "#348E74",
  "Ball flight": "#277A9A",
  Strategy: "#A06C28",
  "Putting pace": "#7A5AA6",
  "Under pressure": "#B35445",
  "Week rhythm": "#326DA0",
  Weather: "#3D7F78",
  Consistency: "#8A667F",
};

const iconFor = (label: string, value: string): LucideIcon => {
  if (label === "Miss bias") return value.startsWith("Right") ? MoveRight : value.startsWith("Left") ? MoveLeft : Split;
  if (label === "Shot shape") return value === "Draw" ? Undo2 : value === "Fade" ? Redo2 : ArrowUp;
  if (label === "Ball flight") return value.startsWith("Low") ? ArrowDownToLine : value === "High" ? ArrowUpFromLine : Waves;
  if (label === "Strategy") return value === "Aggressive" ? Crosshair : value === "Conservative" ? Shield : Scale;
  if (label === "Putting pace") return value === "Charger" ? Gauge : value === "Dies it in" ? Snail : CircleDotDashed;
  if (label === "Under pressure") return value === "Front-runner" ? Crown : value === "Chaser" ? Target : Equal;
  if (label === "Week rhythm") return value === "Fast starter" ? Rocket : value === "Strong finisher" ? FlagTriangleRight : Activity;
  if (label === "Weather") return value === "Bad-weather player" ? CloudRainWind : value === "Fair-weather player" ? Sun : CloudSun;
  return value === "Streaky" ? Zap : value === "Steady" ? ShieldCheck : ChartNoAxesColumn;
};

/** A compact archetype-style badge for one tendency possibility. */
export function TendencyBadge({ label, value, size = 38 }: { label: string; value: string; size?: number }) {
  const Icon = iconFor(label, value);
  const color = COLORS[label] ?? "#287F76";
  const gradientId = `td${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className="tendency-symbol" role="img" aria-label={`${label}: ${value}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <radialGradient id={gradientId} cx="34%" cy="28%" r="76%">
            <stop offset="0" stopColor="#fff" stopOpacity=".34" />
            <stop offset=".56" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".24" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill={color} />
        <circle cx="32" cy="32" r="30" fill={`url(#${gradientId})`} />
        <circle cx="32" cy="32" r="26.5" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="1.25" />
        <g transform="translate(17 17)"><Icon size={30} color="#fff" strokeWidth={2.15} /></g>
      </svg>
    </span>
  );
}

