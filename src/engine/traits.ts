/**
 * Player traits: 100 quirks on top of attributes and tendencies. A player has
 * one to three, rolled once from who he is (and fixed after that, except the
 * few a coach can cure or a career can earn). This file holds the catalogue,
 * the roll, and the effects that belong to the golf itself; the season code
 * applies the rest (mood, contracts, sponsors, fitness, development).
 */
import { NATIONS } from "./nations";
import { createRng } from "./rng";
import { traceSeed } from "./tracer";
import type { Course, CourseStyle, Hole, Player, StrokesGained } from "./types";

export type TraitCategory = "shot" | "short" | "mental" | "venue" | "schedule" | "development" | "personality" | "commercial" | "legendary";
export type TraitRarity = "common" | "uncommon" | "rare" | "legendary";
export type TraitPolarity = "positive" | "negative" | "mixed";

export const TRAIT_CATEGORY_LABELS: Record<TraitCategory, string> = {
  shot: "Shot-making",
  short: "Short game & putting",
  mental: "Mental",
  venue: "Venue & conditions",
  schedule: "Schedule & fitness",
  development: "Development",
  personality: "Personality",
  commercial: "Commercial",
  legendary: "Legendary",
};

export interface TraitDef {
  id: string;
  name: string;
  category: TraitCategory;
  rarity: TraitRarity;
  polarity: TraitPolarity;
  /** One line of flavour. */
  blurb: string;
  /** What it does in the game, in plain words. */
  effect: string;
  /** Traits a player can't have alongside this one. */
  conflicts?: string[];
  /** How likely this player is to have it (1 = normal, 0 = never). */
  weight?: (p: Player) => number;
}

const at = (p: Player, k: keyof Player["attributes"]) => p.attributes[k];
const hi = (v: number, t: number, w = 3) => (v >= t ? w : 0.3);
const lo = (v: number, t: number, w = 3) => (v <= t ? w : 0.3);
const GBI = ["England", "Scotland", "Ireland", "Northern Ireland"];

/** The region a player calls home, for home-crowd and homesickness traits. */
export function homeRegion(nationality: string): "NA" | "EU" | "ASIA" | "AUS" | null {
  return NATIONS[nationality]?.region ?? null;
}

