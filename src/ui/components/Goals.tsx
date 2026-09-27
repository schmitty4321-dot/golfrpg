import { GOALS_TO_AGREE, goalProgress, goalsLocked, type World } from "../../season";
import type { Game } from "../useGame";

const STARS = ["", "★", "★★", "★★★"];

/** Season goals for every client: pick two from four before week 4, then track them. */
export function GoalsPanel({ world, game }: { world: World; game: Game }) {
  if (world.clientIds.length === 0) return null;
  const locked = goalsLocked(world);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Season goals</h2>
        <span className="muted small">
          {locked ? "Agreed for the season. Met goals lift his mood and your reputation; missed ones sting." : `Agree ${GOALS_TO_AGREE} per client before week 4, or they'll be picked for you (the easiest).`}
        </span>
      </div>
      <div className="goals">
        {world.clientIds.map((id) => {
          const wp = world.players[id]!;
          const c = wp.client!;
          const agreed = c.goals ?? [];
          const list = locked ? agreed : (c.goalOffers ?? []);
          return (
            <div key={id} className="goal-client">
              <strong>{wp.player.name}</strong>
              <div className="goal-list">
                {list.map((g) => {
                  const on = agreed.some((x) => x.id === g.id);
                  const p = goalProgress(world, wp, g);
                  return (
                    <button
                      key={g.id}
                      className={`goal${on ? " on" : ""}${p.met ? " met" : ""}`}
                      disabled={locked || (!on && agreed.length >= GOALS_TO_AGREE)}
                      aria-pressed={on}
                      onClick={() => game.act((w) => game.lib.toggleGoal(w, id, g.id))}
                    >
                      <span className="goal-label">{g.label}</span>
                      <span className="goal-meta small">
                        <span className="goal-stars" title="Difficulty">{STARS[g.difficulty]}</span> {p.met ? "✓ Met" : p.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
