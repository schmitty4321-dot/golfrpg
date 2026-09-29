import { useEffect, useRef, useState } from "react";
import { ATTRIBUTE_LABELS, createRng, describeTendencies, nationInfo, tendencies, type AttributeKey } from "../../engine";
import {
  STATUS_LABELS,
  abilityView,
  acceptChance,
  knownTraits,
  approachBlock,
  attributePotential,
  ceilingStars,
  potentialEstimate,
  knowsHidden,
  mixSeed,
  pointsList,
  queueScouting,
  rankMap,
  scoutedAttribute,
  type World, knownArchetype } from "../../season";
import { Stars } from "./Stars";
import { TendenciesPanel } from "./TendenciesPanel";
import { PortraitCard } from "./Portrait";
import { StatBoxes, StatLegend } from "./StatBoxes";
import { SkillRadar } from "./SkillRadar";
import { TraitChip, TraitList } from "./Traits";
import { FamiliarityPanel } from "./Familiarity";
import { money, plural } from "../format";
import type { Game } from "../useGame";
import { ArchetypePill } from "./Archetype";

export function chanceWords(p: number): string {
  if (p < 0.1) return "Very unlikely";
  if (p < 0.35) return "Unlikely";
  if (p < 0.65) return "Could go either way";
  if (p < 0.9) return "Likely";
  return "Very likely";
}