export const TRAITS: readonly TraitDef[] = [
  // ------------------------------------------------------------ shot-making
  { id: "bombers-licence", name: "Bomber's Licence", category: "shot", rarity: "uncommon", polarity: "mixed", blurb: "Hits it past everyone and doesn't much care where it ends up.", effect: "Reaches par 5s from 15 yards further. Scores better on wide driving holes, blows up more on tight ones.", conflicts: ["fairway-finder"], weight: (p) => hi(at(p, "drivingDistance"), 14) },
  { id: "fairway-finder", name: "Fairway Finder", category: "shot", rarity: "common", polarity: "positive", blurb: "Lives on the short grass.", effect: "The rough costs him a quarter less.", conflicts: ["bombers-licence", "spray-hitter"], weight: (p) => hi(at(p, "drivingAccuracy"), 13, 2) },
  { id: "spray-hitter", name: "Spray Hitter", category: "shot", rarity: "common", polarity: "negative", blurb: "Nobody knows where the tee shot is going, including him.", effect: "The rough costs him more, a quarter more on penal setups.", conflicts: ["fairway-finder"], weight: (p) => lo(at(p, "drivingAccuracy"), 11, 2) },
  { id: "long-iron-artist", name: "Long-Iron Artist", category: "shot", rarity: "uncommon", polarity: "positive", blurb: "Makes a 4-iron look like a wedge.", effect: "Better on par 3s over 210 yards; going for par 5s in two blows up less.", weight: (p) => hi(at(p, "longIrons"), 13) },
  { id: "wedge-wizard", name: "Inside 130", category: "shot", rarity: "uncommon", polarity: "positive", blurb: "Inside 130, he's thinking about making it.", effect: "Approach play +0.12 a round on short courses (par 4s averaging under 420 yards), +0.03 elsewhere.", weight: (p) => hi(at(p, "wedges"), 13) },
  { id: "two-way-shaper", name: "Two-Way Shaper", category: "shot", rarity: "rare", polarity: "positive", blurb: "Moves it either way on demand.", effect: "Blows up 15% less on holes with serious trouble.", conflicts: ["one-shape-wonder"], weight: (p) => hi(at(p, "shotShaping"), 14) },
  { id: "one-shape-wonder", name: "One-Shape Wonder", category: "shot", rarity: "common", polarity: "mixed", blurb: "One shot, grooved to perfection, and nothing else.", effect: "Steadier hole to hole, but blows up more when the trouble sits on his miss side.", conflicts: ["two-way-shaper"], weight: (p) => lo(at(p, "shotShaping"), 12, 2) },
  { id: "flusher", name: "Flusher", category: "shot", rarity: "common", polarity: "positive", blurb: "Every iron comes off the middle.", effect: "Fewer bad iron days: his approach play swings 15% less from round to round." },
  { id: "par5-predator", name: "Par-5 Predator", category: "shot", rarity: "uncommon", polarity: "positive", blurb: "Treats every par 5 as a par 4 and a half.", effect: "0.04 better on every par 5.", weight: (p) => hi(at(p, "drivingDistance"), 13, 2) },
  { id: "par3-specialist", name: "Par-3 Specialist", category: "shot", rarity: "uncommon", polarity: "positive", blurb: "The short holes are where he makes his money.", effect: "0.03 better on par 3s, and 20% fewer big numbers on them.", weight: (p) => hi(at(p, "midIrons"), 13, 2) },
  { id: "driver-addict", name: "Driver Addict", category: "shot", rarity: "common", polarity: "negative", blurb: "Driver out of the bag on every par 4, whatever you tell him.", effect: "Calls to hit 3-wood or an iron off the tee only do half as much.", weight: (p) => hi(at(p, "aggression"), 13, 2) },
  { id: "stinger", name: "Stinger", category: "shot", rarity: "uncommon", polarity: "positive", blurb: "A low bullet that runs forever.", effect: "Laying back with an iron off the tee costs him 0.03 less.", weight: (p) => hi(at(p, "trajectoryControl"), 13) },
  { id: "rescue-merchant", name: "Rescue Merchant", category: "shot", rarity: "common", polarity: "positive", blurb: "Hybrids and fairway woods from anywhere.", effect: "Going for par 5s in two: 0.02 better and 15% fewer blow-ups.", weight: (p) => hi(at(p, "fairwayWoods"), 13, 2) },
  { id: "rough-rider", name: "Rough Rider", category: "shot", rarity: "uncommon", polarity: "positive", blurb: "Strong hands; the long grass doesn't grab the club.", effect: "The rough costs him 30% less on penal setups, 10% less elsewhere." },
  { id: "ground-game", name: "Ground Game", category: "shot", rarity: "common", polarity: "mixed", blurb: "Loves it firm and fast; hates it soft.", effect: "0.08 a round better on firm, dry courses; 0.06 worse in the rain.", conflicts: ["rain-man"] },

  // ------------------------------------------------------------ short game & putting
  { id: "magician", name: "Magician", category: "short", rarity: "rare", polarity: "positive", blurb: "Sees shots around the green no one else does.", effect: "Around the green +0.15 a round.", conflicts: ["chip-yips"], weight: (p) => hi(at(p, "creativity"), 14) },
  { id: "sand-saver", name: "Sand Saver", category: "short", rarity: "common", polarity: "positive", blurb: "Would rather be in the bunker than the rough.", effect: "Greenside bunkers cost him half as much.", conflicts: ["bunker-phobic"], weight: (p) => hi(at(p, "bunkerPlay"), 13) },
  { id: "bunker-phobic", name: "Bunker Phobic", category: "short", rarity: "common", polarity: "negative", blurb: "Sand makes him go pale.", effect: "Greenside bunkers cost him 60% more; more big numbers on heavily bunkered greens.", conflicts: ["sand-saver"], weight: (p) => lo(at(p, "bunkerPlay"), 11) },
  { id: "chip-yips", name: "Chip-Yips", category: "short", rarity: "rare", polarity: "negative", blurb: "The hands just won't work around the greens.", effect: "Around the green −0.2 a round while his form is below par. A season with a mental coach rated 14+ cures it.", conflicts: ["magician"] },
  { id: "three-foot-robot", name: "Three-Foot Robot", category: "short", rarity: "uncommon", polarity: "positive", blurb: "Never misses the ones he should make.", effect: "Putting swings 15% less from day to day, and 10% fewer big numbers.", conflicts: ["yips-prone"], weight: (p) => hi(at(p, "shortPutts"), 13) },
  { id: "yips-prone", name: "Yips-Prone", category: "short", rarity: "uncommon", polarity: "negative", blurb: "Short putts on Sunday are a lottery.", effect: "Putting −0.15 a round on the weekend within two of the lead. Veterans can develop it after 38.", conflicts: ["three-foot-robot", "clutch-gene"], weight: (p) => (p.age >= 33 ? 2 : 0.6) * lo(at(p, "shortPutts"), 12, 2) },
  { id: "speed-slot", name: "Speed-Slot Specialist", category: "short", rarity: "common", polarity: "mixed", blurb: "Loves them glassy.", effect: "Putting +0.1 a round on greens running 13+; −0.08 on 11 or slower.", conflicts: ["slow-green-grinder"] },
  { id: "slow-green-grinder", name: "Slow-Green Grinder", category: "short", rarity: "common", polarity: "mixed", blurb: "Needs to hit it; slick greens terrify him.", effect: "Putting +0.1 a round on greens running 11 or slower; −0.1 on 13+.", conflicts: ["speed-slot"] },
  { id: "long-range-sniper", name: "Long-Range Sniper", category: "short", rarity: "uncommon", polarity: "positive", blurb: "Makes more 30-footers than anyone.", effect: "Charging the putts saves him an extra 0.012 a hole.", weight: (p) => hi(at(p, "greenReading"), 13) },
  { id: "grain-reader", name: "Grain Reader", category: "short", rarity: "common", polarity: "positive", blurb: "Can read Bermuda grain in the dark.", effect: "On bermuda greens he loses only half the usual penalty for not having grown up on them.", weight: (p) => (p.grassPreference === "bermuda" ? 0 : 1) },
  { id: "up-and-down", name: "Up-and-Down Machine", category: "short", rarity: "common", polarity: "positive", blurb: "Misses greens and still makes par.", effect: "Around the green +0.05 a round; 10% fewer big numbers on par 4s.", weight: (p) => hi(at(p, "chipping"), 13, 2) },
  { id: "lip-out-magnet", name: "Lip-Out Magnet", category: "short", rarity: "common", polarity: "negative", blurb: "The golf gods don't like him.", effect: "Putting −0.06 a round." },

  // ------------------------------------------------------------ mental
  { id: "ice-water", name: "Ice Water", category: "mental", rarity: "uncommon", polarity: "positive", blurb: "Heart rate doesn't change on the 72nd hole.", effect: "Handles weekend pressure as if his nerve and composure were 3 higher.", conflicts: ["leaderboard-watcher"], weight: (p) => hi(at(p, "composure"), 13) },
  { id: "tilt-merchant", name: "Tilt Merchant", category: "mental", rarity: "common", polarity: "negative", blurb: "One double and the wheels come off.", effect: "After a double bogey or worse, the next hole is 0.15 worse and wilder. A season with a mental coach rated 14+ cures it.", conflicts: ["short-memory"], weight: (p) => lo(at(p, "bounceBack"), 11, 2) },
  { id: "grinder", name: "Scrapper", category: "mental", rarity: "common", polarity: "positive", blurb: "Posts a score when he has nothing.", effect: "On a bad day (a stroke or more below his level) he claws back 0.2." },
  { id: "leaderboard-watcher", name: "Leaderboard Watcher", category: "mental", rarity: "common", polarity: "negative", blurb: "Can't stop looking at the big board.", effect: "Sunday's back nine within two of the lead: 10% wilder.", conflicts: ["ice-water"] },
  { id: "cut-line-specialist", name: "Cut-Line Specialist", category: "mental", rarity: "uncommon", polarity: "positive", blurb: "Always finds a way to play the weekend.", effect: "Round 2 within a shot of the projected cut: 0.3 better." },
  { id: "weekend-tourist", name: "Weekend Tourist", category: "mental", rarity: "common", polarity: "negative", blurb: "Makes the cut, then switches off.", effect: "Weekend rounds outside the top 30: 0.2 worse." },
  { id: "major-mindset", name: "Major Mindset", category: "mental", rarity: "rare", polarity: "positive", blurb: "Built his whole year around four weeks.", effect: "Majors: 0.25 a round better. Regular and opposite-field events: 0.05 worse. Can be earned by winning a major.", conflicts: ["big-stage-freeze", "major-monster"] },
  { id: "big-stage-freeze", name: "Big-Stage Freeze", category: "mental", rarity: "uncommon", polarity: "negative", blurb: "The majors are a different game and he knows it.", effect: "First two rounds of a major: 0.25 worse, easing 0.05 with each major he's played. A mental coach can cure it.", conflicts: ["major-mindset", "major-monster"] },
  { id: "short-memory", name: "Short Memory", category: "mental", rarity: "common", polarity: "positive", blurb: "Bogey? What bogey?", effect: "The hole after a bogey is 0.05 better.", conflicts: ["tilt-merchant", "momentum-rider"] },
  { id: "perfectionist", name: "Perfectionist", category: "mental", rarity: "common", polarity: "mixed", blurb: "Nothing is ever good enough.", effect: "5% steadier hole to hole, but a missed cut knocks his form down further." },
  { id: "momentum-rider", name: "Momentum Rider", category: "mental", rarity: "uncommon", polarity: "mixed", blurb: "Birdies come in bunches; so do bogeys.", effect: "After a birdie the next hole is 0.04 better; after a bogey, 0.04 worse.", conflicts: ["short-memory"] },
  { id: "playoff-assassin", name: "Playoff Assassin", category: "mental", rarity: "rare", polarity: "positive", blurb: "Take him to extra holes at your peril.", effect: "Sudden-death holes 0.15 better; FedEx Cup playoff events 0.1 a round better." },
  { id: "revenge-tour", name: "Revenge Tour", category: "mental", rarity: "uncommon", polarity: "positive", blurb: "Remembers every course that beat him.", effect: "0.15 a round better at an event where he missed the cut last season." },
  { id: "rattled-by-crowds", name: "Rattled by Crowds", category: "mental", rarity: "uncommon", polarity: "negative", blurb: "Loves the quiet opposite-field weeks.", effect: "8% wilder at majors and signature events; 0.1 a round better at opposite-field events." },
  { id: "stubborn", name: "Stubborn Game Plan", category: "mental", rarity: "common", polarity: "mixed", blurb: "Has his own ideas about how to play the hole.", effect: "Ignores a quarter of your hole-by-hole calls, but commits harder to the rest: calls do about 80% as much.", weight: (p) => lo(at(p, "coachability"), 11, 2) },

  // ------------------------------------------------------------ venue & conditions
  { id: "links-lifer", name: "Links Lifer", category: "venue", rarity: "uncommon", polarity: "positive", blurb: "Grew up on the dunes; happiest in a gale by the sea.", effect: "Links courses: 0.15 a round better and 10% less bothered by wind.", conflicts: ["resort-bandit"], weight: (p) => ([...GBI, "Australia", "South Africa"].includes(p.nationality) ? 3 : 0.5) },
  { id: "desert-rat", name: "Desert Rat", category: "venue", rarity: "common", polarity: "positive", blurb: "Target golf in the heat suits him.", effect: "Desert courses: 0.12 a round better, 0.16 when they're firm.", weight: (p) => (p.nationality === "USA" ? 2 : 0.6) },
  { id: "second-shot-lover", name: "Second-Shot Course Lover", category: "venue", rarity: "rare", polarity: "positive", blurb: "Tricky, firm, fast greens reward his precise irons.", effect: "Approach play +0.15 a round when the greens run 13+ and play firm.", weight: (p) => hi(at(p, "distanceControl"), 13) },
  { id: "poa-survivor", name: "Poa Survivor", category: "venue", rarity: "uncommon", polarity: "positive", blurb: "Bumpy afternoon poa doesn't bother him.", effect: "On poa: no penalty for not having grown up on it, +0.05 putting, and a further 0.05 in the afternoon wave.", weight: (p) => (p.nationality === "USA" || p.nationality === "Canada" ? 2 : 0.5) * (p.grassPreference === "poa" ? 0.3 : 1) },
  { id: "mile-high", name: "Mile-High Club", category: "venue", rarity: "uncommon", polarity: "positive", blurb: "Dialled in on distance at altitude.", effect: "Approach play +0.1 a round at courses 2,000 feet or more above sea level." },
  { id: "resort-bandit", name: "Resort Course Bandit", category: "venue", rarity: "common", polarity: "mixed", blurb: "Give him a birdie-fest and he'll win it.", effect: "Resort courses 0.15 a round better; links and parkland 0.05 worse.", conflicts: ["links-lifer", "loves-a-brute"] },
  { id: "loves-a-brute", name: "Loves a Brute", category: "venue", rarity: "uncommon", polarity: "positive", blurb: "The harder it plays, the better he likes it.", effect: "Courses playing 4+ over par for the field: 0.15 a round better. Easy courses: 0.05 worse.", conflicts: ["birdie-fest", "resort-bandit"] },
  { id: "birdie-fest", name: "Birdie-Fest Only", category: "venue", rarity: "common", polarity: "mixed", blurb: "Needs to go low to feel alive.", effect: "Courses playing under par: 0.1 a round better. Brutes (4+ over): 0.15 worse.", conflicts: ["loves-a-brute"] },
  { id: "course-horse", name: "Course Horse", category: "venue", rarity: "common", polarity: "positive", blurb: "Some places just fit his eye.", effect: "Learns courses twice as fast: every round and good finish builds his familiarity double." },
  { id: "home-crowd-hero", name: "Home Crowd Hero", category: "venue", rarity: "uncommon", polarity: "positive", blurb: "The home fans carry him.", effect: "Events in his home region: 0.12 a round better, and he's happier afterwards.", weight: (p) => (homeRegion(p.nationality) === null ? 0 : p.nationality === "USA" ? 0.4 : 2) },
  { id: "dawn-patrol", name: "Dawn Patrol", category: "venue", rarity: "common", polarity: "mixed", blurb: "Likes to be first off, before the greens get spiked up.", effect: "Morning wave 0.08 a round better; afternoon 0.08 worse." },
  { id: "rain-man", name: "Rain Man", category: "venue", rarity: "uncommon", polarity: "positive", blurb: "Wet days, soft greens: his kind of golf.", effect: "0.1 a round better in the rain, on top of the field's rain bonus.", conflicts: ["ground-game"] },

  // ------------------------------------------------------------ schedule & fitness
  { id: "iron-man", name: "Iron Man", category: "schedule", rarity: "rare", polarity: "positive", blurb: "Would play 35 events if you let him.", effect: "Tournaments tire him 30% less.", conflicts: ["needs-rest", "glass-back", "late-fade"], weight: (p) => hi(at(p, "stamina"), 14) },
  { id: "needs-rest", name: "Needs Rest Weeks", category: "schedule", rarity: "common", polarity: "negative", blurb: "Three in a row and he's running on fumes.", effect: "A third straight start tires him 40% more and sours his mood.", conflicts: ["iron-man"], weight: (p) => lo(at(p, "stamina"), 11, 2) },
  { id: "jet-lag", name: "Jet-Lag Prone", category: "schedule", rarity: "common", polarity: "negative", blurb: "Never sleeps on a plane.", effect: "First event after a move to another region: 0.25 worse in rounds 1 and 2.", conflicts: ["road-warrior"] },
  { id: "road-warrior", name: "Road Warrior", category: "schedule", rarity: "uncommon", polarity: "positive", blurb: "Hotel rooms, airports: all home to him.", effect: "Travel between regions doesn't tire him.", conflicts: ["jet-lag", "homesick"] },
  { id: "night-before", name: "Night-Before Traveller", category: "schedule", rarity: "common", polarity: "mixed", blurb: "Skips the practice rounds, lands Wednesday night.", effect: "Round 1 0.15 worse; each event tires him 15% less." },
  { id: "gym-rat", name: "Gym Rat", category: "schedule", rarity: "uncommon", polarity: "mixed", blurb: "Lives in the fitness trailer.", effect: "Stamina and flexibility develop 30% faster; high-intensity training injures him more often.", conflicts: ["glass-back"] },
  { id: "glass-back", name: "Glass Back", category: "schedule", rarity: "uncommon", polarity: "negative", blurb: "One awkward lie from the physio table.", effect: "50% likelier to get injured; injuries last a week longer.", conflicts: ["quick-healer", "iron-man", "gym-rat"], weight: (p) => hi(at(p, "injuryProneness"), 13) },
  { id: "quick-healer", name: "Quick Healer", category: "schedule", rarity: "uncommon", polarity: "positive", blurb: "Back on the range while others are in the boot.", effect: "Injuries heal 40% faster.", conflicts: ["glass-back"] },
  { id: "late-fade", name: "Late-Season Fade", category: "schedule", rarity: "common", polarity: "negative", blurb: "Running on empty by the playoffs.", effect: "After week 30: 0.1 a round worse and recovers more slowly between events.", conflicts: ["iron-man"] },
  { id: "rhythm-player", name: "Rhythm Player", category: "schedule", rarity: "common", polarity: "mixed", blurb: "Needs reps to find his game.", effect: "0.05 a round better for each straight start (up to 0.15); 0.1 worse first time out after three weeks off." },

  // ------------------------------------------------------------ development
  { id: "late-bloomer", name: "Late Bloomer", category: "development", rarity: "uncommon", polarity: "positive", blurb: "Nobody saw it coming until he was 29.", effect: "Peaks three years later and keeps growing at a young player's rate for longer.", conflicts: ["early-peaker", "plateau"], weight: (p) => (p.age <= 25 ? 1 : 0) },
  { id: "early-peaker", name: "Early Peaker", category: "development", rarity: "common", polarity: "mixed", blurb: "Brilliant at 22; the rest caught up.", effect: "Grows 25% faster until 24, but peaks three years earlier and declines a year sooner.", conflicts: ["late-bloomer", "ageless"], weight: (p) => (p.age <= 25 ? 1 : 0) },
  { id: "swing-tinkerer", name: "Swing Tinkerer", category: "development", rarity: "common", polarity: "negative", blurb: "Can't leave a working swing alone.", effect: "About once every five seasons he starts a swing rebuild nobody asked for." },
  { id: "sponge", name: "Sponge", category: "development", rarity: "uncommon", polarity: "positive", blurb: "Every lesson sticks.", effect: "The skills his training focuses on grow 25% faster.", conflicts: ["self-taught"], weight: (p) => hi(at(p, "coachability"), 13) },
  { id: "self-taught", name: "Self-Taught", category: "development", rarity: "common", polarity: "mixed", blurb: "Figured it out on a public range, alone.", effect: "Develops twice as well without a coach, but gets only 80% of a coach's help." , conflicts: ["sponge"] },
  { id: "ageless", name: "Ageless", category: "development", rarity: "rare", polarity: "positive", blurb: "Hits it as far at 44 as he did at 30.", effect: "Power and fitness fade half as fast with age.", conflicts: ["early-peaker"] },
  { id: "plateau", name: "Plateau", category: "development", rarity: "common", polarity: "negative", blurb: "What you see is what you get.", effect: "From 25 on he stops growing half a point above where he is.", conflicts: ["late-bloomer"] },
  { id: "tournament-learner", name: "Tournament Learner", category: "development", rarity: "uncommon", polarity: "positive", blurb: "Learns more in a Sunday than a month on the range.", effect: "Nerve, composure, focus and course management grow twice as fast in weeks he competes." },
  { id: "hyped-junior", name: "Hyped Junior", category: "development", rarity: "uncommon", polarity: "mixed", blurb: "The next big thing, according to everyone.", effect: "Scouts rate his ceiling 1.5 higher than it is.", weight: (p) => (p.age <= 23 ? 1.5 : 0) },
  { id: "comeback-kid", name: "Comeback Kid", category: "development", rarity: "uncommon", polarity: "positive", blurb: "Comes back from injury hungrier.", effect: "After an injury of six weeks or more: returns in form and develops 50% faster for ten weeks." },

  // ------------------------------------------------------------ personality
  { id: "loyal", name: "Loyal", category: "personality", rarity: "common", polarity: "positive", blurb: "You believed in him first; he doesn't forget.", effect: "His mood sinks half as fast, and he's much easier to re-sign.", conflicts: ["mercenary"], weight: (p) => hi(at(p, "professionalism"), 13, 2) },
  { id: "mercenary", name: "Mercenary", category: "personality", rarity: "common", polarity: "negative", blurb: "Goes where the money is.", effect: "Hard to re-sign unless he's very happy.", conflicts: ["loyal"], weight: (p) => (at(p, "ambition") >= 13 && at(p, "professionalism") <= 12 ? 3 : 0.4) },
  { id: "media-darling", name: "Media Darling", category: "personality", rarity: "uncommon", polarity: "positive", blurb: "Every writer's favourite quote.", effect: "Your agency gains extra reputation when he wins; sponsors pay 5% more.", conflicts: ["hothead"] },
  { id: "diva", name: "Diva", category: "personality", rarity: "uncommon", polarity: "negative", blurb: "Expects the best coach, the best hotel and the best tee time.", effect: "Unhappy every week unless all his coaches are rated 14+.", conflicts: ["low-maintenance"] },
  { id: "homesick", name: "Homesick", category: "personality", rarity: "common", polarity: "negative", blurb: "Misses his family on the road.", effect: "Three straight starts away from his home region: mood and form drop each week.", conflicts: ["road-warrior"], weight: (p) => (homeRegion(p.nationality) === null ? 0 : 1) },
  { id: "low-maintenance", name: "Low-Maintenance", category: "personality", rarity: "common", polarity: "positive", blurb: "Just tell him where to be.", effect: "Schedule and commission decisions upset him 40% less.", conflicts: ["diva"] },
  { id: "jealous-rival", name: "Jealous Rival", category: "personality", rarity: "uncommon", polarity: "negative", blurb: "Can't stand seeing a stablemate win.", effect: "Unhappy whenever another of your clients wins.", conflicts: ["team-player"] },
  { id: "money-motivated", name: "Money Motivated", category: "personality", rarity: "common", polarity: "mixed", blurb: "Keeps a close eye on the prize money.", effect: "Happier with every big cheque; commission matters 50% more to him in talks." },
  { id: "schedule-rebel", name: "Schedule Rebel", category: "personality", rarity: "common", polarity: "negative", blurb: "Wants to choose where he plays.", effect: "Hates being kept out of big events, and resents being sent to opposite-field weeks." },
  { id: "team-player", name: "Team Player", category: "personality", rarity: "uncommon", polarity: "positive", blurb: "Likes being part of a stable.", effect: "Happier when other clients play the same event; free agents like your agency more while he's on the books.", conflicts: ["jealous-rival"] },
  { id: "hard-bargainer", name: "Hard Bargainer", category: "personality", rarity: "common", polarity: "negative", blurb: "Negotiates every clause.", effect: "Harder to re-sign." },
  { id: "grateful-underdog", name: "Grateful Underdog", category: "personality", rarity: "uncommon", polarity: "positive", blurb: "You gave him a chance nobody else would.", effect: "Signed from outside the world top 100: his mood never drops below 40 for two seasons, and he's easier to re-sign." },
  { id: "hothead", name: "Hothead", category: "personality", rarity: "common", polarity: "negative", blurb: "Club throws, fines, headlines.", effect: "Missed cuts sour his mood, and sometimes make the news at your agency's expense.", conflicts: ["media-darling", "clean-cut"], weight: (p) => hi(at(p, "aggression"), 13, 2) },
  { id: "mentor", name: "Mentor", category: "personality", rarity: "uncommon", polarity: "positive", blurb: "The veteran the young players listen to.", effect: "At 34 or older, your clients under 25 develop 10% faster while he's signed.", weight: (p) => (p.age >= 30 ? 2 : 0.2) },

  // ------------------------------------------------------------ commercial
  { id: "sponsor-magnet", name: "Sponsor Magnet", category: "commercial", rarity: "uncommon", polarity: "positive", blurb: "Brands queue up for him.", effect: "Sponsor offers are 20% bigger and 50% more frequent.", conflicts: ["anonymous-grinder"] },
  { id: "social-media-star", name: "Social Media Star", category: "commercial", rarity: "uncommon", polarity: "mixed", blurb: "Two million followers and counting.", effect: "Under 30: sponsor offers 15% bigger. Missed cuts bring online abuse and a mood dip.", weight: (p) => (p.age <= 28 ? 2 : 0.3) },
  { id: "scandal-prone", name: "Scandal-Prone", category: "commercial", rarity: "uncommon", polarity: "negative", blurb: "Always one headline from trouble.", effect: "About once every twenty seasons, a scandal costs him a sponsor and your agency reputation.", conflicts: ["clean-cut"] },
  { id: "clean-cut", name: "Clean-Cut Image", category: "commercial", rarity: "common", polarity: "positive", blurb: "The family-friendly face of the tour.", effect: "Financial, watch and car deals 15% bigger.", conflicts: ["scandal-prone", "hothead"] },
  { id: "bonus-hunter", name: "Bonus Hunter", category: "commercial", rarity: "common", polarity: "mixed", blurb: "Bets on himself in every deal.", effect: "Sponsor deals pay 10% less a year but 30% more in win and major bonuses." },
  { id: "anonymous-grinder", name: "Anonymous Grinder", category: "commercial", rarity: "common", polarity: "negative", blurb: "Great golfer; nobody knows his name.", effect: "Sponsor offers 25% smaller unless he's in the world top 20.", conflicts: ["sponsor-magnet", "box-office"] },

  // ------------------------------------------------------------ legendary
  { id: "clutch-gene", name: "Clutch Gene", category: "legendary", rarity: "legendary", polarity: "positive", blurb: "When it matters most, he's at his best.", effect: "Weekend pressure helps him almost twice as much and hurts half as much; blow-ups halve on the last three holes on Sunday in contention.", conflicts: ["leaderboard-watcher", "yips-prone"] },
  { id: "sunday-red", name: "Sunday Red", category: "legendary", rarity: "legendary", polarity: "positive", blurb: "Put him within three going into Sunday and watch.", effect: "Final round within three of the lead: 0.35 better." },
  { id: "generational-striker", name: "Generational Ball-Striker", category: "legendary", rarity: "legendary", polarity: "positive", blurb: "The purest strike of his generation.", effect: "Off the tee and approach +0.15 a round combined, and 20% steadier.", weight: (p) => ((at(p, "midIrons") + at(p, "drivingAccuracy")) / 2 >= 13 ? 2 : 0.5) },
  { id: "major-monster", name: "Major Monster", category: "legendary", rarity: "legendary", polarity: "positive", blurb: "Majors are where he builds his legacy.", effect: "Majors: 0.4 a round better.", conflicts: ["major-mindset", "big-stage-freeze"] },
  { id: "houdini", name: "Houdini", category: "legendary", rarity: "legendary", polarity: "positive", blurb: "No trouble he can't escape.", effect: "40% fewer big numbers on every hole.", conflicts: ["tilt-merchant"] },
  { id: "box-office", name: "Box Office", category: "legendary", rarity: "legendary", polarity: "positive", blurb: "Moves TV ratings and ticket sales.", effect: "Sponsor offers 50% bigger; your agency gains reputation from his top-10s.", conflicts: ["anonymous-grinder"] },
];

