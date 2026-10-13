import { APPAREL_LABELS, APPAREL_SLOTS, EQUIPMENT, EQUIPMENT_SLOTS, SLOT_LABELS, type GearSlot } from "../../engine";
import { LIFESTYLE_ITEMS, buyLifestyle, equip, lifestyleBlock, ownedLifestyle, qRating, qTarget, type World } from "../../season";
import { money } from "../format";
import { effects } from "./Team";
import type { Game } from "../useGame";

const sections: { title: string; blurb: string; slots: GearSlot[] }[] = [
  { title: "Clubs", blurb: "Driver, irons, wedges and putter.", slots: [...EQUIPMENT_SLOTS] },
  { title: "Apparel", blurb: "Hat, shirt and shoes. Small effects, most of them in the weather.", slots: [...APPAREL_SLOTS] },
];

const slotLabel = (slot: GearSlot): string => (slot in SLOT_LABELS ? SLOT_LABELS[slot as keyof typeof SLOT_LABELS] : APPAREL_LABELS[slot as keyof typeof APPAREL_LABELS]);

/** The store: clubs and apparel for one client. Buying puts the item in his bag, and he pays. */
export function Store({ world, game, clientId }: { world: World; game: Game; clientId: string }) {
  const wp = world.players[clientId]!;
  const owned = new Set(wp.client?.ownedEquipment ?? []);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Store</h2>
        <span className="secondary small">For {wp.player.name}: buying puts it in his bag, and he pays.</span>
      </div>
      {sections.map((sec) => (
        <div key={sec.title} className="store-section">
          <h3>{sec.title}</h3>
          <p className="muted small">{sec.blurb}</p>
          {sec.slots.map((slot) => (
            <div key={slot} className="store-slot">
              <span className="recruit-label">{slotLabel(slot)}</span>
              <ul className="store-items">
                {EQUIPMENT.filter((m) => m.slot === slot).map((m) => {
                  const inBag = wp.player.equipment?.[m.slot] === m.id || (!wp.player.equipment?.[m.slot] && m.price === 0);
                  const isOwned = m.price === 0 || owned.has(m.id);
                  return (
                    <li key={m.id}>
                      <strong>{m.name}</strong> <span className="small">{m.price > 0 ? money(m.price) : "standard"}</span>
                      <span className="small secondary"> · {effects(m)}</span>
                      <div className="small muted">{m.blurb}</div>
                      {inBag ? (
                        <span className="small good-text">In the bag</span>
                      ) : (
                        <button className="btn btn-small" onClick={() => game.act((w) => equip(w, clientId, m.id))}>
                          {isOwned ? "Put in bag" : `Buy · ${money(m.price)}`}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
      <div className="store-section">
        <h3>Lifestyle</h3>
        <p className="muted small">Personal purchases that lift his Q rating over time. Upkeep is paid a fiftieth each week.</p>
        <p className="small"><b>Q rating {qRating(world, wp).toFixed(0)}</b>, heading to {qTarget(world, wp).toFixed(0)}</p>
        {(["home", "car", "extra"] as const).map((kind) => (
          <div key={kind} className="store-slot">
            <span className="recruit-label">{kind === "home" ? "Homes" : kind === "car" ? "Cars" : "Extras"}</span>
            <ul className="store-items">
              {LIFESTYLE_ITEMS.filter((i) => i.kind === kind).map((i) => {
                const block = lifestyleBlock(world, clientId, i.id);
                const have = ownedLifestyle(wp).some((o) => o.id === i.id);
                const trading = i.kind !== "extra" ? ownedLifestyle(wp).find((o) => o.kind === i.kind) : undefined;
                return (
                  <li key={i.id}>
                    <strong>{i.name}</strong> <span className="small">{money(i.price)}</span>
                    <span className="small secondary"> · upkeep {money(i.upkeep)} a year · Q +{i.qBonus}</span>
                    <div className="small muted">{i.blurb}</div>
                    {have ? (
                      <span className="small good-text">He owns it</span>
                    ) : (
                      <>
                        <button className="btn btn-small" disabled={!!block} onClick={() => game.act((w) => buyLifestyle(w, clientId, i.id))}>{`Buy · ${money(i.price)}`}</button>
                        {trading && <span className="small muted"> Trades in his {trading.name} for half its price.</span>}
                        {block && <span className="small muted"> {block}</span>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
