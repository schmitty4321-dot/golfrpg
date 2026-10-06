import type { LiveTournament, RoundPlan, TickerItem } from "../../engine";
import type { World } from "../../season";
import type { Game, WeekTempo } from "../useGame";

export const TEMPO_LABELS: Record<WeekTempo, { label: string; blurb: string }> = {
  broadcast: { label: "Broadcast", blurb: "Watch the leaderboard. Quiet rounds sim to a recap; it goes live for Friday's cut line and for Sunday when a client is in the top 10, and you get 3 calls a round to spend." },
  quick: { label: "Quick", blurb: "Sim the week straight to the results; your clients play their round plans." },
  moments: { label: "Key moments", blurb: "Sim every round, stopping only for the calls that matter: the cut line on Friday, contention on the weekend, a playoff." },
  follow: { label: "Follow one", blurb: "Walk one client hole by hole; your others play alongside on their round plans." },
};

export const PLAN_LABELS: Record<RoundPlan, { label: string; blurb: string }> = {
  attack: { label: "Attack", blurb: "Driver, par 5s in two, flags and charged putts: more birdies, more big numbers." },
  steady: { label: "Steady", blurb: "Leaves every call to him." },
  protect: { label: "Protect", blurb: "3-woods, lay-ups, middle of the green and lagged putts: fewer mistakes, fewer birdies." },
};

/** How a client plays the calls you don't make at his event this week. */
export function RoundPlanPicker({ plan, onPick }: { plan: RoundPlan; onPick: (p: RoundPlan) => void }) {
  return (
    <div className="round-plan">
      <span className="secondary small">Round plan</span>
      <div className="tabs" role="radiogroup" aria-label="Round plan">
        {(Object.keys(PLAN_LABELS) as RoundPlan[]).map((p) => (
          <button key={p} role="radio" aria-checked={plan === p} aria-selected={plan === p} title={PLAN_LABELS[p].blurb} onClick={() => onPick(p)}>
            {PLAN_LABELS[p].label}
          </button>
        ))}
      </div>
      <span className="muted small">{PLAN_LABELS[plan].blurb}</span>
    </div>
  );
}

/** Sets a client's round plan for this event and as his standing plan. */
export function setRoundPlan(game: Game, t: LiveTournament, id: string, plan: RoundPlan) {
  game.liveAct(() => (t.plans[id] = plan));
  game.act((w) => {
    const c = w.players[id]?.client;
    if (c) c.roundPlan = plan;
  });
}

/** "Winslow birdies 12" for your other clients' notable holes. */
export function tickerLine(world: World, item: TickerItem): string | null {
  const diff = item.score - item.par;
  const word = diff <= -2 ? "eagles" : diff === -1 ? "birdies" : diff === 2 ? "double-bogeys" : diff >= 3 ? `makes ${item.score} on` : null;
  if (!word) return null;
  const name = world.players[item.id]?.player.name.split(" ").pop() ?? "?";
  return `${name} ${word} ${item.index + 1}`;
}

