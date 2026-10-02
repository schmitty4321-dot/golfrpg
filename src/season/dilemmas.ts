/**
 * Weekly dilemmas: the things that land on an agent's desk. Each template
 * checks whether it fits a client this week (an injury, a trait, a slump,
 * a coach worth poaching) and, if it does, offers two or three choices with
 * their trade-offs spelled out. Every template cools down so the same story
 * doesn't come round too often.
 */
import { homeRegion, type Rng } from "../engine";
import { addDecision, lastFired, type Choice } from "./inbox";
import { rankMap } from "./points";
import { has } from "./traits";
import { absWeek, type CoachRole, type EventRecord, type TourEvent, type World, type WorldPlayer } from "./types";

export interface DilemmaContext {
  world: World;
  wp: WorldPlayer;
  /** His result in the week just played, if he played. */
  record: EventRecord | null;
  /** Main-tour events in the coming week, and in the coming two. */
  next: TourEvent[];
  soon: TourEvent[];
  rank: number;
  rng: Rng;
}

interface Template {
  key: string;
  big?: boolean;
  /** Weeks before it can come round again for the same client. */
  cooldown: number;
  /** Chance it fires when it fits. */
  chance: number;
  fits: (c: DilemmaContext) => boolean;
  title: (c: DilemmaContext) => string;
  text: (c: DilemmaContext) => string;
  choices: (c: DilemmaContext) => Choice[];
  defaultChoice: string;
}

const k = (n: number) => Math.round(n / 1000) * 1000;
const name = (c: DilemmaContext) => c.wp.player.name;
const first = (c: DilemmaContext) => c.wp.player.name.split(" ")[0]!;
const bigEvent = (c: DilemmaContext) => c.soon.find((e) => e.tier === "major" || e.tier === "signature");

function bestCoach(c: DilemmaContext): { role: CoachRole; name: string; quality: number; fee: number } | null {
  let best: { role: CoachRole; name: string; quality: number; fee: number } | null = null;
  for (const [role, id] of Object.entries(c.wp.client!.staff) as [CoachRole, string][]) {
    const coach = c.world.coaches.find((x) => x.id === id);
    if (coach && coach.quality >= 13 && (!best || coach.quality > best.quality)) best = { role, name: coach.name, quality: coach.quality, fee: coach.weeklyFee };
  }
  return best;
}

