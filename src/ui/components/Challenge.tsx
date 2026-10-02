import { useEffect } from "react";
import { CHALLENGE_BY_ID, type World } from "../../season";

const KEY = "fm-challenge-best";

/** Best scores per challenge, kept in this browser (a nicety: the game works without it). */
export function bestScores(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function saveBest(id: string, score: number): void {
  try {
    const all = bestScores();
    if ((all[id] ?? -1) < score) localStorage.setItem(KEY, JSON.stringify({ ...all, [id]: score }));
  } catch {
    // storage blocked: no best score kept
  }
}

/** The challenge you're playing: its goal and deadline, or how it ended. */
export function ChallengeBanner({ world }: { world: World }) {
  const c = world.challenge;
  const def = c ? CHALLENGE_BY_ID.get(c.id) : undefined;
  const status = c?.status;
  const score = c?.score;
  const id = c?.id;
  useEffect(() => {
    if (id && status === "won" && score !== undefined) saveBest(id, score);
  }, [id, status, score]);
  if (!c || !def) return null;
  const left = c.deadline - world.season;
  return (
    <section className={`panel challenge challenge-${c.status}`}>
      <div className="panel-head">
        <h2>Challenge: {def.title}</h2>
        <span className="small">
          {c.status === "active"
            ? `By the end of season ${c.deadline}${left > 0 ? ` (${left} more after this one)` : " (this season)"}`
            : c.status === "won"
              ? `Won in season ${c.endedSeason} · score ${c.score}`
              : `Lost in season ${c.endedSeason}`}
        </span>
      </div>
      <p style={{ margin: 0 }}>{def.goal}</p>
      {c.status !== "active" && (
        <p className="muted small" style={{ marginBottom: 0 }}>{c.status === "won" ? "Well played. The career carries on as long as you like." : "It didn't come off this time, but the career carries on."}</p>
      )}
    </section>
  );
}
