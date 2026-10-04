import { useState, type ReactNode } from "react";
import { ATTRIBUTE_LABELS, type AttributeKey } from "../../engine";
import {
  COACH_ROLES,
  DEAL_ASK,
  dealBlock,
  dealChance,
  endDevelopmentDeal,
  offerDevelopmentDeal,
  GOLF_SKILLS,
  RETAINER_WEEKS,
  ROLE_LABELS,
  WINTER,
  abilityView,
  ceilingStars,
  coachFee,
  costBurden,
  developmentCost,
  earningsAtLevel,
  effectivePeak,
  fundingOf,
  overall,
  payback,
  plans,
  projectDevelopment,
  seasonChange,
  winterCost,
  type DealShare,
  type DealTerms,
  type Intensity,
  type Projection,
  type TrainingFocus,
  type WinterProgram,
  type World,
  type WorldPlayer,
} from "../../season";
import { money, signed } from "../format";
import type { Game } from "../useGame";
import { Stars } from "./Stars";

const FOCUS: { id: TrainingFocus; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "longGame", label: "Long game" },
  { id: "approach", label: "Approach" },
  { id: "shortGame", label: "Short game" },
  { id: "putting", label: "Putting" },
  { id: "mental", label: "Mental" },
  { id: "fitness", label: "Fitness" },
];
const INTENSITY: { id: Intensity; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "normal", label: "Normal" },
  { id: "heavy", label: "Heavy (twice the injury risk)" },
];

const levelOf = (a: Record<string, number>) => GOLF_SKILLS.reduce((s, k) => s + a[k]!, 0) / GOLF_SKILLS.length;

/**
 * Growth and training on the profile: where he is, where his coaches think
 * he can get to, what the plan costs and who pays, and what it's worth.
 * Other agencies' players show only what your scouts know.
 */