const TEMPLATES: Template[] = [
  {
    key: "rush-back",
    big: true,
    cooldown: 10,
    chance: 0.6,
    fits: (c) => !!c.wp.injury && c.wp.injury.weeksLeft >= 1 && c.wp.injury.weeksLeft <= 4 && !!bigEvent(c),
    title: (c) => `${name(c)} wants to play hurt`,
    text: (c) => `His ${c.wp.injury!.name.toLowerCase()} needs ${c.wp.injury!.weeksLeft} more week${c.wp.injury!.weeksLeft === 1 ? "" : "s"}, but ${bigEvent(c)!.name} is coming up and he wants to be there.`,
    choices: (c) => [
      {
        id: "rush",
        label: "Clear him to play",
        detail: "He plays now; about a one-in-three chance it flares up for longer.",
        effects: [
          { k: "heal" },
          { k: "mood", v: 4 },
          { k: "chance", p: 0.35, then: [{ k: "injure", v: 4 + c.rng.int(0, 4), name: c.wp.injury!.name }, { k: "form", v: -0.1 }], else: [], thenNews: "The injury flares up again.", elseNews: "He comes through it fine." },
        ],
      },
      { id: "heal", label: "Make him wait", detail: "He's annoyed but healthy.", effects: [{ k: "mood", v: -3 }] },
    ],
    defaultChoice: "heal",
  },
  {
    key: "coach-poached",
    big: true,
    cooldown: 26,
    chance: 0.05,
    fits: (c) => bestCoach(c) !== null,
    title: (c) => `Another player wants ${name(c)}'s coach`,
    text: (c) => {
      const b = bestCoach(c)!;
      return `${b.name}, his ${b.role === "shortGame" ? "short-game" : b.role} coach (quality ${b.quality}), has an offer to work with another tour player full time.`;
    },
    choices: (c) => {
      const b = bestCoach(c)!;
      return [
        { id: "match", label: "Match the offer", detail: "Pay a retention bonus; everyone stays happy.", effects: [{ k: "agencyCost", v: k(b.fee * 8) }, { k: "mood", v: 2 }] },
        {
          id: "counter",
          label: "Counter with a smaller bonus",
          detail: "Cheaper, but the coach may still go.",
          effects: [{ k: "agencyCost", v: k(b.fee * 3) }, { k: "chance", p: 0.5, then: [], else: [{ k: "releaseCoach", role: b.role }, { k: "mood", v: -3 }], thenNews: "The coach stays.", elseNews: "The coach takes the other job." }],
        },
        { id: "release", label: "Let the coach go", detail: "No cost, but he loses a good coach.", effects: [{ k: "releaseCoach", role: b.role }, { k: "mood", v: -4 }] },
      ];
    },
    defaultChoice: "release",
  },
  {
    key: "pro-am",
    cooldown: 12,
    chance: 0.5,
    fits: (c) => c.wp.client!.sponsors.length > 0 && c.soon.some((e) => e.tier === "major"),
    title: (c) => `A sponsor wants ${name(c)} at a pro-am`,
    text: (c) => `${c.wp.client!.sponsors[0]!.sponsor} would like him at a corporate day just before ${c.soon.find((e) => e.tier === "major")!.name}.`,
    choices: (c) => [
      { id: "go", label: "He goes", detail: "Good money; a tiring week before a major.", effects: [{ k: "clientMoney", v: k(30_000 + c.wp.client!.sponsors[0]!.annualValue * 0.08) }, { k: "condition", v: -8 }, { k: "buzz", v: 0.04 }] },
      { id: "decline", label: "Politely decline", detail: "The sponsor cools on him a little.", effects: [{ k: "buzz", v: -0.03 }] },
    ],
    defaultChoice: "decline",
  },
  {
    key: "homesick",
    cooldown: 10,
    chance: 0.35,
    fits: (c) => has(c.wp, "homesick") && c.wp.career.lastRegion !== null && c.wp.career.lastRegion !== homeRegion(c.wp.player.nationality),
    title: (c) => `${name(c)} misses home`,
    text: (c) => `Weeks on the road are getting to ${first(c)}. He'd like to fly home for a week.`,
    choices: () => [
      { id: "home", label: "Fly him home for a week", detail: "Happier and fresher; one week fewer on tour.", effects: [{ k: "rest", v: 1 }, { k: "mood", v: 6 }, { k: "condition", v: 10 }, { k: "agencyCost", v: 6000 }] },
      { id: "stay", label: "Ask him to stick it out", detail: "He keeps playing, unhappily.", effects: [{ k: "mood", v: -5 }] },
    ],
    defaultChoice: "stay",
  },
  {
    key: "new-baby",
    cooldown: 150,
    chance: 0.0015,
    fits: (c) => c.wp.player.age >= 26 && c.wp.player.age <= 40,
    title: (c) => `${name(c)} is going to be a dad`,
    text: (c) => `The baby is due any day. ${first(c)} is torn about the next couple of weeks.`,
    choices: () => [
      { id: "leave", label: "Two weeks off", detail: "Family first: he's happier, and fans love it.", effects: [{ k: "rest", v: 2 }, { k: "mood", v: 8 }, { k: "followers", v: 0.02 }] },
      { id: "play", label: "Keep playing", detail: "No starts missed, but his mind is elsewhere.", effects: [{ k: "mood", v: -6 }, { k: "form", v: -0.05 }] },
    ],
    defaultChoice: "leave",
  },
  {
    key: "equipment-deal",
    cooldown: 40,
    chance: 0.03,
    fits: (c) => c.rank <= 150,
    title: (c) => `An equipment deal for ${name(c)}`,
    text: () => "A manufacturer offers a full-bag deal, but he'd have to change his driver and irons mid-season.",
    choices: (c) => {
      const fee = k(c.rank <= 20 ? 600_000 : c.rank <= 60 ? 300_000 : 120_000);
      return [
        { id: "switch", label: "Take the deal", detail: "Big money; a few weeks getting used to new clubs.", effects: [{ k: "clientMoney", v: fee }, { k: "form", v: -0.12 }] },
        { id: "stay", label: "Stay with his clubs", detail: "No money, no disruption.", effects: [] },
      ];
    },
    defaultChoice: "stay",
  },
  {
    key: "hothead",
    cooldown: 8,
    chance: 0.6,
    fits: (c) => has(c.wp, "hothead") && !!c.record && !c.record.madeCut,
    title: (c) => `${name(c)} loses his temper`,
    text: (c) => `After missing the cut at ${c.record!.eventName}, ${first(c)} snapped a club and swore at a marshal. It's on video.`,
    choices: () => [
      { id: "talk", label: "Fine him and talk it through", detail: "He sulks, then settles.", effects: [{ k: "mood", v: -3 }, { k: "form", v: 0.05 }] },
      {
        id: "ignore",
        label: "Let it blow over",
        detail: "It might go viral.",
        effects: [{ k: "chance", p: 0.3, then: [{ k: "buzz", v: -0.08 }, { k: "reputation", v: -1 }], else: [{ k: "followers", v: 0.01 }], thenNews: "The clip goes viral; sponsors aren't happy.", elseNews: "It blows over." }],
      },
    ],
    defaultChoice: "ignore",
  },
  {
    key: "diva",
    cooldown: 16,
    chance: 0.08,
    fits: (c) => has(c.wp, "diva"),
    title: (c) => `${name(c)} has demands`,
    text: (c) => `${first(c)} wants first-class travel and a suite at every event this month, paid by the agency.`,
    choices: () => [
      { id: "grant", label: "Give him what he wants", detail: "Expensive, but he's happy.", effects: [{ k: "agencyCost", v: 25_000 }, { k: "mood", v: 6 }] },
      { id: "refuse", label: "Say no", detail: "He won't like it.", effects: [{ k: "mood", v: -7 }] },
    ],
    defaultChoice: "refuse",
  },
  {
    key: "more-starts",
    cooldown: 20,
    chance: 0.06,
    fits: (c) => has(c.wp, "money-motivated") || c.wp.player.attributes.ambition >= 15,
    title: (c) => `${name(c)} wants to play more`,
    text: (c) => `${first(c)} wants three more starts this season to chase money and points.`,
    choices: () => [
      { id: "agree", label: "Agree to a heavier schedule", detail: "He's happier; he'll tire more.", effects: [{ k: "targetEvents", v: 3 }, { k: "mood", v: 5 }] },
      { id: "refuse", label: "Stick to the plan", detail: "He's disappointed.", effects: [{ k: "mood", v: -3 }] },
    ],
    defaultChoice: "refuse",
  },
  {
    key: "tv-interview",
    cooldown: 6,
    chance: 0.5,
    fits: (c) => !!c.record && c.record.madeCut && c.record.position <= 10 && c.record.tier !== "dev",
    title: (c) => `TV wants ${name(c)}`,
    text: (c) => `After his ${c.record!.label} at ${c.record!.eventName}, a network wants a sit-down interview.`,
    choices: () => [
      { id: "do", label: "Do the interview", detail: "More fans and sponsor interest; a little tiring.", effects: [{ k: "followers", v: 0.03 }, { k: "buzz", v: 0.04 }, { k: "condition", v: -3 }] },
      { id: "skip", label: "Not this week", detail: "Nothing changes.", effects: [] },
    ],
    defaultChoice: "skip",
  },
  {
    key: "slump",
    big: true,
    cooldown: 10,
    chance: 0.35,
    fits: (c) => c.wp.player.form < -0.45,
    title: (c) => `${name(c)} is in a slump`,
    text: (c) => `${first(c)} has lost his confidence. How do you want to handle it?`,
    choices: () => [
      { id: "psych", label: "Book a sports psychologist", detail: "Costs money; a real lift.", effects: [{ k: "agencyCost", v: 15_000 }, { k: "form", v: 0.2 }] },
      { id: "range", label: "A week on the range", detail: "Skips a week; a smaller lift.", effects: [{ k: "rest", v: 1 }, { k: "form", v: 0.12 }] },
      { id: "ride", label: "Ride it out", detail: "Nothing changes.", effects: [] },
    ],
    defaultChoice: "ride",
  },
  {
    key: "contract-wobble",
    big: true,
    cooldown: 12,
    chance: 0.4,
    fits: (c) => c.wp.client!.happiness < 45 && c.wp.client!.contract.untilSeason === c.world.season,
    title: (c) => `${name(c)} is thinking about his future`,
    text: (c) => `His contract ends this season and ${first(c)} isn't sure he wants to stay.`,
    choices: () => [
      { id: "lunch", label: "Take him to lunch and listen", detail: "A small cost; he feels heard.", effects: [{ k: "agencyCost", v: 5000 }, { k: "mood", v: 7 }, { k: "trust", v: 3 }] },
      { id: "remind", label: "Remind him what you've done for him", detail: "It may come across badly.", effects: [{ k: "mood", v: -3 }] },
      { id: "wait", label: "Leave it for now", detail: "Nothing changes.", effects: [] },
    ],
    defaultChoice: "wait",
  },
  {
    key: "charity-day",
    cooldown: 20,
    chance: 0.35,
    fits: (c) => !!c.record && c.record.madeCut && c.record.position <= 5 && c.record.tier !== "dev",
    title: (c) => `${name(c)} could host a charity day`,
    text: () => "A children's charity asks him to host a clinic and pro-am.",
    choices: () => [
      { id: "host", label: "Host it", detail: "Good for his name and yours; a tiring day.", effects: [{ k: "followers", v: 0.04 }, { k: "reputation", v: 1 }, { k: "condition", v: -5 }, { k: "agencyCost", v: 10_000 }] },
      { id: "no", label: "Not this year", detail: "Nothing changes.", effects: [] },
    ],
    defaultChoice: "no",
  },
  {
    key: "rival-sniffing",
    cooldown: 16,
    chance: 0.08,
    fits: (c) => c.wp.client!.happiness < 55,
    title: (c) => `A rival agency is talking to ${name(c)}`,
    text: (c) => `Word is a rival agency has been in touch with ${first(c)}.`,
    choices: () => [
      { id: "public", label: "Call them out publicly", detail: "He likes that you fight for him.", effects: [{ k: "mood", v: 3 }, { k: "followers", v: 0.01 }] },
      { id: "quiet", label: "Have a quiet word with him", detail: "Reassuring.", effects: [{ k: "mood", v: 2 }, { k: "trust", v: 2 }] },
      { id: "ignore", label: "Ignore it", detail: "He notices.", effects: [{ k: "mood", v: -2 }] },
    ],
    defaultChoice: "quiet",
  },
  {
    key: "major-prep",
    cooldown: 8,
    chance: 0.5,
    fits: (c) => c.next.some((e) => e.tier === "major") && c.wp.career.status !== "amateur" && !c.wp.injury,
    title: (c) => `${name(c)} could get to ${c.next.find((e) => e.tier === "major")!.name} early`,
    text: () => "Arriving a few days early means extra practice rounds, at some cost to his energy.",
    choices: (c) => {
      const major = c.next.find((e) => e.tier === "major")!;
      return [
        { id: "early", label: "Fly in early", detail: "Knows the course better; a little tired.", effects: [{ k: "practiceAt", courseId: major.courseId }, { k: "condition", v: -5 }, { k: "agencyCost", v: 4000 }] },
        { id: "normal", label: "Usual schedule", detail: "Nothing changes.", effects: [] },
      ];
    },
    defaultChoice: "normal",
  },
  {
    key: "autographs",
    cooldown: 6,
    chance: 0.06,
    fits: (c) => c.wp.career.status !== "amateur",
    title: (c) => `Fans want ${name(c)} after his round`,
    text: () => "The tournament asks if he'll do an autograph session for kids after Friday's round.",
    choices: () => [
      { id: "sign", label: "Sign for an hour", detail: "Fans love it; a little tiring.", effects: [{ k: "followers", v: 0.01 }, { k: "condition", v: -2 }, { k: "mood", v: 1 }] },
      { id: "skip", label: "Not this week", detail: "Nothing changes.", effects: [] },
    ],
    defaultChoice: "skip",
  },
  {
    key: "mentoring",
    cooldown: 20,
    chance: 0.06,
    fits: (c) => c.wp.player.age <= 25 && veteranClient(c) !== null,
    title: (c) => `${veteranClient(c)!.player.name} could take ${name(c)} under his wing`,
    text: (c) => `Your veteran offers to play practice rounds with ${first(c)} and talk him through life on tour.`,
    choices: (c) => [
      { id: "pair", label: "Pair them up", detail: "The youngster learns; the veteran enjoys it.", effects: [{ k: "form", v: 0.05 }, { k: "mood", v: 3 }, { k: "practiceAt", courseId: c.next[0]?.courseId ?? "" }] },
      { id: "no", label: "Not now", detail: "Nothing changes.", effects: [] },
    ],
    defaultChoice: "no",
  },
];