export const TRAIT_BY_ID: ReadonlyMap<string, TraitDef> = new Map(TRAITS.map((t) => [t.id, t]));
export const traitDef = (id: string): TraitDef | undefined => TRAIT_BY_ID.get(id);

function conflicts(a: string, b: string): boolean {
  return !!TRAIT_BY_ID.get(a)?.conflicts?.includes(b) || !!TRAIT_BY_ID.get(b)?.conflicts?.includes(a);
}

/** Rolls a player's traits: one to three, fixed by his id and who he is. */
export function rollTraits(p: Player): string[] {
  const rng = createRng(traceSeed(p.id, "traits"));
  const n = rng.next() < 0.35 ? 1 : rng.next() < 0.69 ? 2 : 3;
  const out: string[] = [];
  for (let slot = 0; slot < n; slot++) {
    const r = rng.next() * 100;
    let rarity: TraitRarity = r < 60 ? "common" : r < 88 ? "uncommon" : r < 98 ? "rare" : "legendary";
    if (rarity === "legendary" && out.some((id) => TRAIT_BY_ID.get(id)!.rarity === "legendary")) rarity = "rare";
    const pool = TRAITS.filter((t) => t.rarity === rarity && !out.includes(t.id) && !out.some((o) => conflicts(o, t.id)))
      .map((t) => ({ t, w: t.weight ? t.weight(p) : 1 }))
      .filter((x) => x.w > 0);
    const total = pool.reduce((s, x) => s + x.w, 0);
    if (total <= 0) continue;
    let pick = rng.next() * total;
    for (const x of pool) {
      pick -= x.w;
      if (pick <= 0) {
        out.push(x.t.id);
        break;
      }
    }
  }
  return out;
}