export function DevelopmentTab({ world, game, wp, potential, known }: { world: World; game: Game; wp: WorldPlayer; potential: number | null; known: boolean }) {
  if (!wp.client) return <OtherPlayer world={world} wp={wp} potential={potential} known={known} />;
  const id = wp.player.id;
  const m = wp.client;
  const now = overall(wp.player);
  const view = abilityView(world, id);
  const yearsLeft = Math.max(0, effectivePeak(wp) - wp.player.age);
  const sinceStart = now - levelOf(wp.development.seasonStart);
  const all = plans(world, id);
  const current = projectDevelopment(world, id, all.current);
  const best = projectDevelopment(world, id, all.best);
  const basic = projectDevelopment(world, id, all.basic);
  const cost = developmentCost(world, id);
  const pay = payback(world, id, current, basic);
  const funding = fundingOf(wp);
  const burden = costBurden(wp);
  const expected = earningsAtLevel(now);
  const changes = Object.entries(seasonChange(wp)).filter(([, d]) => d !== 0) as [AttributeKey, number][];
  const set = (f: (w: World) => void) => game.act(f);
  const peakLevel = (p: Projection) => Math.max(now, ...p.levels.map((l) => l.level));

  return (
    <>
      <section className="panel">
        <div className="panel-head"><h2>Development</h2><span className="muted small">His coaches' view · strongest coach {view.coachQuality}/20</span></div>
        <div className="player-stat-grid">
          <Stat label="Level now" value={now.toFixed(1)} />
          <Stat label="This season" value={signed(sinceStart, 1)} />
          <Stat label="Ceiling (coaches)" value={<><Stars value={ceilingStars(view.potential)} /> {view.potential.toFixed(1)}</>} />
          <Stat label="Growing years left" value={yearsLeft ? `about ${yearsLeft}` : "past his peak"} />
          <Stat label="At his peak, this plan" value={peakLevel(current).toFixed(1)} />
          <Stat label="At his peak, best plan" value={peakLevel(best).toFixed(1)} />
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          The ceiling is an estimate: better coaches see it more clearly. Tour average is 12; a top-20 player is about 14.5.
        </p>
      </section>

      <GrowthChart world={world} wp={wp} current={current} best={best} basic={basic} />
      {(m.devReports?.length || m.breakthroughs?.length) ? (
        <section className="panel">
          <div className="panel-head"><h2>Development history</h2><span className="muted small">Season by season, and the moments that changed him</span></div>
          <ul className="ws-lines">
            {[...(m.devReports ?? [])].reverse().map((r) => (
              <li key={r.season}>Season {r.season}: {r.from.toFixed(1)} → <strong>{r.to.toFixed(1)}</strong> <span className={r.to >= r.from ? "good-text" : "bad-text"}>({signed(r.to - r.from, 1)})</span>{r.milestones.length ? ` · ${r.milestones.join(", ")}` : ""}</li>
            ))}
            {(m.breakthroughs ?? []).length > 0 && <li>Breakthroughs: {(m.breakthroughs ?? []).map((b) => ({ "first-top5": "first Sunday in contention", "first-win": "first win", "major-contention": "contended at a major", "major-win": "major champion" } as Record<string, string>)[b] ?? b).join(", ")}</li>}
          </ul>
        </section>
      ) : null}

      <div className="player-stat-sections">
        <section className="panel">
          <div className="panel-head"><h2>His plan</h2></div>
          <div className="dev-form">
            <label>
              <span>Training focus</span>
              <select value={m.training.focus} onChange={(e) => set((w) => (w.players[id]!.client!.training.focus = e.target.value as TrainingFocus))}>
                {FOCUS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <label>
              <span>Intensity</span>
              <select value={m.training.intensity} onChange={(e) => set((w) => (w.players[id]!.client!.training.intensity = e.target.value as Intensity))}>
                {INTENSITY.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <label>
              <span>Winter program</span>
              <select value={m.training.winter ?? "standard"} onChange={(e) => set((w) => (w.players[id]!.client!.training.winter = e.target.value as WinterProgram))}>
                {(Object.keys(WINTER) as WinterProgram[]).map((p) => (
                  <option key={p} value={p}>{WINTER[p].label}{winterCost(world, id, p) ? ` · ${money(winterCost(world, id, p))}` : ""}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">{WINTER[m.training.winter ?? "standard"].blurb}</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Coach</th><th>Who</th><th className="num">Per season</th></tr></thead>
              <tbody>
                {COACH_ROLES.map((r) => {
                  const c = world.coaches.find((x) => x.id === m.staff[r]);
                  return (
                    <tr key={r}>
                      <td>{ROLE_LABELS[r]}</td>
                      <td>{c ? `${c.name} (${c.quality}/20)` : <span className="muted">None: works it out alone</span>}</td>
                      <td className="num">{c ? money(coachFee(c.quality) * RETAINER_WEEKS) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>Hire and change coaches on the Training tab. Range and gym days are set week by week in the planner.</p>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Budget</h2><span className="muted small">This season</span></div>
          <DealPanel world={world} game={game} wp={wp} funding={funding} />
          <table className="dev-budget">
            <tbody>
              <tr><td>Coaches' retainers</td><td className="num">{money(cost.coaches)}</td></tr>
              <tr><td>Coaches' share of prize money (1% each, estimated)</td><td className="num">{money(cost.coachBonus)}</td></tr>
              <tr><td>{WINTER[m.training.winter ?? "standard"].label}</td><td className="num">{money(cost.winter)}</td></tr>
              <tr className="dev-total"><td>Total</td><td className="num">{money(cost.total)}</td></tr>
              <tr><td>He pays</td><td className="num">{money(cost.client)}</td></tr>
              <tr><td>The agency pays</td><td className="num">{money(cost.agency)}</td></tr>
            </tbody>
          </table>
          <p className="small" style={{ marginBottom: 0 }}>
            At his level a season is worth about <strong>{money(expected)}</strong> in prize money.{" "}
            {cost.client > expected * 0.5 ? (
              <span className="neg">That's more than half his likely winnings on development. He won't be happy paying it himself.</span>
            ) : (
              <span className="secondary">He can afford his share.</span>
            )}
          </p>
          <p className="muted small" style={{ marginBottom: 0 }}>Spent so far: {money(m.finances.coaching + (m.finances.training ?? 0))} by him ({Math.round(burden * 100)}% of his income).</p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>What it's worth</h2><span className="muted small">Next {pay.seasons} season{pay.seasons === 1 ? "" : "s"}, against a bare-bones plan (no coaches, standard winter)</span></div>
        <div className="player-stat-grid">
          <Stat label="Level next season" value={`${(current.levels[0]?.level ?? now).toFixed(1)} vs ${(basic.levels[0]?.level ?? now).toFixed(1)}`} />
          <Stat label={`Level in ${pay.seasons} season${pay.seasons === 1 ? "" : "s"}`} value={`${(current.levels[pay.seasons - 1]?.level ?? now).toFixed(1)} vs ${(basic.levels[pay.seasons - 1]?.level ?? now).toFixed(1)}`} />
          <Stat label="Extra prize money" value={money(pay.extraEarnings)} />
          <Stat label="Your commission on it" value={money(pay.extraCommission)} />
          <Stat label="Agency's cost this season" value={money(cost.agency)} />
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          The gain keeps paying every season after, and each point of level roughly doubles a season's winnings, so the real return comes over his career.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>This season's progress</h2></div>
        {changes.length === 0 ? (
          <p className="empty">No skill has moved a full point yet this season.</p>
        ) : (
          <div className="dev-changes">
            {changes.map(([k, d]) => (
              <span key={k} className={`pp-chip ${d > 0 ? "dev-up" : "dev-down"}`}>{ATTRIBUTE_LABELS[k]} {signed(d, 0)}</span>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="player-stat"><span>{label}</span><strong>{value}</strong></div>;
}

const W = 640;
const H = 240;
const PAD = { l: 36, r: 16, t: 14, b: 28 };

/** Level by season: what he has done, then where the plans take him, under the ceiling his coaches see. */
function GrowthChart({ world, wp, current, best, basic }: { world: World; wp: WorldPlayer; current: Projection; best: Projection; basic: Projection }) {
  const past = (wp.career.seasonLog ?? []).map((l) => ({ season: l.season, level: l.overall }));
  const now = { season: world.season, level: overall(wp.player) };
  const history = [...past.filter((p) => p.season < world.season), now];
  const ahead = (p: Projection) => [now, ...p.levels.map((l) => ({ season: l.season + 1, level: l.level }))];
  const lines = { current: ahead(current), best: ahead(best), basic: ahead(basic) };
  const all = [...history, ...lines.best, ...lines.basic].map((p) => p.level).concat(current.ceiling, ...current.levels.map((l) => l.low), ...current.levels.map((l) => l.high));
  const lo = Math.floor(Math.min(...all) - 0.5);
  const hi = Math.ceil(Math.max(...all, 12) + 0.5);
  const seasons = [...history, ...lines.best].map((p) => p.season);
  const s0 = Math.min(...seasons);
  const s1 = Math.max(...seasons, s0 + 1);
  const x = (s: number) => PAD.l + ((s - s0) / (s1 - s0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = (pts: { season: number; level: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.season).toFixed(1)},${y(p.level).toFixed(1)}`).join("");
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v++) ticks.push(v);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Growth</h2>
        <span className="muted small dev-legend">
          <span className="dev-key dev-key-history" /> his level <span className="dev-key dev-key-current" /> this plan <span className="dev-key dev-key-best" /> best plan <span className="dev-key dev-key-basic" /> no coaches
        </span>
      </div>
      <svg className="sg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Level ${now.level.toFixed(1)} now; this plan reaches ${current.levels.at(-1)?.level.toFixed(1) ?? now.level.toFixed(1)}, the best plan ${best.levels.at(-1)?.level.toFixed(1) ?? now.level.toFixed(1)}, under a ceiling of about ${current.ceiling.toFixed(1)}`}>
        <rect x={PAD.l} width={W - PAD.l - PAD.r} y={y(current.ceiling + 0.5)} height={Math.max(2, y(current.ceiling - 0.5) - y(current.ceiling + 0.5))} className="dev-ceiling" />
        <text x={W - PAD.r - 4} y={y(current.ceiling + 0.5) - 4} textAnchor="end" className="chart-axis">his coaches' ceiling</text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 12 ? "chart-zero" : "chart-grid"} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{t}</text>
          </g>
        ))}
        {Array.from({ length: s1 - s0 + 1 }, (_, i) => s0 + i).map((s) => (
          <text key={s} x={x(s)} y={H - 8} textAnchor="middle" className="chart-axis">S{s}</text>
        ))}
        <path d={`${[now, ...current.levels.map((l) => ({ season: l.season + 1, level: l.high }))].map((p, i) => `${i ? "L" : "M"}${x(p.season).toFixed(1)},${y(p.level).toFixed(1)}`).join("")}${[...current.levels].reverse().map((l) => `L${x(l.season + 1).toFixed(1)},${y(l.low).toFixed(1)}`).join("")}Z`} className="dev-band" />
        <path d={path(lines.basic)} className="dev-line dev-basic" />
        <path d={path(lines.best)} className="dev-line dev-best" />
        <path d={path(lines.current)} className="dev-line dev-current" />
        <path d={path(history)} className="dev-line dev-history" />
        {history.map((p) => <circle key={p.season} cx={x(p.season)} cy={y(p.level)} r="3.5" className="dev-dot" />)}
      </svg>
      <p className="muted small chart-note">The dashed line at 12 is a tour-average player. Projections assume about 25 events a season and run two seasons past his peak age. The shaded band is the likely range on this plan: narrower with better coaches.</p>
    </section>
  );
}

function OtherPlayer({ world, wp, potential, known }: { world: World; wp: WorldPlayer; potential: number | null; known: boolean }) {
  const log = wp.career.seasonLog ?? [];
  return (
    <section className="panel">
      <div className="panel-head"><h2>Development</h2></div>
      {!known ? (
        <p className="empty">Scout him to see how he's developing.</p>
      ) : (
        <>
          <div className="player-stat-grid">
            <Stat label="Age" value={`${wp.player.age}`} />
            <Stat label="Level now" value={overall(wp.player).toFixed(1)} />
            <Stat label="Ceiling (scouts)" value={potential === null ? "Needs a better report" : <><Stars value={ceilingStars(potential)} /> {potential.toFixed(1)}</>} />
            <Stat label="Last season" value={log.length >= 2 ? signed(log[log.length - 1]!.overall - log[log.length - 2]!.overall, 1) : "–"} />
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Sign him to plan his training, coaching and winters here. Season {world.season}.
          </p>
        </>
      )}
    </section>
  );
}

/** Who pays: he does, or the agency funds part or all of it under a development deal. */
function DealPanel({ world, game, wp, funding }: { world: World; game: Game; wp: WorldPlayer; funding: number }) {
  const id = wp.player.id;
  const deal = wp.client!.devDeal;
  const [share, setShare] = useState<DealShare>(1);
  const [terms, setTerms] = useState<DealTerms>("commission");
  const [message, setMessage] = useState<string | null>(null);
  if (deal) {
    const back = deal.commissionSince - deal.funded;
    return (
      <div className="dev-deal">
        <p style={{ marginTop: 0 }}>
          <strong>Development deal since season {deal.since}:</strong> the agency pays {deal.share === 1 ? "all" : "half"} of it,
          in return for {deal.terms === "commission" ? "a higher commission" : "a longer contract"}.
        </p>
        <p className="small">
          Funded so far {money(deal.funded)} · commission from him since {money(deal.commissionSince)} ·{" "}
          <span className={back >= 0 ? "good-text" : "bad-text"}>{back >= 0 ? "ahead" : "behind"} by {money(Math.abs(back))}</span>
        </p>
        <button className="btn" onClick={() => game.act((w) => endDevelopmentDeal(w, id))}>Stop funding him</button>
      </div>
    );
  }
  const block = dealBlock(world, id);
  const chance = block ? 0 : dealChance(world, id, { share, terms });
  const ask = terms === "commission" ? `+${(DEAL_ASK.commission[share] * 100).toFixed(1)} points of commission` : `+${DEAL_ASK.years[share]} season${DEAL_ASK.years[share] === 1 ? "" : "s"} on his contract`;
  return (
    <div className="dev-deal">
      <p className="small" style={{ marginTop: 0 }}>{funding ? "" : "He pays for his own development. "}Offer a development deal: the agency funds it, and asks for something back.</p>
      <div className="dev-form">
        <label>
          <span>The agency pays</span>
          <select value={share} onChange={(e) => setShare(Number(e.target.value) as DealShare)}>
            <option value={0.5}>Half</option>
            <option value={1}>All of it</option>
          </select>
        </label>
        <label>
          <span>In return</span>
          <select value={terms} onChange={(e) => setTerms(e.target.value as DealTerms)}>
            <option value="commission">Higher commission</option>
            <option value="years">Longer contract</option>
          </select>
        </label>
      </div>
      <p className="small">You ask for {ask}. {block ?? `About ${Math.round(chance * 100)}% he says yes.`}</p>
      <button className="btn btn-primary" disabled={!!block} onClick={() => game.act((w) => setMessage(offerDevelopmentDeal(w, id, { share, terms }).message))}>Offer the deal</button>
      {message && <p className="small" role="status">{message}</p>}
    </div>
  );
}