/** Everything your agency knows about a player, and the offer form. */
export function PlayerProfile({ world, game, id, onClose }: { world: World; game: Game; id: string; onClose: () => void }) {
  const wp = world.players[id];
  const [commission, setCommission] = useState(10);
  const [years, setYears] = useState(2);
  const [result, setResult] = useState<string | null>(null);
  // A full screen of its own: Escape goes back, and the page underneath doesn't scroll.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
    };
  }, []);
  if (!wp) return null;
  const k = world.agency.knowledge[id];
  const known = (k?.accuracy ?? 0) > 0;
  const hidden = knowsHidden(world, id);
  const rank = rankMap(world).get(id);
  const pr = pointsList(world).indexOf(id) + 1;
  const season = wp.career.results.filter((r) => r.season === world.season);
  const best = season.filter((r) => r.madeCut).sort((a, b) => a.position - b.position)[0];
  const block = approachBlock(world, id);
  const offer = { commission: commission / 100, years };
  const chance = block ? 0 : acceptChance(world, id, offer);
  const queued = world.agency.scoutingQueue.includes(id);
  // His ceiling: the coaches' estimate for a client, the scouts' once a report is good enough.
  const potential = wp.client
    ? abilityView(world, id).potential
    : hidden
      ? potentialEstimate(wp, 4 + (k!.accuracy ?? 0) * 16, createRng(mixSeed(world.seed, world.season, Number(id.replace(/\D/g, "")) || 3)))
      : null;
  const ceiling = potential === null ? null : ceilingStars(potential);
  const traits = knownTraits(world, id);
  const archetype = knownArchetype(world, id);
  const view = (key: AttributeKey) => {
    const v = scoutedAttribute(world, id, key)!;
    return { ...v, ...(potential === null ? {} : { potential: attributePotential(wp.player, key, potential, v.value) }) };
  };

  return (
    <div className="player-page" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <div className="player-page-inner">
        <button className="btn btn-small player-back" onClick={onClose}><span aria-hidden>←</span> Back</button>
        <div className="pp-layout">
          <div className="pp-side">
          <aside className="pp-card">
            <PortraitCard player={wp.player} size={96} title={wp.player.name} />
            <div>
              <h1 id="profile-title">{wp.player.name}</h1>
              <div className="pp-meta">
                {wp.player.age} · {nationInfo(wp.player.nationality).name} · {STATUS_LABELS[wp.career.status]}
                <br />
                {wp.client ? "Your client" : wp.agent ? `${wp.agent.agency} (until end of season ${wp.agent.untilSeason})` : "Free agent"}
                {archetype && <div style={{ marginTop: 8 }}><ArchetypePill id={archetype} /></div>}
              </div>
            </div>
            <dl className="pp-kv">
              <div><dt>World rank</dt><dd>{rank ? `#${rank}` : "—"}</dd></div>
              <div><dt>Points list</dt><dd>{pr ? `#${pr}` : "—"}</dd></div>
              <div><dt>This season</dt><dd>{plural(season.length, "start")} · {season.filter((r) => r.madeCut).length} cuts{best ? ` · best ${best.label}` : ""}</dd></div>
              <div><dt>Career</dt><dd>{plural(wp.career.careerWins, "win")} · {plural(wp.career.careerMajors, "major")}</dd></div>
              <div><dt>Earnings</dt><dd>{money(wp.career.careerEarnings)}</dd></div>
              {ceiling !== null && <div><dt>Ceiling</dt><dd><Stars value={ceiling} /></dd></div>}
              {hidden && <div><dt>Home greens</dt><dd>{wp.player.grassPreference}</dd></div>}
              {hidden &&
                (["windTolerance", "professionalism", "coachability", "ambition"] as AttributeKey[]).map((key) => {
                  const v = scoutedAttribute(world, id, key)!;
                  return <div key={key}><dt>{ATTRIBUTE_LABELS[key]}</dt><dd>{v.low === v.high ? v.value : `${v.low}-${v.high}`}</dd></div>;
                })}
            </dl>
            {traits.length > 0 && (
              <div>
                <div className="pp-label">Traits</div>
                <div className="pp-chips">{traits.map((t) => <TraitChip key={t} id={t} dark />)}</div>
              </div>
            )}
            {hidden && (
              <div>
                <div className="pp-label">Tendencies</div>
                <div className="pp-chips">
                  {describeTendencies(tendencies(wp.player)).map((t) => <span key={t.label} className="pp-chip" title={`${t.label}: ${t.detail}`}>{t.value}</span>)}
                </div>
              </div>
            )}
          </aside>
          {known && (
            <section className="panel pp-radar">
              <div className="panel-head">
                <h2>Skill radar</h2>
                <StatLegend potential={potential !== null} />
              </div>
              <SkillRadar view={view} />
              <p className="muted small" style={{ margin: 0 }}>Group averages on the 1-20 scale. The dashed ring is a tour-average player (12).</p>
            </section>
          )}
          </div>

          <div className="pp-main">
            <section className="panel">
              <div className="panel-head">
                <h2>Skills</h2>
                <span className="muted small">
                  {known && <StatLegend potential={potential !== null} />}{" "}
                  {wp.client ? "Known exactly" : known ? `Scouted to ${Math.round(k!.accuracy * 100)}% · ${k!.reports} report${k!.reports === 1 ? "" : "s"}` : "Not scouted"}
                </span>
              </div>
              {!known ? (
                <p className="empty">
                  Your agency has no report on him: only his results are public.{" "}
                  {!wp.client && (
                    <button className="linkish" disabled={queued} onClick={() => game.act((w) => queueScouting(w, id))}>
                      {queued ? "Queued for scouting" : "Add to the scouting queue"}
                    </button>
                  )}
                </p>
              ) : (
                <>
                  <StatBoxes view={view} />
                  {!hidden && <p className="muted small">A more accurate report (60%+) would reveal his ceiling, how far each skill can grow, his work ethic and other hidden traits.</p>}
                  {potential !== null && <p className="muted small" style={{ marginBottom: 0 }}>Potential is an estimate from his overall ceiling{wp.client ? ", judged by his coaches" : ", judged by your scouts"}.</p>}
                  {!wp.client && (
                    <p className="small" style={{ marginBottom: 0 }}>
                      <button className="linkish" disabled={queued} onClick={() => game.act((w) => queueScouting(w, id))}>
                        {queued ? "Queued for another report" : "Scout him again for a sharper report"}
                      </button>
                    </p>
                  )}
                </>
              )}
            </section>

            {(known || wp.client) && (
              <section className="panel">
                <div className="panel-head"><h2>Traits</h2><span className="muted small">What sets him apart, on the course and off it</span></div>
                <TraitList
                  ids={traits}
                  hiddenNote={wp.client ? undefined : "Scouts spot each trait with a chance equal to their report's accuracy, so there may be more."}
                />
              </section>
            )}

            <FamiliarityPanel world={world} wp={wp} />

            {hidden && (
              <section className="panel">
                <div className="panel-head"><h2>Tendencies</h2><span className="muted small">His habits: they show up in replays and round stats</span></div>
                <TendenciesPanel player={wp.player} />
              </section>
            )}

        {!wp.client && (
          <section className="panel">
            <div className="panel-head"><h2>Offer representation</h2></div>
            {block ? (
              <p className="secondary" style={{ margin: 0 }}>{block}</p>
            ) : (
              <>
                <div className="btn-row" style={{ alignItems: "center" }}>
                  <label className="small secondary">Commission
                    <select value={commission} onChange={(e) => setCommission(Number(e.target.value))} style={{ marginLeft: 6 }}>
                      {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((c) => <option key={c} value={c}>{c}%</option>)}
                    </select>
                  </label>
                  <label className="small secondary">Length
                    <select value={years} onChange={(e) => setYears(Number(e.target.value))} style={{ marginLeft: 6 }}>
                      {[1, 2, 3].map((y) => <option key={y} value={y}>{y} season{y === 1 ? "" : "s"}</option>)}
                    </select>
                  </label>
                  <span className="small">Your read: <strong>{chanceWords(chance)}</strong></span>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      let msg = "";
                      game.act((w) => (msg = game.lib.offerRepresentation(w, id, offer).message));
                      setResult(msg);
                    }}
                  >
                    Make offer
                  </button>
                </div>
                <p className="muted small">Players weigh your reputation against their standing, the commission, the length, and their own ambition. Turn-downs mean a four-week wait.</p>
              </>
            )}
          </section>
        )}
        {result && (
          <p className={wp.client ? "good-text" : ""} style={{ margin: 0 }} role="status">
            <strong>{result}</strong>
          </p>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
