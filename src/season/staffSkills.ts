/**
 * What makes one agency staffer different from another of the same rating:
 * one to three skills (more for the better ones), and one more after three
 * seasons with you. Skills are fixed by who the person is (their id), so a
 * candidate shows them before you hire.
 */
import { createRng } from "../engine";
import { mixSeed } from "./entries";
import { hiredStaffer, staffContract } from "./market";
import type { AgencyStaffer, StaffRole, World } from "./types";

export interface StaffSkill {
  role: StaffRole;
  label: string;
  blurb: string;
}

export const STAFF_SKILLS: Record<string, StaffSkill> = {
  // Agent
  closer: { role: "agent", label: "Closer", blurb: "Players are likelier to say yes to a first offer." },
  "amateur-whisperer": { role: "agent", label: "Amateur whisperer", blurb: "Better odds with amateurs and players without status." },
  poacher: { role: "agent", label: "Poacher", blurb: "Better odds signing a player who's with a rival agency." },
  retention: { role: "agent", label: "Retention specialist", blurb: "Clients' happiness recovers each winter." },
  "hard-bargainer": { role: "agent", label: "Hard bargainer", blurb: "Players accept half a point more commission than their going rate." },
  "bidding-war": { role: "agent", label: "Bidding-war veteran", blurb: "Rival bids for the same player count for less." },
  international: { role: "agent", label: "International network", blurb: "Better odds with players from outside the US." },
  "promise-keeper": { role: "agent", label: "Promise keeper", blurb: "A broken promise costs half the trust." },
  "rival-diplomat": { role: "agent", label: "Rival diplomat", blurb: "Bad blood with rival agents fades faster." },
  "dev-tour-scout": { role: "agent", label: "Dev-tour scout", blurb: "Better odds with developmental tour players." },
  // Analyst
  "ceiling-reader": { role: "analyst", label: "Ceiling reader", blurb: "Reads clients' ceilings as clearly as a much better coach." },
  "peak-predictor": { role: "analyst", label: "Peak predictor", blurb: "Narrows the peak-age range by a year." },
  "hidden-gem": { role: "analyst", label: "Hidden-gem spotter", blurb: "Clients are likelier to bloom late." },
  "bust-detector": { role: "analyst", label: "Bust detector", blurb: "A client's ceiling falls only half as far." },
  "stats-guru": { role: "analyst", label: "Stats guru", blurb: "Clients develop a little faster." },
  "course-fit": { role: "analyst", label: "Course fit", blurb: "Clients learn courses half as fast again." },
  "injury-watch": { role: "analyst", label: "Injury watch", blurb: "Clients get hurt less often." },
  "rebuild-planner": { role: "analyst", label: "Rebuild planner", blurb: "Swing, short-game and putting rebuilds work more often." },
  "scouting-reports": { role: "analyst", label: "Scouting reports", blurb: "Scouts cost half as much." },
  "projection-modeller": { role: "analyst", label: "Projection modeller", blurb: "A narrower growth projection on the development chart." },
  // Marketing lead
  "brand-builder": { role: "marketing", label: "Brand builder", blurb: "Sponsor offers about 15% bigger." },
  "deal-flow": { role: "marketing", label: "Deal flow", blurb: "Sponsors make offers more often." },
  "never-lapse": { role: "marketing", label: "Never-lapse", blurb: "Sponsor offers stay open three weeks longer." },
  "category-expert": { role: "marketing", label: "Category expert", blurb: "Equipment and apparel deals are worth 25% more." },
  "social-buzz": { role: "marketing", label: "Social buzz", blurb: "Clients' followers grow faster after good finishes." },
  "media-trainer": { role: "marketing", label: "Media trainer", blurb: "Bold press answers hold up with a top-30 finish, not just top 20." },
  "underdog-seller": { role: "marketing", label: "Underdog seller", blurb: "Clients outside the top 100 get 30% bigger offers." },
  "event-promoter": { role: "marketing", label: "Event promoter", blurb: "Agency events take in 20% more." },
  "crisis-manager": { role: "marketing", label: "Crisis manager", blurb: "Eating his words costs half the fans and buzz." },
  "global-reach": { role: "marketing", label: "Global reach", blurb: "International clients' offers are worth 20% more." },
  // Lawyer
  "renewal-specialist": { role: "lawyer", label: "Renewal specialist", blurb: "Contract extensions go through more often." },
  ironclad: { role: "lawyer", label: "Ironclad clauses", blurb: "Rivals poach your clients far less often." },
  "long-term-locker": { role: "lawyer", label: "Long-term locker", blurb: "Players take three-year deals more readily." },
  "structure-expert": { role: "lawyer", label: "Structure expert", blurb: "Ladder and star commission structures are easier to agree." },
  "bonus-negotiator": { role: "lawyer", label: "Bonus negotiator", blurb: "Signing bonuses cost 25% less, and clients' win bonuses pay 25% more." },
  "retainer-writer": { role: "lawyer", label: "Retainer writer", blurb: "Players agree to retainers more readily." },
  "exit-negotiator": { role: "lawyer", label: "Exit negotiator", blurb: "Buying out a staff contract costs 40% less." },
  "dispute-settler": { role: "lawyer", label: "Dispute settler", blurb: "Unhappy clients are easier to keep at renewal." },
  "tax-planner": { role: "lawyer", label: "Tax planner", blurb: "Headquarters and scouting costs 5% lower." },
  "investment-counsel": { role: "lawyer", label: "Investment counsel", blurb: "Investments return a point more and sell back for 85%." },
};

const BY_ROLE = (role: StaffRole) => Object.keys(STAFF_SKILLS).filter((k) => STAFF_SKILLS[k]!.role === role);

/** Seasons with you before a staffer learns an extra skill. */
export const LOYAL_SEASONS = 3;

/** How many skills a rating brings: 1 below 10, 2 from 10, 3 from 16. */
export const skillCount = (quality: number): number => (quality >= 16 ? 3 : quality >= 10 ? 2 : 1);

/** A staffer's skills, in the order they're learned (fixed by who they are). */
function skillOrder(world: World, s: AgencyStaffer): string[] {
  const pool = BY_ROLE(s.role);
  let h = 0;
  for (const ch of s.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = createRng(mixSeed(world.seed, h, 3301));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool;
}

/** What a staffer can do: their rating's skills, plus one for three seasons of loyalty (when they're yours). */
export function skillsOf(world: World, s: AgencyStaffer): string[] {
  const contract = staffContract(world, s.role);
  const loyal = !!contract && contract.stafferId === s.id && contract.seasonsServed >= LOYAL_SEASONS;
  return skillOrder(world, s).slice(0, skillCount(s.quality) + (loyal ? 1 : 0));
}

/** Whether the agency's staffer in that skill's role has it. */
export function hasSkill(world: World, skill: string): boolean {
  const role = STAFF_SKILLS[skill]?.role;
  const s = role ? hiredStaffer(world, role) : undefined;
  return !!s && skillsOf(world, s).includes(skill);
}

/** A skill that comes with three seasons of loyalty, for the staff card ("learns X next season"). */
export function loyaltySkill(world: World, s: AgencyStaffer): string | undefined {
  return skillOrder(world, s)[skillCount(s.quality)];
}
