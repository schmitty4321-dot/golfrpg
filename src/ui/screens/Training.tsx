import { useState } from "react";
import { ATTRIBUTE_LABELS, createRng, type AttributeKey } from "../../engine";
import {
  COACH_ROLES,
  REBUILDS,
  ROLE_LABELS,
  WINTER,
  canStartRebuild,
  ceilingEstimate,
  mixSeed,
  rebuildSuccessChance,
  seasonChange,
  staffQuality,
  weeklyStaffCost,
  seasonWeeks,
  type CoachRole,
  type Intensity,
  type TrainingFocus,
  type WinterProgram,
  type World,
  type RebuildArea,
} from "../../season";
import { money } from "../format";
import { Stars } from "../components/Stars";
import { Portrait } from "../components/Portrait";
import type { Game } from "../useGame";

const FOCUS: { id: TrainingFocus; label: string; blurb: string }[] = [
  { id: "balanced", label: "Balanced", blurb: "Even work on every part of the game." },
  { id: "longGame", label: "Long game", blurb: "Driving and long clubs." },
  { id: "approach", label: "Approach", blurb: "Irons, wedges and distance control." },
  { id: "shortGame", label: "Short game", blurb: "Chipping, pitching and bunkers." },
  { id: "putting", label: "Putting", blurb: "Lag, short putts, reading greens." },
  { id: "mental", label: "Mental", blurb: "Composure, decisions, closing out events." },
  { id: "fitness", label: "Fitness", blurb: "Stamina, flexibility, and holding on to distance with age." },
];

const INTENSITY: { id: Intensity; label: string; blurb: string }[] = [
  { id: "light", label: "Light", blurb: "Slower progress, fresher legs, fewer injuries." },
  { id: "normal", label: "Normal", blurb: "The usual workload." },
  { id: "heavy", label: "Heavy", blurb: "Faster progress, but tiring and twice the injury risk." },
];


const qualityStars = (q: number) => Math.max(0.5, Math.round((q / 20) * 5 * 2) / 2);