/** A player's traits: assigned once (see `ensureTraits` in the season code) and kept on the player. */
export function traitsOf(p: Player): readonly string[] {
  if (!p.traits) p.traits = rollTraits(p);
  return p.traits;
}

export const hasTrait = (p: Player, id: string): boolean => traitsOf(p).includes(id);

// ------------------------------------------------------------------ golf effects

/** Feet above sea level, for the few venues high enough to matter. */
const ALTITUDE: Record<string, number> = { "black-desert": 2700, "walnut-cove": 2200, "tpc-scottsdale": 1500 };
export const courseAltitude = (course: Course): number => ALTITUDE[course.id] ?? 0;

/** How far over par the field plays this course (real scoring averages where known). */
export function courseDifficulty(course: Course): number {
  const par = course.holes.reduce((s, h) => s + h.par, 0);
  if (course.holes.every((h) => h.tourAverage !== undefined)) return course.holes.reduce((s, h) => s + h.tourAverage!, 0) - par;
  // Fictional courses: long, tight, penal, fast setups play harder.
  const yards = course.holes.reduce((s, h) => s + h.yards, 0);
  const hazard = course.holes.reduce((s, h) => s + h.hazard, 0);
  return (yards - 7200) / 150 + hazard * 0.25 + course.roughPenalty * 2 + (course.greenSpeed - 12) * 0.8 - 1;
}

