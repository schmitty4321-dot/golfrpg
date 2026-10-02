import { MAX_PROMISES, PROMISES, PROMISE_BY_KIND, promiseState, teamOf, trustOf, type PromiseKind, type World, type WorldPlayer } from "../../season";

/** Promise checkboxes for an offer or an extension (at most two). */
export function PromisePicker({ wp, value, onChange }: { wp: WorldPlayer; value: PromiseKind[]; onChange: (v: PromiseKind[]) => void }) {
  const allowed = PROMISES.filter((p) => p.kind !== "ryderCup" || teamOf(wp) !== null);
  const toggle = (k: PromiseKind) => onChange(value.includes(k) ? value.filter((x) => x !== k) : value.length >= MAX_PROMISES ? value : [...value, k]);
  return (
    <fieldset className="promise-picker">
      <legend className="small secondary">Promises (up to {MAX_PROMISES}): each makes a yes more likely, and each is checked</legend>
      {allowed.map((p) => (
        <label key={p.kind} className="small" title={p.detail}>
          <input type="checkbox" checked={value.includes(p.kind)} disabled={!value.includes(p.kind) && value.length >= MAX_PROMISES} onChange={() => toggle(p.kind)} /> {p.label}
        </label>
      ))}
    </fieldset>
  );
}

const TONE = { good: "good-text", warn: "warn-text", bad: "bad-text", neutral: "muted" } as const;

/** His trust in you and what you've promised him. */
export function PromisesPanel({ world, wp }: { world: World; wp: WorldPlayer }) {
  const trust = Math.round(trustOf(wp));
  const list = [...(wp.client?.promises ?? [])].reverse();
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Trust and promises</h2>
        <span className="small">Trust in you: <strong>{trust}</strong>/100</span>
      </div>
      <div className="tier-bar" style={{ width: "100%", height: 8 }}><span style={{ width: `${trust}%` }} /></div>
      {list.length === 0 ? (
        <p className="empty">You haven't promised him anything. Promises go with a contract offer or an extension.</p>
      ) : (
        <ul className="news">
          {list.map((p) => {
            const s = promiseState(world, wp, p);
            return (
              <li key={p.id}>
                <strong>{PROMISE_BY_KIND.get(p.kind)?.label}</strong> <span className="muted small">(season {p.season})</span> · <span className={TONE[s.tone]}>{s.word}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>A kept promise adds 8 trust; a broken one costs 20 and his mood, and your other clients hear about it. Trust helps extensions and keeps rivals away.</p>
    </section>
  );
}