export function Training({ world, game, clientId }: { world: World; game: Game; clientId: string }) {
  const wp = world.players[clientId]!;
  const m = wp.client!;
  const quality = staffQuality(world, clientId);
  const bestCoach = Math.max(4, ...Object.values(quality));
  const ceiling = ceilingEstimate(wp, bestCoach, createRng(mixSeed(world.seed, world.season, 77)));
  const changes = Object.entries(seasonChange(wp)) as [AttributeKey, number][];
  const weekly = weeklyStaffCost(world, clientId);
  const [area, setArea] = useState<RebuildArea>("swing");
  const rebuildCheck = canStartRebuild(world, clientId, area);
  const R = REBUILDS[area];
  const act = game.act;

  return (
    <main>
      {wp.injury && (
        <section className="panel" style={{ background: "var(--neg-soft)" }}>
          <strong>Injured: {wp.injury.name}.</strong> Out for about {wp.injury.weeksLeft} more week{wp.injury.weeksLeft === 1 ? "" : "s"}. He can't enter events, and training does little until he's fit.
        </section>
      )}

      <div className="grid-2">
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Training focus</h2><span className="muted small">Focused areas grow about 2.5× faster than the rest</span></div>
            <div className="choice-grid">
              {FOCUS.map((f) => (
                <button key={f.id} className="choice" aria-pressed={m.training.focus === f.id} onClick={() => act((w) => (w.players[clientId]!.client!.training.focus = f.id))}>
                  <img className="option-art" src={`/art/scenes/${f.id}.webp`} alt="" />
                  <strong>{f.label}</strong>
                  <span className="secondary small">{f.blurb}</span>
                </button>
              ))}
            </div>
            <div className="panel-head" style={{ marginTop: 16 }}><h2>Intensity</h2></div>
            <div className="choice-grid">
              {INTENSITY.map((f) => (
                <button key={f.id} className="choice" aria-pressed={m.training.intensity === f.id} onClick={() => act((w) => (w.players[clientId]!.client!.training.intensity = f.id))}>
                  <img className="option-art" src={`/art/scenes/${f.id === "light" ? "putting" : f.id === "heavy" ? "fitness" : "balanced"}.webp`} alt="" />
                  <strong>{f.label}</strong>
                  <span className="secondary small">{f.blurb}</span>
                </button>
              ))}
            </div>
            <div className="panel-head" style={{ marginTop: 16 }}><h2>Winter program</h2><span className="muted small">The ten weeks between seasons</span></div>
            <div className="choice-grid">
              {(Object.keys(WINTER) as WinterProgram[]).map((id) => (
                <button key={id} className="choice" aria-pressed={(m.training.winter ?? "standard") === id} onClick={() => act((w) => (w.players[clientId]!.client!.training.winter = id))}>
                  <img className="option-art" src={`/art/scenes/${id === "camp" ? "longGame" : id === "fitness" ? "fitness" : id === "rest" ? "winter" : "balanced"}.webp`} alt="" />
                  <strong>{WINTER[id].label}</strong>
                  <span className="secondary small">{WINTER[id].blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Coaching staff</h2>
              <span className="secondary small">{money(weekly)}/week · about {money(weekly * seasonWeeks(world))} a season, paid from his winnings</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Role</th><th>Coach</th><th>Quality</th><th className="num">Per week</th><th /></tr></thead>
                <tbody>
                  {COACH_ROLES.map((role) => (
                    <StaffRow key={role} role={role} world={world} game={game} clientId={clientId} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">Better coaches speed up development in their area. With no coach he works it out alone, slowly. The fitness trainer also cuts injuries and slows the loss of distance with age.</p>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>His ceiling</h2>{(m.fatigue ?? 0) > 0 && <span className={`small ${(m.fatigue ?? 0) > 60 ? "bad-text" : "muted"}`} title="Training load and events build it; rest weeks clear it. Past 60 he grows slower and gets hurt more.">Fatigue {Math.round(m.fatigue ?? 0)}{(m.fatigue ?? 0) > 60 ? " · burning out" : ""}</span>}</div>
            <p style={{ marginTop: 0 }}>
              <Stars value={ceiling} /> <span className="secondary">according to his coaches</span>
            </p>
            <p className="secondary small" style={{ marginBottom: 0 }}>
              {wp.player.age <= wp.player.peakAge - 3
                ? "He's young: most of his improvement is still ahead of him."
                : wp.player.age <= wp.player.peakAge + 2
                  ? "He's around his peak years: gains come slowly now."
                  : "He's past his peak: expect distance to fade, while experience keeps him sharp."}{" "}
              Better coaches give a more reliable read.
            </p>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>{wp.rebuild ? REBUILDS[wp.rebuild.area ?? "swing"].label : "Rebuild part of his game"}</h2></div>
            {wp.rebuild ? (
              <>
                <p style={{ marginTop: 0 }}>Under way: {wp.rebuild.weeksLeft} of {wp.rebuild.totalWeeks} weeks left. He plays worse while the change beds in, easing week by week.</p>
                <div className="meter" aria-hidden><span style={{ width: `${(1 - wp.rebuild.weeksLeft / wp.rebuild.totalWeeks) * 100}%` }} /></div>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn" onClick={() => confirm("Abandon the rebuild? The weeks spent so far are lost.") && act((w) => game.lib.abandonRebuild(w, clientId))}>Abandon</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  <span className="tabs" role="radiogroup" aria-label="What to rebuild" style={{ display: "flex", marginBottom: 8 }}>
                    {(Object.keys(REBUILDS) as RebuildArea[]).map((a) => (
                      <button key={a} role="radio" aria-checked={area === a} aria-selected={area === a} onClick={() => setArea(a)}>{REBUILDS[a].label}</button>
                    ))}
                  </span>
                  A {R.weeks}-week project with his {R.coach === "shortGame" ? "short-game" : R.coach} coach. He'll lose up to {R.penalty} strokes a round at first. If it works, {R.blurb.toLowerCase()} improves and his ceiling rises; if it doesn't, the weeks are gone.
                </p>
                {m.staff[R.coach] && (
                  <p className="secondary small">
                    Chance it works with his current coach: {Math.round(rebuildSuccessChance(quality[R.coach] ?? 4, wp.player.attributes.coachability) * 100)}%.
                  </p>
                )}
                <button className="btn btn-primary" disabled={!rebuildCheck.ok} onClick={() => act((w) => game.lib.startRebuild(w, clientId, area))}>Start</button>
                {!rebuildCheck.ok && <p className="muted small">{rebuildCheck.reason}</p>}
                <p className="muted small">Tip: start one near the end of a season and the winter break absorbs most of the dip.</p>
              </>
            )}
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Changes this season</h2></div>
            {changes.length === 0 ? (
              <p className="empty">No changes yet. Development shows up a point at a time.</p>
            ) : (
              <table>
                <tbody>
                  {changes.map(([k, d]) => (
                    <tr key={k}>
                      <td>{ATTRIBUTE_LABELS[k]}</td>
                      <td className="num">{wp.player.attributes[k]}</td>
                      <td className={`num ${d > 0 ? "good-text" : "bad-text"}`}>{d > 0 ? `▲ ${d}` : `▼ ${-d}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function StaffRow({ role, world, game, clientId }: { role: CoachRole; world: World; game: Game; clientId: string }) {
  const current = world.coaches.find((c) => c.id === world.players[clientId]!.client!.staff[role]);
  const options = world.coaches.filter((c) => c.role === role).sort((a, b) => a.quality - b.quality);
  return (
    <tr>
      <td><div className="coach-role-cell">{current ? <Portrait player={{ id: `coach-${current.id}`, nationality: "USA", age: 30 + (Number(current.id.slice(1)) % 28) }} size={48} title={current.name} /> : <span className="coach-vacancy" aria-hidden>+</span>}<span><strong>{ROLE_LABELS[role]}</strong>{current && <small>{current.name}</small>}</span></div></td>
      <td>
        <select
          aria-label={`${ROLE_LABELS[role]}`}
          value={current?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            game.act((w) => (id ? game.lib.hireCoach(w, clientId, id) : game.lib.releaseCoach(w, clientId, role)));
          }}
        >
          <option value="">No one</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.formerClient ? " (former client)" : ""} · {c.quality}/20 · {money(c.weeklyFee)}/wk
            </option>
          ))}
        </select>
      </td>
      <td>{current ? <Stars value={qualityStars(current.quality)} /> : <span className="muted">–</span>}</td>
      <td className="num">{current ? money(current.weeklyFee) : "–"}</td>
      <td />
    </tr>
  );
}
