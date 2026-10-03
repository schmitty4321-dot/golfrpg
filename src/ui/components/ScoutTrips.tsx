import { useState } from "react";
import { EYE_LABELS, SCOUT_REGIONS, regionPool, scoutEye, scoutOnTrip, type ScoutRegion, type World } from "../../season";
import type { Game } from "../useGame";
import { money } from "../format";

const REGIONS = Object.keys(SCOUT_REGIONS) as ScoutRegion[];
const REGION_ART: Record<ScoutRegion, string> = {
  NA: "/art/scouting/north-america.png",
  EU: "/art/scouting/europe.png",
  ASIA: "/art/scouting/asia.png",
  AUS: "/art/scouting/australia.png",
  ROW: "/art/scouting/world.png",
};

/** Send scouts abroad: pick a region on the board, a scout and how long; follow the trips under way. */
export function ScoutTripsPanel({ world, game }: { world: World; game: Game }) {
  const a = world.agency;
  const free = a.hiredScouts.map((id) => a.scouts.find((s) => s.id === id)!).filter((s) => s && !scoutOnTrip(world, s.id));
  const [region, setRegion] = useState<ScoutRegion>("EU");
  const [focus, setFocus] = useState<"amateurs" | "pros">("amateurs");
  const [weeks, setWeeks] = useState(3);
  const [scoutId, setScoutId] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const chosen = free.find((s) => s.id === scoutId) ?? free[0];
  const trips = a.trips ?? [];
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Choose a region to send scouts</h2>
        <span className="muted small">Send scouts around the world · reports return after two to four weeks</span>
      </div>
      <div className="region-board" role="radiogroup" aria-label="Region">
        {REGIONS.map((r) => (
          <button key={r} role="radio" aria-checked={region === r} className={`region-tile${region === r ? " on" : ""}`} onClick={() => setRegion(r)}>
            <img className="region-art" src={REGION_ART[r]} alt="" />
            <span className="region-check" aria-hidden>{region === r ? "✓" : ""}</span>
            <strong>{SCOUT_REGIONS[r].label}</strong>
            <span className="small">{regionPool(world, r, "amateurs").length} amateurs · {regionPool(world, r, "pros").length} without a card</span>
            <span className="small muted">{money(SCOUT_REGIONS[r].travel)}/week travel</span>
          </button>
        ))}
      </div>
      {free.length === 0 ? (
        <p className="empty">{a.hiredScouts.length ? "All your scouts are away." : "Hire a scout to send him on a trip."}</p>
      ) : (
        <div className="btn-row" style={{ alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <label className="small secondary">Scout
            <select value={chosen?.id ?? ""} onChange={(e) => setScoutId(e.target.value)} style={{ marginLeft: 6 }}>
              {free.map((s) => <option key={s.id} value={s.id}>{s.name} ({EYE_LABELS[scoutEye(s)]})</option>)}
            </select>
          </label>
          <label className="small secondary">Looking at
            <select value={focus} onChange={(e) => setFocus(e.target.value as "amateurs" | "pros")} style={{ marginLeft: 6 }}>
              <option value="amateurs">Amateurs</option>
              <option value="pros">Pros without a card</option>
            </select>
          </label>
          <label className="small secondary">For
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ marginLeft: 6 }}>
              {[2, 3, 4].map((n) => <option key={n} value={n}>{n} weeks</option>)}
            </select>
          </label>
          <button
            className="btn btn-primary btn-small"
            onClick={() => {
              let m: string | null = null;
              game.act((w) => (m = game.lib.sendScout(w, chosen!.id, region, focus, weeks)));
              setMsg(m);
            }}
          >
            Send him ({money(SCOUT_REGIONS[region].travel * weeks)} travel)
          </button>
          {msg && <span className="small bad-text">{msg}</span>}
        </div>
      )}
      {trips.length > 0 && (
        <ul className="news small" style={{ marginTop: 10 }}>
          {trips.map((t) => {
            const s = a.scouts.find((x) => x.id === t.scoutId);
            return (
              <li key={t.id}>
                <strong>{s?.name}</strong> in {SCOUT_REGIONS[t.region].label}: {t.weeks - t.weeksLeft} of {t.weeks} weeks, {t.found.length} seen
                {t.gem ? ", and he's excited about one of them" : ""}.
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
