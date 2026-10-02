import { useState } from "react";
import { highlightReplay, latestHighlight, seasonHighlights, type Highlight, type World } from "../../season";
import { ShotTracer } from "./ShotTracer";

function Replay({ world, h, onClose }: { world: World; h: Highlight; onClose: () => void }) {
  const r = highlightReplay(world, h);
  if (!r) return null;
  return <ShotTracer result={r.result} row={r.row} round={h.round} hole={h.hole} onClose={onClose} />;
}

const scoreWord = (h: Highlight) => (h.score === 1 ? "1" : `${h.score} (par ${h.par})`);

/** The week's best shot, with a replay on the shot tracer. */
export function ShotOfTheWeek({ world }: { world: World }) {
  const h = latestHighlight(world);
  const [open, setOpen] = useState(false);
  if (!h || h.season !== world.season || world.week - h.week > 2) return null;
  return (
    <section className="panel highlight">
      <div className="panel-head"><h2>Shot of the week</h2><span className="muted small">Week {h.week}</span></div>
      <p style={{ margin: 0 }}><strong>{h.title}</strong>{h.client ? <span className="badge badge-accent" style={{ marginLeft: 6 }}>Your client</span> : null}</p>
      <p className="small" style={{ margin: "4px 0 8px" }}>{h.text} Score: {scoreWord(h)}.</p>
      <button className="btn btn-small btn-primary" onClick={() => setOpen(true)}>Watch it</button>
      {open && <Replay world={world} h={h} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** The season's best moments, for the season review. */
export function SeasonMoments({ world, season }: { world: World; season: number }) {
  const list = seasonHighlights(world, season, 5);
  const [open, setOpen] = useState<Highlight | null>(null);
  if (!list.length) return null;
  return (
    <div>
      <h2 style={{ fontSize: 16, margin: "12px 0 6px" }}>The season in moments</h2>
      <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
        {list.map((h, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {i === 0 && <strong>Shot of the season: </strong>}
            {h.text} <button className="linkish" onClick={() => setOpen(h)}>Watch</button>
          </li>
        ))}
      </ol>
      {open && <Replay world={world} h={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
