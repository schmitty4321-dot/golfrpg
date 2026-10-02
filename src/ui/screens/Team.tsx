import { useState } from "react";
import { EQUIPMENT, EQUIPMENT_SLOTS, SLOT_LABELS, STANDARD, type EquipmentModel, type EquipmentSlot } from "../../engine";
import {
  JET_LEASE_WEEKLY,
  JET_PRICE,
  JET_UPKEEP_WEEKLY,
  TRAVEL_CLASSES,
  caddieChemistry,
  caddieEmployer,
  caddiesOf,
  travelMode,
  type TravelClass,
  type World,
} from "../../season";
import { money } from "../format";
import { Portrait } from "../components/Portrait";
import type { Game } from "../useGame";

/** What a model does, in a few words. */
function effects(m: EquipmentModel): string {
  const out: string[] = [];
  const cat = { offTheTee: "off the tee", approach: "approach", aroundTheGreen: "around the green", putting: "putting" } as const;
  for (const [k, v] of Object.entries(m.sg ?? {})) out.push(`${v! > 0 ? "+" : ""}${v!.toFixed(2)} ${cat[k as keyof typeof cat]}`);
  for (const [k, v] of Object.entries(m.spread ?? {})) out.push(`${v! < 1 ? "steadier" : "streakier"} ${cat[k as keyof typeof cat]}`);
  if (m.reach) out.push(`${m.reach > 0 ? "+" : ""}${m.reach} yds reach`);
  if (m.bunker) out.push("bunkers cost less");
  if (m.firm) out.push("better on firm greens, worse on soft");
  if (m.tightBlowup) out.push(m.tightBlowup > 1 ? "riskier on tight holes" : "safer on tight holes");
  return out.join(" · ") || "No change";
}

const bar = (v: number) => (
  <span className="fam-bar" style={{ display: "inline-block", width: 70, verticalAlign: "middle" }} aria-hidden>
    <span style={{ width: `${(v / 20) * 100}%` }} />
  </span>
);

