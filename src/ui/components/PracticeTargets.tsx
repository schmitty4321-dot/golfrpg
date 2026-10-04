import { ATTRIBUTE_LABELS, type AttributeKey } from "../../engine";
import { GOLF_SKILLS, MAX_TARGETS, TARGET_SET_WEEKS, setSkillTargets, suggestTargets, targetProgress, targetsBlock, targetsOf, type World } from "../../season";
import type { Game } from "../useGame";

/**
 * Two or three skills he works on above the rest this season, with a bar for
 * each and his coaches' read on the pace. Set in the season's first weeks.
 */
export function PracticeTargets({ world, game, clientId }: { world: World; game: Game; clientId: string }) {
  const wp = world.players[clientId]!;
  const list = targetsOf(world, wp);
  const block = targetsBlock(world, wp);
  const keys = list.map((t) => t.key);
  const set = (next: AttributeKey[]) => game.act((w) => setSkillTargets(w, clientId, next));
  const choose = (i: number, k: string) => {
    const next = [...keys];
    if (k) next[i] = k as AttributeKey;
    else next.splice(i, 1);
    set(next.filter(Boolean));
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Practice targets</h2>
        <span className="muted small">This season · up to {MAX_TARGETS}</span>
      </div>
      {list.length === 0 && (
        <p className="secondary small" style={{ marginTop: 0 }}>
          Pick up to {MAX_TARGETS} skills to work on above the rest. They grow faster; the rest of his game a little slower. Meet a target and the traits built on that skill gain mastery.
        </p>
      )}
      {list.map((t, i) => {
        const p = targetProgress(world, wp, t);
        return (
          <div key={t.key} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              {block ? (
                <strong>{ATTRIBUTE_LABELS[t.key]}</strong>
              ) : (
                <select value={t.key} onChange={(e) => choose(i, e.target.value)} aria-label={`Target ${i + 1}`}>
                  {GOLF_SKILLS.filter((k) => k === t.key || !keys.includes(k)).map((k) => <option key={k} value={k}>{ATTRIBUTE_LABELS[k]}</option>)}
                  <option value="">Remove</option>
                </select>
              )}
              <span className={`small ${p.pace === "behind" ? "bad-text" : p.pace === "on track" ? "muted" : "good-text"}`}>
                +{Math.max(0, p.gained).toFixed(1)} of +{t.goal}
              </span>
            </div>
            <div className="meter" style={{ marginTop: 4 }}><span style={{ width: `${Math.round(p.share * 100)}%` }} /></div>
            <div className="muted small">{p.comment}</div>
          </div>
        );
      })}
      {!block && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {list.length < MAX_TARGETS && (
            <select value="" onChange={(e) => e.target.value && set([...keys, e.target.value as AttributeKey])} aria-label="Add a target">
              <option value="">Add a target…</option>
              {GOLF_SKILLS.filter((k) => !keys.includes(k)).map((k) => <option key={k} value={k}>{ATTRIBUTE_LABELS[k]}</option>)}
            </select>
          )}
          <button type="button" className="ghost" onClick={() => set(suggestTargets(wp))}>Coaches' pick</button>
        </div>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>
        {block ?? `Targets can be changed until week ${TARGET_SET_WEEKS}; the goal is measured from when each one is set.`}
      </p>
    </section>
  );
}