/** Another client of yours, 34 or older, for mentoring. */
function veteranClient(c: DilemmaContext): WorldPlayer | null {
  for (const id of c.world.clientIds) {
    const o = c.world.players[id];
    if (o && id !== c.wp.player.id && o.player.age >= 34) return o;
  }
  return null;
}

/** Every template's key (for tests). */
export const DILEMMA_KEYS = TEMPLATES.map((t) => t.key);

/**
 * The coming week's dilemmas, at most `room` of them and one per client.
 * Run after the week's results, with `world.week` already the coming week.
 */
export function weeklyDilemmas(world: World, records: Map<string, EventRecord | null>, rng: Rng, room: number, only?: string[]): number {
  if (room <= 0) return 0;
  const ranks = rankMap(world);
  const next = world.schedule.filter((e) => e.week === world.week && e.tier !== "dev");
  const soon = world.schedule.filter((e) => (e.week === world.week || e.week === world.week + 1) && e.tier !== "dev");
  const now = absWeek(world.season, world.week);
  let added = 0;
  for (const id of world.clientIds) {
    const wp = world.players[id];
    if (!wp?.client) continue;
    const c: DilemmaContext = { world, wp, record: records.get(id) ?? null, next, soon, rank: ranks.get(id) ?? 999, rng };
    for (const t of TEMPLATES) {
      if (only && !only.includes(t.key)) continue;
      if (added >= room) return added;
      const last = lastFired(world, t.key, id);
      if (last !== null && now - last < t.cooldown) continue;
      if (!t.fits(c) || !rng.chance(t.chance)) continue;
      addDecision(world, { kind: "dilemma", key: t.key, clientId: id, title: t.title(c), text: t.text(c), choices: t.choices(c), defaultChoice: t.defaultChoice, big: !!t.big });
      added++;
      break;
    }
  }
  return added;
}
