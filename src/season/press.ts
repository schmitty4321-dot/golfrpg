/**
 * Press conferences: after a win, a big week at a major, a missed cut as one
 * of the favourites, or the Ryder Cup, the media want a word. Humble answers
 * are safe; bold ones win fans and sponsors but come back to bite if his
 * next start goes badly; deflecting changes nothing. Hotheads get a fourth,
 * fiery option. Media Darlings get more out of every answer, and the
 * Scandal-Prone risk more.
 */
import { addDecision, type Choice, type Effect } from "./inbox";
import { rankMap } from "./points";
import { has } from "./traits";
import { absWeek, type EventRecord, type World, type WorldPlayer } from "./types";

type Occasion = "win" | "majorTop5" | "favouriteMissed" | "ryderCup";

/** Fans and appeal count double for Media Darlings. */
const scale = (wp: WorldPlayer, effects: Effect[]): Effect[] =>
  has(wp, "media-darling") ? effects.map((e) => (e.k === "followers" || e.k === "buzz" ? { ...e, v: e.v * 2 } : e)) : effects;

const QUOTES: Record<Occasion, { humble: string; bold: string; deflect: string; fiery: string }> = {
  win: {
    humble: `"I'm just grateful. A lot of people helped get me here."`,
    bold: `"This is the first of many. I'm the best player out here right now."`,
    deflect: `"I'll enjoy it tonight and get back to work Monday."`,
    fiery: `"Everyone who wrote me off can read about this one."`,
  },
  majorTop5: {
    humble: `"Close. I'll learn from it and come back stronger."`,
    bold: `"I'm going to win one of these. Soon."`,
    deflect: `"Good week. On to the next."`,
    fiery: `"Honestly, that setup cost me the tournament."`,
  },
  favouriteMissed: {
    humble: `"I didn't play well enough. That's on me."`,
    bold: `"Bad week. I'll win the next one, watch."`,
    deflect: `"Golf's like that sometimes. I'll be fine."`,
    fiery: `"The course was a joke and you can quote me on that."`,
  },
  ryderCup: {
    humble: `"It was an honour to play for my team."`,
    bold: `"Two years from now, we're taking that cup."`,
    deflect: `"Great week. Now I'm going to sleep for a while."`,
    fiery: `"Some of those crowds crossed the line, and I'll say it."`,
  },
};

function pressChoices(occasion: Occasion, wp: WorldPlayer): Choice[] {
  const q = QUOTES[occasion];
  const scandal = has(wp, "scandal-prone") ? 0.15 : 0;
  const good = occasion !== "favouriteMissed";
  const choices: Choice[] = [
    {
      id: "humble",
      label: "Humble",
      detail: q.humble,
      effects: scale(wp, good ? [{ k: "followers", v: occasion === "win" ? 0.02 : 0.015 }, { k: "mood", v: 2 }] : [{ k: "buzz", v: 0.02 }, { k: "form", v: 0.03 }, { k: "mood", v: -1 }]),
    },
    {
      id: "bold",
      label: "Bold",
      detail: q.bold,
      effects: [
        ...scale(wp, [{ k: "followers", v: occasion === "win" ? 0.05 : 0.03 }, { k: "buzz", v: occasion === "win" ? 0.08 : 0.05 }]),
        { k: "boldClaim" },
        // The Scandal-Prone can turn even a bold line into a story.
        ...(scandal ? [{ k: "chance", p: scandal, then: [{ k: "buzz", v: -0.06 }], else: [], thenNews: "A tabloid twists his words.", elseNews: "" } as Effect] : []),
      ],
    },
    { id: "deflect", label: "Deflect", detail: q.deflect, effects: [] },
  ];
  if (has(wp, "hothead")) {
    choices.push({
      id: "fiery",
      label: "Fiery",
      detail: q.fiery,
      effects: [
        ...scale(wp, [{ k: "followers", v: 0.07 }]),
        { k: "chance", p: 0.35 + scandal, then: [{ k: "buzz", v: -0.06 }, { k: "mood", v: -2 }], else: [{ k: "buzz", v: 0.03 }], thenNews: "The tour isn't amused, and neither are his sponsors.", elseNews: "The clip does big numbers online." },
      ],
    });
  }
  return choices;
}

const TITLES: Record<Occasion, (name: string, event: string) => string> = {
  win: (n, e) => `${n} faces the press after winning ${e}`,
  majorTop5: (n, e) => `${n} speaks after his week at ${e}`,
  favouriteMissed: (n, e) => `${n} is asked about his missed cut at ${e}`,
  ryderCup: (n) => `${n} speaks after the Ryder Cup`,
};

/** Press conferences for your clients after the week just played: at most one each. */
export function weeklyPress(world: World, records: Map<string, EventRecord | null>, ryderCupIds: Set<string>): number {
  const ranks = rankMap(world);
  let added = 0;
  for (const id of world.clientIds) {
    const wp = world.players[id];
    if (!wp?.client) continue;
    const r = records.get(id) ?? null;
    let occasion: Occasion | null = null;
    let event = "";
    if (ryderCupIds.has(id)) {
      occasion = "ryderCup";
      event = "the Ryder Cup";
    } else if (r && r.tier !== "dev") {
      event = r.eventName;
      if (r.position === 1 && r.madeCut) occasion = "win";
      else if (r.tier === "major" && r.madeCut && r.position <= 5) occasion = "majorTop5";
      else if (!r.madeCut && (ranks.get(id) ?? 999) <= 20) occasion = "favouriteMissed";
    }
    if (!occasion) continue;
    addDecision(world, {
      kind: "press",
      key: `press-${occasion}`,
      clientId: id,
      title: TITLES[occasion](wp.player.name, event),
      text: "Pick his line. Bold answers win fans and sponsors, but he'll hear about it if his next start goes badly.",
      choices: pressChoices(occasion, wp),
      defaultChoice: "deflect",
      big: false,
    });
    added++;
  }
  return added;
}

/**
 * A bold claim, checked against his next start: a missed cut or a finish
 * outside the top 20 and he eats his words. Returns the news line, if any.
 */
export function settleBoldClaim(wp: WorldPlayer, record: EventRecord | null, holdsWithin = 20, damage = 1): string | null {
  const m = wp.client;
  if (!m || m.boldClaim === undefined || !record || record.tier === "dev") return null;
  // Only a start after the claim counts.
  if (absWeek(record.season, record.week) < m.boldClaim) return null;
  delete m.boldClaim;
  if (record.madeCut && record.position <= holdsWithin) return null;
  m.followers = Math.round((m.followers ?? 0) * (1 - 0.02 * damage));
  m.buzz = Math.max(-0.3, (m.buzz ?? 0) - 0.05 * damage);
  wp.player.form = Math.max(-1, wp.player.form - 0.1);
  return `${wp.player.name} eats his words: ${record.madeCut ? `only ${record.label}` : "a missed cut"} at ${record.eventName} after all that talk.`;
}
