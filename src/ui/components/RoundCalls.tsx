import { answerRoundCall, describeRoundChoice, roundCallsFor, type LiveEvent, type World } from "../../season";
import type { Game } from "../useGame";

/**
 * Between rounds: a quick call for each client whose day gave you something
 * to decide. Leaving a call alone takes its first choice, which does nothing.
 */
export function RoundCalls({ world, game, events }: { world: World; game: Game; events: LiveEvent[] }) {
  const calls = events.flatMap((ev) => roundCallsFor(world, ev).map((call) => ({ ev, call })));
  if (!calls.length) return null;
  return (
    <section className="panel round-calls">
      <div className="panel-head">
        <h2>Tonight's calls</h2>
        <span className="muted small">Leave one alone and nothing changes</span>
      </div>
      <div className="round-call-list">
        {calls.map(({ ev, call }) => {
          const answer = ev.answers?.[call.id];
          return (
            <article key={call.id} className="round-call">
              <strong>{call.title}</strong>
              <p className="secondary small" style={{ margin: "2px 0 8px" }}>{call.text}</p>
              {answer ? (
                <p className="small" style={{ margin: 0 }}>
                  <strong>{answer.label}.</strong> {answer.line}
                </p>
              ) : (
                <div className="round-call-choices">
                  {call.choices.map((c) => (
                    <button key={c.id} className="choice" title={c.detail} onClick={() => game.liveAct(() => void answerRoundCall(world, ev, call, c.id))}>
                      <strong>{c.label}</strong>
                      <span className="small muted">{c.detail}</span>
                      {describeRoundChoice(c) && <span className="small secondary">{describeRoundChoice(c)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