/** What the season knows about a player's week, for traits that care about schedule and history. */
export interface PlayerEventContext {
  /** Majors he had started before this one. */
  majorsStarted: number;
  /** Missed the cut at this event last season. */
  missedCutHereLastSeason: boolean;
  /** Top-25 finishes at this event in past seasons. */
  top25sHere: number;
  /** His caddie, when the season knows one (your clients). */
  caddie?: import("./equipment").CaddieOnBag;
  /** Flying private or charter: no jet lag. */
  flewPrivate?: boolean;
  /** Course familiarity, the field's average this week, and whether it's his first time. */
  familiarity?: number;
  fieldFamiliarity?: number;
  debut?: boolean;
  /** The event is in his home region. */
  home: boolean;
  /** He flew in from another region. */
  regionChanged: boolean;
  /** Straight weeks played, counting this one. */
  consecutiveStarts: number;
  /** Weeks since his last start (0: he played last week). */
  weeksOff: number;
  /** Past week 30 of the season. */
  lateSeason: boolean;
}

/** The round being played, as the trait effects see it. */
export interface TraitRoundInfo {
  player: Player;
  course: Course;
  rain: boolean;
  wave: "AM" | "PM";
  round: number;
  shotsBehind: number | null;
  tier?: string;
  event?: PlayerEventContext;
  /** Round 2: shots inside (+) or outside (-) the projected cut after round 1. */
  cutGap?: number | null;
  /** Rounds 3-4: position after 36 holes. */
  position36?: number | null;
}

