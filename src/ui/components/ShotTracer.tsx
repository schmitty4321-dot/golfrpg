import { useEffect, useMemo, useState } from "react";
import { aerialMatrix, useHoleMap } from "../holeMaps";
import { traceHole, traceSeed, type HoleTrace, type PlayerEventResult, type Pt, type Shot, type TournamentResult } from "../../engine";

interface Props {
  result: TournamentResult;
  row: PlayerEventResult;
  /** 0-based round and hole to open on. */
  round: number;
  hole: number;
  onClose: () => void;
}

const LIE_WORDS: Record<Shot["lie"], string> = {
  tee: "tee",
  fairway: "fairway",
  rough: "rough",
  bunker: "bunker",
  trees: "trees",
  water: "water",
  ob: "out of bounds",
  green: "green",
  fringe: "fringe",
  holed: "holed",
};

function scoreClass(score: number, par: number): string {
  const d = score - par;
  return d <= -2 ? "sc sc-eagle" : d === -1 ? "sc sc-birdie" : d === 1 ? "sc sc-bogey" : d >= 2 ? "sc sc-double" : "sc";
}

/** Replays a player's holes shot by shot on a drawing of each hole. */
export function ShotTracer({ result, row, round: startRound, hole: startHole, onClose }: Props) {
  const [round, setRound] = useState(startRound);
  const [hole, setHole] = useState(startHole);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [keyOnly, setKeyOnly] = useState(false);
  const [photo, setPhoto] = useState(true);
  const course = result.course;
  const card = row.holes[round]!;
  const h = course.holes[hole]!;
  const wind = result.weather[round]?.windMph[row.waves[round] ?? "AM"] ?? 0;

  const trace: HoleTrace = useMemo(
    () => traceHole({ course, hole: h, score: card[hole]!, player: row.player, windMph: wind, seed: traceSeed(result.name, row.player.id, round, hole) }),
    [course, h, card, hole, row.player, wind, result.name, round],
  );
  const holesToShow = course.holes.map((_, i) => i).filter((i) => !keyOnly || card[i] !== course.holes[i]!.par || i === hole);
  const map = useHoleMap(trace.layout.real);
  const hasAerial = !!map?.aerial;

  // Auto-play: reveal a shot every 900 ms, then move to the next hole.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step < trace.shots.length) setStep(step + 1);
      else {
        const next = holesToShow.find((i) => i > hole);
        if (next === undefined) setPlaying(false);
        else goHole(next);
      }
    }, step < trace.shots.length ? 900 : 1600);
    return () => clearTimeout(t);
  });

  function goHole(i: number) {
    setHole(i);
    setStep(0);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="tracer-title" onClick={onClose}>
      <div className="modal tracer" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div>
            <h1 id="tracer-title" style={{ fontSize: 20 }}>{row.player.name} · {result.name}</h1>
            <div className="secondary small">
              Round {round + 1} · Hole {h.number} · Par {h.par} · {h.yards} yds · Wind {Math.round(wind)} mph
            </div>
          </div>
          <button className="btn btn-small" onClick={onClose}>Close</button>
        </div>

        <div className="btn-row" style={{ alignItems: "center" }}>
          <div className="tabs" role="tablist" aria-label="Round" style={{ margin: 0 }}>
            {row.holes.map((_, r) => (
              <button key={r} role="tab" aria-selected={r === round} onClick={() => { setRound(r); setStep(0); }}>R{r + 1}</button>
            ))}
          </div>
          <label className="small secondary"><input type="checkbox" checked={keyOnly} onChange={(e) => setKeyOnly(e.target.checked)} /> Key holes only</label>
        </div>
        <div className="hole-chips" role="tablist" aria-label="Hole">
          {holesToShow.map((i) => (
            <button key={i} role="tab" aria-selected={i === hole} onClick={() => goHole(i)} title={`Hole ${i + 1}: ${card[i]} (par ${course.holes[i]!.par})`}>
              <span className="muted small">{i + 1}</span>
              <span className={scoreClass(card[i]!, course.holes[i]!.par)}>{card[i]}</span>
            </button>
          ))}
        </div>

        <div className="tracer-body">
          <div>
            <HoleDrawing trace={trace} step={step} photo={photo} map={map} />
            {trace.layout.real && (
              <div className="hole-credit">
                {hasAerial && (
                  <div className="tabs" role="tablist" aria-label="Hole view" style={{ margin: 0 }}>
                    <button role="tab" aria-selected={photo} onClick={() => setPhoto(true)}>Photo</button>
                    <button role="tab" aria-selected={!photo} onClick={() => setPhoto(false)}>Map</button>
                  </div>
                )}
                <span className="muted small">
                  {photo && hasAerial ? "Aerial photo: USDA NAIP / USGS (public domain) · " : ""}Hole map ©{" "}
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
                </span>
              </div>
            )}
          </div>
          <div>
            <p style={{ marginTop: 0 }}>
              <strong>{step >= trace.shots.length ? trace.result : "…"}</strong>
            </p>
            <ol className="shot-list">
              {trace.shots.map((s, i) => (
                <li key={i} className={i < step ? (i === step - 1 ? "current" : "") : "pending"}>
                  {(s.kind === "penalty" || !s.text.startsWith(s.club)) && <span className="muted small">{s.kind === "penalty" ? "Penalty" : s.club}</span>}
                  <span>{i < step ? s.text : "…"}</span>
                  {i < step && s.kind !== "penalty" && s.lie !== "holed" && <span className="muted small">Lies: {LIE_WORDS[s.lie]}</span>}
                </li>
              ))}
            </ol>
            <div className="btn-row">
              <button className="btn btn-small" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
              <button className="btn btn-small" onClick={() => { setPlaying(false); setStep(Math.min(trace.shots.length, step + 1)); }}>Next shot</button>
              <button className="btn btn-small" onClick={() => { setStep(0); setPlaying(true); }}>Replay hole</button>
              <button className="btn btn-small" disabled={hole === holesToShow[holesToShow.length - 1]} onClick={() => goHole(holesToShow.find((i) => i > hole) ?? hole)}>Next hole</button>
            </div>
            <p className="muted small">
              Shots are reconstructed from the simulated score, shaped by his game and the hole, so the replay always adds up to what he actually made.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HoleDrawing({ trace, step, photo, map }: { trace: HoleTrace; step: number; photo: boolean; map: ReturnType<typeof useHoleMap> }) {
  const L = trace.layout;
  const { minX, maxX, minY, maxY } = L.bounds;
  const W = maxX - minX;
  const H = maxY - minY;
  // Green at the top: flip y.
  const X = (p: Pt) => p.x - minX;
  const Y = (p: Pt) => maxY - p.y;
  const poly = (pts: Pt[]) => pts.map((p) => `${X(p).toFixed(1)},${Y(p).toFixed(1)}`).join(" ");
  const shots = trace.shots.slice(0, step).filter((s) => s.kind !== "penalty");
  const curve = (s: Shot, i: number) => {
    const a = { x: X(s.from), y: Y(s.from) };
    const b = { x: X(s.to), y: Y(s.to) };
    if (s.kind === "putt") return `M${a.x},${a.y} L${b.x},${b.y}`;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const bend = (i % 2 ? 1 : -1) * len * 0.07;
    const nx = -(b.y - a.y) / (len || 1);
    const ny = (b.x - a.x) / (len || 1);
    return `M${a.x},${a.y} Q${mx + nx * bend},${my + ny * bend} ${b.x},${b.y}`;
  };
  const bg = L.style === "desert" ? "var(--c-desert)" : L.style === "links" ? "var(--c-links)" : "var(--c-rough)";
  const shapes = (list: number[][][] | undefined, fill: string, key: string) =>
    list?.map((q, i) => <polygon key={`${key}${i}`} points={poly(q.map(([x, y]) => ({ x: x!, y: y! })))} fill={fill} />);
  return (
    <svg className="hole-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Hole diagram: par ${L.par}, ${L.yards} yards. ${trace.shots.slice(0, step).map((s) => s.text).join(" ")}`}>
      <defs><clipPath id="hole-clip"><rect x={0} y={0} width={W} height={H} /></clipPath></defs>
      <rect x={0} y={0} width={W} height={H} fill={bg} />
      {map?.aerial && photo ? (
        <g clipPath="url(#hole-clip)">
          <image
            href={`${import.meta.env.BASE_URL}${map.aerial.file}`}
            x={map.aerial.box[0]}
            y={-map.aerial.box[3]}
            width={map.aerial.box[1] - map.aerial.box[0]}
            height={map.aerial.box[3] - map.aerial.box[2]}
            preserveAspectRatio="none"
            transform={`matrix(${aerialMatrix(map.frame, minX, maxY).join(" ")})`}
          />
        </g>
      ) : map ? (
        <>
          {/* The real hole, from its OpenStreetMap outlines (clipped: neighbouring holes run off the edge). */}
          <g clipPath="url(#hole-clip)">
          {shapes(map.wood, "var(--c-trees)", "wd")}
          {shapes(map.rough, "var(--c-rough-deep)", "rg")}
          {shapes(map.water, "var(--c-water)", "wa")}
          {shapes(map.fairway, "var(--c-fairway)", "fw")}
          {shapes(map.tee, "var(--c-fairway)", "te")}
          {shapes(map.green, "var(--c-green)", "gr")}
          {shapes(map.bunker, "var(--c-bunker)", "bu")}
          {map.path.map((q, i) => (
            <polyline key={`pa${i}`} points={poly(q.map(([x, y]) => ({ x: x!, y: y! })))} fill="none" stroke="var(--c-cartpath)" strokeWidth={1.2} />
          ))}
          {map.tree.map(([x, y], i) => <circle key={`tr${i}`} cx={X({ x: x!, y: y! })} cy={Y({ x: x!, y: y! })} r={4} fill="var(--c-trees)" />)}
          </g>
        </>
      ) : (
        <>
          {L.style === "desert" && <path d={`M${X(L.tee)},${Y(L.tee)} ${L.path.map((p) => `L${X(p)},${Y(p)}`).join(" ")}`} stroke="var(--c-rough)" strokeWidth={70} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          {L.trees.map((t, i) => <circle key={`t${i}`} cx={X(t)} cy={Y(t)} r={t.r} fill="var(--c-trees)" />)}
          {L.water.map((w, i) => <polygon key={`w${i}`} points={poly(w)} fill="var(--c-water)" />)}
          {L.fairway.length > 0 && <polygon points={poly(L.fairway)} fill="var(--c-fairway)" />}
          <circle cx={X(L.green)} cy={Y(L.green)} r={L.green.r + 3} fill="var(--c-fairway)" />
          <circle cx={X(L.green)} cy={Y(L.green)} r={L.green.r} fill="var(--c-green)" />
          {L.bunkers.map((b, i) => <circle key={`b${i}`} cx={X(b)} cy={Y(b)} r={b.r} fill="var(--c-bunker)" />)}
          <rect x={X(L.tee) - 5} y={Y(L.tee) - 4} width={10} height={8} rx={1.5} fill="var(--c-fairway)" />
        </>
      )}
      {/* Flag */}
      <line x1={X(L.pin)} y1={Y(L.pin)} x2={X(L.pin)} y2={Y(L.pin) - 14} stroke="var(--c-flagpole)" strokeWidth={1} />
      <polygon points={`${X(L.pin)},${Y(L.pin) - 14} ${X(L.pin) + 8},${Y(L.pin) - 11} ${X(L.pin)},${Y(L.pin) - 8}`} fill="var(--c-flag)" />
      <circle cx={X(L.pin)} cy={Y(L.pin)} r={1.2} fill="#111" />
      {shots.map((s, i) => {
        const d = curve(s, i);
        const last = i === shots.length - 1;
        return (
          <g key={`${step}-${i}`}>
            <path d={d} stroke="rgba(0,0,0,0.45)" strokeWidth={s.kind === "putt" ? 2 : 3.2} fill="none" strokeLinecap="round" />
            <path d={d} stroke="#fff" strokeWidth={s.kind === "putt" ? 1 : 1.6} fill="none" strokeLinecap="round" pathLength={1} className={last ? "trace-draw" : undefined} strokeDasharray={1} strokeDashoffset={0} />
            {s.lie !== "holed" && <circle cx={X(s.to)} cy={Y(s.to)} r={s.kind === "putt" ? 1.4 : 2.4} fill={s.lie === "water" || s.lie === "ob" ? "var(--neg)" : "#fff"} stroke="rgba(0,0,0,0.6)" strokeWidth={0.6} className={last ? "trace-land" : undefined} />}
          </g>
        );
      })}
    </svg>
  );
}
