import { useId } from "react";
import { Activity, Angry, BadgeCheck, BadgeDollarSign, BatteryFull, BatteryLow, Bed, BetweenHorizontalEnd, Bird, Bomb, Bone, BookOpen, Bot, Briefcase, CalendarX, ChartNoAxesColumn, MapPinned, CircleAlert, CircleCheck, CircleDollarSign, CircleDot, CloudRainWind, CloudSnow, Cog, Coins, CornerUpRight, Crosshair, Crown, Dna, Dumbbell, Eraser, Eye, FlagTriangleRight, Flame, FlameKindling, Flower2, Footprints, Gauge, Gem, Goal, GraduationCap, Hand, HandHeart, Handshake, Heart, HeartHandshake, HeartPulse, House, Infinity, KeyRound, LifeBuoy, LocateFixed, Luggage, Magnet, Megaphone, Mic2, MoonStar, Mountain, MoveRight, Newspaper, NotebookTabs, Paintbrush, Palmtree, PartyPopper, Plane, RefreshCw, Repeat2, Rocket, RotateCcw, RouteOff, Scale, ScanEye, ScatterChart, Scissors, Share2, Shield, ShieldAlert, ShieldCheck, Snail, Snowflake, Sparkles, Split, Sprout, Sun, Sunrise, Swords, Tickets, TrendingDown, Trophy, Undo2, UserRoundCheck, UserRoundMinus, Users, VolumeX, WandSparkles, Waves, Wind, Wrench, Zap, type LucideIcon } from "lucide-react";
import { TRAIT_BY_ID, type TraitCategory, type TraitRarity } from "../../engine";

const CATEGORY_COLORS: Record<TraitCategory, string> = {
  shot: "#159C97",
  short: "#187F8B",
  mental: "#6650A4",
  venue: "#347B4B",
  schedule: "#2D6F96",
  development: "#B97A2B",
  personality: "#9B4D70",
  commercial: "#B18722",
  legendary: "#C45A2A",
};

/** Every trait has a deliberately chosen, compact Lucide pictogram. */
const ICON_BY_TRAIT: Record<string, LucideIcon> = {
  "bombers-licence": Bomb, "fairway-finder": LocateFixed, "spray-hitter": ScatterChart,
  "long-iron-artist": Paintbrush, "wedge-wizard": Goal, "two-way-shaper": Split,
  "one-shape-wonder": CornerUpRight, flusher: Sparkles, "par5-predator": Bird,
  "par3-specialist": FlagTriangleRight, "driver-addict": Zap, stinger: MoveRight,
  "rescue-merchant": LifeBuoy, "rough-rider": Waves, "ground-game": Footprints,

  magician: WandSparkles, "sand-saver": ShieldCheck, "bunker-phobic": ShieldAlert,
  "chip-yips": Hand, "three-foot-robot": Bot, "yips-prone": CircleAlert,
  "speed-slot": Gauge, "slow-green-grinder": Snail, "long-range-sniper": Crosshair,
  "grain-reader": ScanEye, "up-and-down": RefreshCw, "lip-out-magnet": Magnet,

  "ice-water": Snowflake, "tilt-merchant": TrendingDown, grinder: Cog,
  "leaderboard-watcher": Eye, "cut-line-specialist": Scissors, "weekend-tourist": Briefcase,
  "major-mindset": Trophy, "big-stage-freeze": CloudSnow, "short-memory": Eraser,
  perfectionist: BadgeCheck, "momentum-rider": Activity, "playoff-assassin": Swords,
  "revenge-tour": RotateCcw, "rattled-by-crowds": VolumeX, stubborn: RouteOff,

  "links-lifer": Wind, "desert-rat": Sun, "second-shot-lover": BetweenHorizontalEnd,
  "poa-survivor": Sprout, "mile-high": Mountain, "resort-bandit": Palmtree,
  "loves-a-brute": Shield, "birdie-fest": PartyPopper, "course-horse": MapPinned,
  "home-crowd-hero": House, "dawn-patrol": Sunrise, "rain-man": CloudRainWind,

  "iron-man": BatteryFull, "needs-rest": Bed, "jet-lag": Plane,
  "road-warrior": Luggage, "night-before": MoonStar, "gym-rat": Dumbbell,
  "glass-back": Bone, "quick-healer": HeartPulse, "late-fade": BatteryLow,
  "rhythm-player": Repeat2,

  "late-bloomer": Flower2, "early-peaker": Rocket, "swing-tinkerer": Wrench,
  sponge: NotebookTabs, "self-taught": BookOpen, ageless: Infinity,
  plateau: ChartNoAxesColumn, "tournament-learner": GraduationCap, "hyped-junior": Megaphone,
  "comeback-kid": Undo2,

  loyal: HeartHandshake, mercenary: BadgeDollarSign, "media-darling": Mic2,
  diva: Crown, homesick: Heart, "low-maintenance": CircleCheck,
  "jealous-rival": Angry, "money-motivated": CircleDollarSign, "schedule-rebel": CalendarX,
  "team-player": Users, "hard-bargainer": Scale, "grateful-underdog": HandHeart,
  hothead: Flame, mentor: UserRoundCheck,

  "sponsor-magnet": Handshake, "social-media-star": Share2, "scandal-prone": Newspaper,
  "clean-cut": BadgeCheck, "bonus-hunter": Coins, "anonymous-grinder": UserRoundMinus,

  "clutch-gene": Dna, "sunday-red": FlameKindling, "generational-striker": Gem,
  "major-monster": Trophy, houdini: KeyRound, "box-office": Tickets,
};

const RARITY_RING: Record<TraitRarity, string> = {
  common: "#C8D3CF",
  uncommon: "#7EADD1",
  rare: "#A889D0",
  legendary: "#E6B154",
};

/** A compact, archetype-style badge for one player trait. */
export function TraitBadge({ id, size = 28 }: { id: string; size?: number }) {
  const trait = TRAIT_BY_ID.get(id);
  const gradientId = `tb${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!trait) return null;
  const Icon = ICON_BY_TRAIT[id] ?? CircleDot;
  const color = CATEGORY_COLORS[trait.category];
  return (
    <span className="trait-symbol" role="img" aria-label={`${trait.name}: ${trait.effect}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <radialGradient id={gradientId} cx="34%" cy="28%" r="76%">
            <stop offset="0" stopColor="#fff" stopOpacity=".34" />
            <stop offset=".55" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".25" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill={RARITY_RING[trait.rarity]} />
        <circle cx="32" cy="32" r="26.8" fill={color} />
        <circle cx="32" cy="32" r="26.8" fill={`url(#${gradientId})`} />
        <circle cx="32" cy="32" r="23.6" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="1.2" />
        <g transform="translate(17 17)">
          <Icon size={30} color="#fff" strokeWidth={2.15} />
        </g>
      </svg>
    </span>
  );
}