/**
 * Traits help the average player about 0.1 a round (most are small edges).
 * Every round gives that back, so a whole field still scores what the courses
 * are calibrated to; a player's traits only move him against the field.
 */
export const TRAIT_BALANCE = 0.1;

const SG_ZERO = (): StrokesGained => ({ offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 });

/**
 * A round's trait effects: strokes-gained changes by category (positive
 * helps), a flat strokes-per-round shift (positive hurts), and multipliers on
 * how much each category swings from day to day.
 */
export function traitRoundEffects(r: TraitRoundInfo): { sg: StrokesGained; strokes: number; spread: StrokesGained; grinder: boolean } {
  const sg = SG_ZERO();
  const spread: StrokesGained = { offTheTee: 1, approach: 1, aroundTheGreen: 1, putting: 1 };
  let strokes = TRAIT_BALANCE;
  let grinder = false;
  const { course, player: p, event: e } = r;
  const style: CourseStyle = course.style;
  const weekend = r.round >= 3;
  const inTheHunt = (n: number) => weekend && r.shotsBehind !== null && r.shotsBehind <= n;
  const firmDry = !r.rain && course.firmness > 0.6;
  for (const id of traitsOf(p)) {
    switch (id) {
      case "wedge-wizard": {
        const par4s = course.holes.filter((h) => h.par === 4);
        const avg = par4s.reduce((s, h) => s + h.yards, 0) / Math.max(1, par4s.length);
        sg.approach += avg < 420 ? 0.12 : 0.03;
        break;
      }
      case "flusher": spread.approach *= 0.85; break;
      case "ground-game": strokes += firmDry ? -0.08 : r.rain ? 0.06 : 0; break;
      case "magician": sg.aroundTheGreen += 0.15; break;
      case "chip-yips": if (p.form < 0) sg.aroundTheGreen -= 0.2; break;
      case "three-foot-robot": spread.putting *= 0.85; break;
      case "yips-prone": if (inTheHunt(2)) sg.putting -= 0.15; break;
      case "speed-slot": sg.putting += course.greenSpeed >= 13 ? 0.1 : course.greenSpeed <= 11 ? -0.08 : 0; break;
      case "slow-green-grinder": sg.putting += course.greenSpeed <= 11 ? 0.1 : course.greenSpeed >= 13 ? -0.1 : 0; break;
      case "grain-reader": if (course.grass === "bermuda" && p.grassPreference !== "bermuda") sg.putting += 0.03; break;
      case "up-and-down": sg.aroundTheGreen += 0.05; break;
      case "lip-out-magnet": sg.putting -= 0.06; break;
      case "grinder": grinder = true; break;
      case "cut-line-specialist": if (r.round === 2 && r.cutGap != null && Math.abs(r.cutGap) <= 1) strokes -= 0.3; break;
      case "weekend-tourist": if (weekend && r.position36 != null && r.position36 > 30) strokes += 0.2; break;
      case "major-mindset": strokes += r.tier === "major" ? -0.25 : r.tier === "standard" || r.tier === "opposite" ? 0.05 : 0; break;
      case "big-stage-freeze": if (r.tier === "major" && r.round <= 2) strokes += Math.max(0, 0.25 - 0.05 * (e?.majorsStarted ?? 0)); break;
      case "playoff-assassin": if (r.tier === "playoff" || r.tier === "finale") strokes -= 0.1; break;
      case "revenge-tour": if (e?.missedCutHereLastSeason) strokes -= 0.15; break;
      case "rattled-by-crowds": if (r.tier === "opposite") strokes -= 0.1; break;
      case "links-lifer": if (style === "links") strokes -= 0.15; break;
      case "desert-rat": if (style === "desert") strokes -= firmDry ? 0.16 : 0.12; break;
      case "second-shot-lover": if (course.greenSpeed >= 13 && course.firmness >= 0.6) sg.approach += 0.15; break;
      case "poa-survivor":
        if (course.grass === "poa") {
          sg.putting += 0.05 + (p.grassPreference !== "poa" ? 0.06 : 0) + (r.wave === "PM" ? 0.05 : 0);
        }
        break;
      case "mile-high": if (courseAltitude(course) >= 2000) sg.approach += 0.1; break;
      case "resort-bandit": strokes += style === "resort" ? -0.15 : style === "links" || style === "parkland" ? 0.05 : 0; break;
      case "loves-a-brute": {
        const d = courseDifficulty(course);
        strokes += d >= 4 ? -0.15 : d < 0 ? 0.05 : 0;
        break;
      }
      case "birdie-fest": {
        const d = courseDifficulty(course);
        strokes += d < 0 ? -0.1 : d >= 4 ? 0.15 : 0;
        break;
      }
      case "home-crowd-hero": if (e?.home) strokes -= 0.12; break;
      case "dawn-patrol": strokes += r.wave === "AM" ? -0.08 : 0.08; break;
      case "rain-man": if (r.rain) strokes -= 0.1; break;
      case "jet-lag": if (e?.regionChanged && !e.flewPrivate && r.round <= 2) strokes += 0.25; break;
      case "night-before": if (r.round === 1) strokes += 0.15; break;
      case "late-fade": if (e?.lateSeason) strokes += 0.1; break;
      case "rhythm-player":
        if (e) strokes += e.weeksOff >= 3 ? 0.1 : -Math.min(0.15, 0.05 * Math.max(0, e.consecutiveStarts - 1));
        break;
      case "sunday-red": if (r.round === 4 && inTheHunt(3)) strokes -= 0.35; break;
      case "generational-striker":
        sg.offTheTee += 0.075;
        sg.approach += 0.075;
        spread.offTheTee *= 0.8;
        spread.approach *= 0.8;
        break;
      case "major-monster": if (r.tier === "major") strokes -= 0.4; break;
    }
  }
  return { sg, strokes, spread, grinder };
}

