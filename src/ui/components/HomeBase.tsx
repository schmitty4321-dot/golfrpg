import { useState } from "react";
import {
  HOME_CITIES,
  HOME_CITY_BY_ID,
  cityLabel,
  homeCityOf,
  homeCrowd,
  moveBlock,
  moveCost,
  moveHome,
  moveMood,
  ownsHome,
  setHomeTax,
  taxOn,
  withinDrive,
  type World,
} from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Where a client lives: what it does for him, and moving somewhere else. */
export function HomeBasePanel({ world, game, clientId }: { world: World; game: Game; clientId: string }) {
  const wp = world.players[clientId]!;
  const city = homeCityOf(wp);
  const [to, setTo] = useState(HOME_CITIES.find((c) => c.id !== city.id)!.id);
  const events = world.schedule.filter((e) => e.tier !== "dev");
  const drives = events.filter((e) => withinDrive(wp, e.courseId));
  const crowds = events.filter((e) => homeCrowd(wp, e.courseId));
  const target = HOME_CITY_BY_ID[to]!;
  const cost = moveCost(wp, to);
  const block = moveBlock(world, clientId, to);
  const mood = moveMood(wp, to);
  const tax = taxOn(world);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Home base</h2>
        <span className="muted small">Where he lives: shorter trips, better weeks off, a home crowd, and his tax bill.</span>
      </div>
      <p style={{ marginTop: 0 }}>
        <strong>{cityLabel(city)}</strong> · {city.blurb}
      </p>
      <ul className="small" style={{ marginTop: 0 }}>
        <li>{drives.length ? `A drive from home (a travel day fewer, cheaper): ${drives.map((e) => e.name).join(", ")}.` : "No tour events within a day's drive."}</li>
        <li>{crowds.length ? `Home crowd (a little better, more press): ${crowds.map((e) => e.name).join(", ")}.` : "No tour events in his home state or country."}</li>
        <li>Weeks off at home: {ownsHome(wp) ? "25%" : "15%"} more recovery{ownsHome(wp) ? " (he owns a home there)" : ""}, and homesickness eases. Practice facilities {"★".repeat(city.practice)}.</li>
        <li>{tax ? `Income tax ${pct(city.tax)} on what he earns after commission.` : "Income tax is switched off for this career."}</li>
      </ul>
      <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <label className="small">
          Move to{" "}
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {HOME_CITIES.filter((c) => c.id !== city.id).map((c) => (
              <option key={c.id} value={c.id}>
                {cityLabel(c)}{tax ? ` · tax ${pct(c.tax)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-small" disabled={!!block} onClick={() => confirm(`Move ${wp.player.name} to ${cityLabel(target)} for ${money(cost.net)}?`) && game.act((w) => moveHome(w, clientId, to))}>
          Move ({money(cost.net)})
        </button>
      </div>
      <p className="muted small">
        {block ?? `Moving costs ${money(cost.cost)}${cost.resale ? `, less ${money(cost.resale)} for the home he sells` : ""}. Mood ${mood >= 0 ? "+" : "−"}${Math.abs(mood)}.`}
      </p>
      <label className="small">
        <input type="checkbox" checked={tax} onChange={() => game.act((w) => setHomeTax(w, !tax))} /> Income tax by home city (all clients)
      </label>
    </section>
  );
}
