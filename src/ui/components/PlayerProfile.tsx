import { useState } from "react";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, createRng, type AttributeKey } from "../../engine";
import {
  STATUS_LABELS,
  acceptChance,
  approachBlock,
  ceilingEstimate,
  knowsHidden,
  mixSeed,
  pointsList,
  queueScouting,
  rankMap,
  scoutedAttribute,
  type World,
} from "../../season";
import { Stars } from "./Stars";
import { money, plural } from "../format";
import type { Game } from "../useGame";

const GROUP_LABELS: Record<keyof typeof ATTRIBUTE_GROUPS, string> = {
  longGame: "Long game",
  approach: "Approach",
  shortGame: "Short game",
  putting: "Putting",
  mental: "Mental",
  physical: "Physical",
};

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
  const ceiling = hidden ? ceilingEstimate(wp, 4 + (k!.accuracy ?? 0) * 16, createRng(mixSeed(world.seed, world.season, Number(id.replace(/\D/g, "")) || 3))) : null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div>
            <h1 id="profile-title" style={{ fontSize: 22 }}>{wp.player.name}</h1>
            <div className="secondary small">
              {wp.player.age} · {wp.player.nationality} · {STATUS_LABELS[wp.career.status]} ·{" "}
              {wp.client ? "Your client" : wp.agent ? `${wp.agent.agency} (until end of season ${wp.agent.untilSeason})` : "Free agent"}
            </div>
          </div>
          <button className="btn btn-small" onClick={onClose}>Close</button>
        </div>

        <div className="stat-row">
          <div className="stat"><span className="stat-label">World rank</span><span className="stat-value">{rank ? `#${rank}` : "—"}</span></div>
          <div className="stat"><span className="stat-label">Points list</span><span className="stat-value">{pr ? `#${pr}` : "—"}</span></div>
          <div className="stat"><span className="stat-label">This season</span><span className="stat-value">{plural(season.length, "start")}</span><span className="stat-sub">{season.filter((r) => r.madeCut).length} cuts{best ? `, best ${best.label}` : ""}</span></div>
          <div className="stat"><span className="stat-label">Career</span><span className="stat-value">{plural(wp.career.careerWins, "win")}</span><span className="stat-sub">{plural(wp.career.careerMajors, "major")} · {money(wp.career.careerEarnings)}</span></div>
        </div>

        <section>
          <div className="panel-head">
            <h2>Scouting report</h2>
            <span className="muted small">
              {wp.client ? "Known exactly" : known ? `Accuracy ${Math.round(k!.accuracy * 100)}% · ${k!.reports} report${k!.reports === 1 ? "" : "s"}` : "Not scouted"}
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
              <div className="attr-groups wide">
                {(Object.keys(ATTRIBUTE_GROUPS) as (keyof typeof ATTRIBUTE_GROUPS)[]).map((g) => (
                  <div key={g}>
                    <h3 style={{ marginBottom: 6 }}>{GROUP_LABELS[g]}</h3>
                    {ATTRIBUTE_GROUPS[g].map((key) => <RangeRow key={key} world={world} id={id} k={key} />)}
                  </div>
                ))}
              </div>
              {hidden ? (
                <div className="facts" style={{ marginTop: 12 }}>
                  <span>Ceiling: <Stars value={ceiling!} /></span>
                  <span>Grew up on {wp.player.grassPreference} greens</span>
                  {(["windTolerance", "professionalism", "coachability", "ambition"] as AttributeKey[]).map((key) => {
                    const v = scoutedAttribute(world, id, key)!;
                    return <span key={key}>{ATTRIBUTE_LABELS[key]}: {v.low === v.high ? v.value : `${v.low}-${v.high}`}</span>;
                  })}
                </div>
              ) : (
                <p className="muted small">A more accurate report (60%+) would reveal his ceiling, work ethic and other hidden traits.</p>
              )}
              {!wp.client && (
                <p className="small">
                  <button className="linkish" disabled={queued} onClick={() => game.act((w) => queueScouting(w, id))}>
                    {queued ? "Queued for another report" : "Scout him again for a sharper report"}
                  </button>
                </p>
              )}
            </>
          )}
        </section>

        {!wp.client && (
          <section className="panel" style={{ boxShadow: "none" }}>
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
  );
}

function RangeRow({ world, id, k }: { world: World; id: string; k: AttributeKey }) {
  const v = scoutedAttribute(world, id, k)!;
  const exact = v.low === v.high;
  return (
    <div className="attr range-row">
      <span title={ATTRIBUTE_LABELS[k]}>{ATTRIBUTE_LABELS[k]}</span>
      <span className="attr-bar range" aria-hidden>
        <span style={{ marginLeft: `${((v.low - 1) / 20) * 100}%`, width: `${((v.high - v.low + 1) / 20) * 100}%`, opacity: exact ? 1 : 0.45 }} />
      </span>
      <span className="attr-val" title={exact ? undefined : `Somewhere between ${v.low} and ${v.high}`}>{exact ? v.value : `${v.low}-${v.high}`}</span>
    </div>
  );
}