/** Hole-level trait effects, applied on top of everything else in playHole. */
export interface TraitHoleInfo {
  player: Player;
  hole: Hole;
  course: Course;
  round: number;
  shotsBehind: number | null;
  tier?: string;
  playoff?: boolean;
  /** The previous hole's score to par (negative: birdie). */
  lastToPar: number;
  /** The rough and bunker costs already in the hole's baseline, so traits can scale them. */
  roughCost: number;
  bunkerCost: number;
}

export function traitHoleEffects(h: TraitHoleInfo): { mean: number; sd: number; blowup: number; wind: number } {
  let mean = 0;
  let sd = 1;
  let blowup = 1;
  let wind = 1;
  const { hole, course, player: p } = h;
  const fw = hole.fairwayWidth || 30;
  for (const id of traitsOf(p)) {
    switch (id) {
      case "bombers-licence":
        if (hole.par > 3 && fw >= 32) mean -= 0.04;
        if (hole.par > 3 && fw < 26) blowup *= 1.15;
        break;
      case "fairway-finder": mean -= h.roughCost * 0.25; break;
      case "spray-hitter": mean += h.roughCost * (course.roughPenalty > 0.6 ? 0.25 : 0.1); break;
      case "long-iron-artist": if (hole.par === 3 && hole.yards > 210) mean -= 0.04; break;
      case "two-way-shaper": if (hole.hazard >= 0.5) blowup *= 0.85; break;
      case "one-shape-wonder":
        sd *= 0.95;
        // Half the trouble in golf sits on any one player's miss side.
        if (hole.hazard >= 0.5 && traceSeed(course.id, hole.number, "side") % 2 === 0) blowup *= 1.15;
        break;
      case "par5-predator": if (hole.par === 5) mean -= 0.04; break;
      case "par3-specialist":
        if (hole.par === 3) {
          mean -= 0.03;
          blowup *= 0.8;
        }
        break;
      case "rough-rider": mean -= h.roughCost * (course.roughPenalty > 0.5 ? 0.3 : 0.1); break;
      case "sand-saver": mean -= h.bunkerCost * 0.5; break;
      case "bunker-phobic":
        mean += h.bunkerCost * 0.6;
        if (hole.bunkers >= 3) blowup *= 1.1;
        break;
      case "three-foot-robot": blowup *= 0.9; break;
      case "up-and-down": if (hole.par === 4) blowup *= 0.9; break;
      case "tilt-merchant":
        if (h.lastToPar >= 2) {
          mean += 0.15;
          sd *= 1.15;
        }
        break;
      case "leaderboard-watcher": if (h.round === 4 && hole.number > 9 && h.shotsBehind !== null && h.shotsBehind <= 2) sd *= 1.1; break;
      case "short-memory": if (h.lastToPar >= 1) mean -= 0.05; break;
      case "perfectionist": sd *= 0.95; break;
      case "momentum-rider": mean += h.lastToPar < 0 ? -0.04 : h.lastToPar > 0 ? 0.04 : 0; break;
      case "playoff-assassin": if (h.playoff) mean -= 0.15; break;
      case "rattled-by-crowds": if (h.tier === "major" || h.tier === "signature") sd *= 1.08; break;
      case "links-lifer": if (course.style === "links") wind *= 0.9; break;
      case "clutch-gene": if (h.round === 4 && hole.number >= 16 && h.shotsBehind !== null && h.shotsBehind <= 3) blowup *= 0.5; break;
      case "houdini": blowup *= 0.6; break;
    }
  }
  return { mean, sd, blowup, wind };
}

/** Yards added to how far he can reach par 5s in two. */
export const traitReachBonus = (p: Player): number => (hasTrait(p, "bombers-licence") ? 15 : 0);