/** A client's caddie, clubs and travel, and the agency's jet. */
export function Team({ world, game, clientId }: { world: World; game: Game; clientId: string }) {
  const wp = world.players[clientId]!;
  const m = wp.client!;
  const caddies = caddiesOf(world);
  const mine = caddies.find((k) => k.id === m.caddieId);
  const owned = new Set(m.ownedEquipment ?? []);
  const mode = travelMode(world, wp);
  const act = game.act;
  const [caddiePage, setCaddiePage] = useState(0);
  const [gearSlot, setGearSlot] = useState<EquipmentSlot>("driver");
  const [gearPage, setGearPage] = useState(0);
  const caddiePages = Math.ceil(caddies.length / 8);
  const shownCaddies = caddies.slice(caddiePage * 8, caddiePage * 8 + 8);
  const slotModels = EQUIPMENT.filter((e) => e.slot === gearSlot);
  const gearPages = Math.ceil(slotModels.length / 12);
  const shownModels = slotModels.slice(gearPage * 12, gearPage * 12 + 12);

  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <h2>Caddie</h2>
          <span className="muted small">Reads greens, picks clubs, calms nerves. Chemistry builds three points a week together.</span>
        </div>
        {mine ? (
          <p style={{ marginTop: 0 }}>
            <strong>{mine.name}</strong> is on the bag · {m.caddieWeeks ?? 0} weeks together · chemistry {caddieChemistry(m.caddieWeeks ?? 0)}/100{" "}
            <button className="linkish" onClick={() => act((w) => game.lib.releaseCaddie(w, clientId))}>Let him go</button>
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>No caddie hired: a tour caddie on a standard deal ($2,000 a week plus a share of winnings).</p>
        )}
        <div className="person-market">
              {shownCaddies.map((k) => {
                const busy = caddieEmployer(world, k.id);
                return (
                  <article key={k.id} className={`person-option ${k.id === m.caddieId ? "selected" : ""}`}>
                    <Portrait player={{ id: `caddie-${k.id}`, nationality: "USA", age: 24 + (Number(k.id.slice(1)) % 30) }} size={68} title={k.name} />
                    <div className="person-option-copy"><strong>{k.name}</strong><span className="muted small">{money(k.weeklyFee)}/wk · {Math.round(k.share * 100)}% winnings</span>
                    <span className="small">Greens {bar(k.greenReading)} {k.greenReading}</span><span className="small">Clubs {bar(k.clubbing)} {k.clubbing}</span><span className="small">Calm {bar(k.calm)} {k.calm}</span></div>
                    <div>
                      {k.id === m.caddieId ? (
                        <span className="muted small">On the bag</span>
                      ) : busy ? (
                        <span className="muted small">With {world.players[busy]!.player.name}</span>
                      ) : (
                        <button className="btn btn-small" onClick={() => act((w) => game.lib.hireCaddie(w, clientId, k.id))}>Hire</button>
                      )}
                    </div>
                  </article>
                );
              })}
        </div>
        <Pager page={caddiePage} pages={caddiePages} setPage={setCaddiePage} label={`${caddies.length} available caddies`} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>The bag</h2>
          <span className="muted small">He pays for his clubs. Owned models swap back in for free.</span>
        </div>
        <div className="market-tabs" role="tablist">
          {EQUIPMENT_SLOTS.map((slot) => <button key={slot} className="btn btn-small" aria-selected={gearSlot === slot} onClick={() => { setGearSlot(slot); setGearPage(0); }}>{SLOT_LABELS[slot]}</button>)}
        </div>
        <div className="gear-market">
                  {shownModels.map((e) => {
                    const current = wp.player.equipment?.[gearSlot] ?? STANDARD[gearSlot];
                    const inBag = e.id === current;
                    const have = e.price === 0 || owned.has(e.id);
                    return (
                      <button key={e.id} className="choice gear-card" role="radio" aria-checked={inBag} onClick={() => !inBag && act((w) => game.lib.equip(w, clientId, e.id))}>
                        <span className={`club-art club-art-${gearSlot}`} aria-hidden><i /></span>
                        <strong>{e.name}</strong>
                        <span className="secondary small">{e.blurb}</span>
                        <span className="small">{effects(e)}</span>
                        <span className="small muted">{inBag ? "In the bag" : have ? "Owned: free to swap" : `Buy for ${money(e.price)}`}</span>
                      </button>
                    );
                  })}
        </div>
        <Pager page={gearPage} pages={gearPages} setPage={setGearPage} label={`100 ${SLOT_LABELS[gearSlot].toLowerCase()} models`} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Travel</h2>
          <span className="muted small">Now: {mode.label}. Better travel means fresher legs, fewer travel days, and for private flights no jet lag.</span>
        </div>
        <div className="choice-list" role="radiogroup" aria-label="Travel class">
          {(Object.keys(TRAVEL_CLASSES) as TravelClass[]).map((k) => {
            const t = TRAVEL_CLASSES[k];
            return (
              <button key={k} className="choice" role="radio" aria-checked={(m.travelClass ?? "economy") === k} disabled={!!world.agency.jet} onClick={() => act((w) => game.lib.setTravelClass(w, clientId, k))}>
                <strong>{t.label}</strong>
                <span className="secondary small">{t.blurb}</span>
                <span className="small">Cost ×{t.cost} · travel tiredness ×{t.fatigue} · travel days {t.days[0]} (same region) / {t.days[1]} (another)</span>
              </button>
            );
          })}
        </div>
        <div className="panel-head" style={{ marginTop: 16 }}>
          <h3>Agency jet</h3>
          <span className="muted small">All your clients fly private: no travel days, a quarter of the travel tiredness, no jet lag. Paid by the agency.</span>
        </div>
        <div className="btn-row" style={{ alignItems: "center" }}>
          <span className="small">
            {world.agency.jet === "own" ? "The agency owns a jet." : world.agency.jet === "lease" ? "The agency leases a jet." : "No jet."} Bank {money(world.agency.bank)}.
          </span>
          {world.agency.jet !== "lease" && (
            <button className="btn btn-small" onClick={() => act((w) => void game.lib.setJet(w, "lease"))}>Lease ({money(JET_LEASE_WEEKLY)}/week)</button>
          )}
          {world.agency.jet !== "own" && (
            <button className="btn btn-small" disabled={world.agency.bank < JET_PRICE} onClick={() => confirm(`Buy a jet for ${money(JET_PRICE)}?`) && act((w) => void game.lib.setJet(w, "own"))}>
              Buy ({money(JET_PRICE)} + {money(JET_UPKEEP_WEEKLY)}/week)
            </button>
          )}
          {world.agency.jet && (
            <button className="btn btn-small" onClick={() => act((w) => void game.lib.setJet(w, null))}>{world.agency.jet === "own" ? "Sell (70% back)" : "End the lease"}</button>
          )}
        </div>
      </section>
    </main>
  );
}

function Pager({ page, pages, setPage, label }: { page: number; pages: number; setPage: (page: number) => void; label: string }) {
  return <div className="market-pager"><span className="muted small">{label} · page {page + 1} of {pages}</span><div className="btn-row"><button className="btn btn-small" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button className="btn btn-small" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div></div>;
}
