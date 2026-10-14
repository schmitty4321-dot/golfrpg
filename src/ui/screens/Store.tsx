import { useMemo, useState } from "react";
import { Check, CircleDollarSign, Search, ShoppingBag, SlidersHorizontal, Sparkles, Star } from "lucide-react";
import { APPAREL_LABELS, APPAREL_SLOTS, EQUIPMENT, EQUIPMENT_SLOTS, SLOT_LABELS, type EquipmentModel, type GearSlot } from "../../engine";
import { LIFESTYLE_ITEMS, buyLifestyle, equip, lifestyleBlock, ownedLifestyle, qRating, qTarget, type LifestyleItem, type LifestyleKind, type World } from "../../season";
import { CutoutPortrait } from "../components/Portrait";
import { money } from "../format";
import { effects } from "./Team";
import type { Game } from "../useGame";

type StoreCategory = GearSlot | LifestyleKind;
type StoreItem = { kind: "gear"; value: EquipmentModel } | { kind: "lifestyle"; value: LifestyleItem };

const slotLabel = (slot: GearSlot): string => (slot in SLOT_LABELS ? SLOT_LABELS[slot as keyof typeof SLOT_LABELS] : APPAREL_LABELS[slot as keyof typeof APPAREL_LABELS]);
const makerOf = (m: EquipmentModel) => m.name.split(" ")[0] ?? "Tour";
const artFor = (category: StoreCategory, id?: string): string => {
  if ((EQUIPMENT_SLOTS as readonly string[]).includes(category)) return `art/clubs/${category}.webp`;
  if ((APPAREL_SLOTS as readonly string[]).includes(category)) return "art/sponsors/apparel.webp";
  if (category === "home") return "art/facilities/hq-3.webp";
  if (category === "car") return "art/sponsors/automotive.webp";
  return id?.includes("watch") ? "art/sponsors/watch.webp" : "art/sponsors/beverage.webp";
};

function effectTags(m: EquipmentModel): { text: string; tone: "good" | "trade" | "neutral" }[] {
  const result = effects(m).split(" · ").map((text) => {
    const trade = text.startsWith("-") || /streakier|riskier|worse/i.test(text);
    const good = text.startsWith("+") || /steadier|safer|better|cost less/i.test(text);
    return { text, tone: trade ? "trade" as const : good ? "good" as const : "neutral" as const };
  });
  return result[0]?.text === "No change" ? [{ text: "Tour-standard performance", tone: "neutral" }] : result;
}

/** The high-detail store: clubs, apparel and lifestyle purchases for one client. */
export function Store({ world, game, clientId }: { world: World; game: Game; clientId: string }) {
  const wp = world.players[clientId]!;
  const ownedGear = new Set(wp.client?.ownedEquipment ?? []);
  const lifestyle = ownedLifestyle(wp);
  const [category, setCategory] = useState<StoreCategory>("driver");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("all");
  const [upgradesOnly, setUpgradesOnly] = useState(false);
  const [sort, setSort] = useState<"featured" | "low" | "high">("featured");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState("driver-bomber");

  const isGear = [...EQUIPMENT_SLOTS, ...APPAREL_SLOTS].includes(category as GearSlot);
  const brands = useMemo(() => isGear ? [...new Set(EQUIPMENT.filter((m) => m.slot === category && m.price > 0).map(makerOf))] : [], [category, isGear]);
  const items = useMemo<StoreItem[]>(() => {
    const query = search.trim().toLowerCase();
    if (isGear) {
      const current = wp.player.equipment?.[category as GearSlot];
      return EQUIPMENT.filter((m) => m.slot === category)
        .filter((m) => !upgradesOnly || m.id !== current)
        .filter((m) => brand === "all" || makerOf(m) === brand)
        .filter((m) => `${m.name} ${m.blurb}`.toLowerCase().includes(query))
        .sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : 0)
        .map((value) => ({ kind: "gear" as const, value }));
    }
    return LIFESTYLE_ITEMS.filter((i) => i.kind === category)
      .filter((i) => `${i.name} ${i.blurb}`.toLowerCase().includes(query))
      .sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : 0)
      .map((value) => ({ kind: "lifestyle" as const, value }));
  }, [brand, category, isGear, search, sort, upgradesOnly, wp.player.equipment]);

  const pages = Math.max(1, Math.ceil(items.length / 6));
  const shown = items.slice(page * 6, page * 6 + 6);
  const selected = items.find((item) => item.value.id === selectedId) ?? shown[0];
  const currentGear = isGear ? EQUIPMENT.find((m) => m.id === wp.player.equipment?.[category as GearSlot])
    ?? EQUIPMENT.find((m) => m.slot === category && m.price === 0) : undefined;
  const currentLifestyle = !isGear ? lifestyle.find((i) => i.kind === category) : undefined;

  const chooseCategory = (next: StoreCategory) => {
    setCategory(next);
    setPage(0);
    setBrand("all");
    const first = EQUIPMENT.find((m) => m.slot === next && m.price > 0) ?? LIFESTYLE_ITEMS.find((i) => i.kind === next);
    if (first) setSelectedId(first.id);
  };

  const selectedGear = selected?.kind === "gear" ? selected.value : undefined;
  const selectedLifestyle = selected?.kind === "lifestyle" ? selected.value : undefined;
  const gearInBag = !!selectedGear && (wp.player.equipment?.[selectedGear.slot] === selectedGear.id || (!wp.player.equipment?.[selectedGear.slot] && selectedGear.price === 0));
  const gearOwned = !!selectedGear && (selectedGear.price === 0 || ownedGear.has(selectedGear.id));
  const lifestyleOwned = !!selectedLifestyle && lifestyle.some((i) => i.id === selectedLifestyle.id);
  const lifestyleBlocked = selectedLifestyle ? lifestyleBlock(world, clientId, selectedLifestyle.id) : null;

  return (
    <main className="shop-page">
      <section className="shop-panel">
        <header className="shop-masthead">
          <img src="art/facilities/center-3.webp" alt="The Fairway Manager performance lab" />
          <div className="shop-masthead-shade" />
          <div className="shop-masthead-copy">
            <span>FAIRWAY MANAGER STORE</span>
            <h1>Tour Performance Lab</h1>
            <p>Elite equipment and personal upgrades, chosen for the player and the way he competes.</p>
            <strong><ShoppingBag size={13} /> {ownedGear.size + lifestyle.length} items owned</strong>
          </div>
          <div className="shop-player">
            <CutoutPortrait player={wp.player} height={270} title={wp.player.name} />
            <div><small>SHOPPING FOR</small><strong>{wp.player.name}</strong><span>Season earnings {money(wp.career.seasonEarnings)}</span><em>Q rating {qRating(world, wp).toFixed(0)} · Player pays</em></div>
          </div>
        </header>

        <div className="shop-tools">
          <label className="shop-search"><Search size={15} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search the store…" /></label>
          <label className="shop-check"><input type="checkbox" checked={upgradesOnly} disabled={!isGear} onChange={(e) => { setUpgradesOnly(e.target.checked); setPage(0); }} /> Upgrades only</label>
          <label><select value={brand} disabled={!isGear} onChange={(e) => { setBrand(e.target.value); setPage(0); }}><option value="all">All brands</option>{brands.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><select value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(0); }}><option value="featured">Featured</option><option value="low">Price: low first</option><option value="high">Price: high first</option></select></label>
          <span><SlidersHorizontal size={14} /> Select an item to compare</span>
        </div>

        <div className="shop-shell">
          <aside className="shop-categories">
            <strong>CLUBS</strong>
            {EQUIPMENT_SLOTS.map((slot) => <button key={slot} aria-selected={category === slot} onClick={() => chooseCategory(slot)}>{SLOT_LABELS[slot]}<span>›</span></button>)}
            <strong>APPAREL</strong>
            {APPAREL_SLOTS.map((slot) => <button key={slot} aria-selected={category === slot} onClick={() => chooseCategory(slot)}>{APPAREL_LABELS[slot]}<span>›</span></button>)}
            <strong>LIFESTYLE</strong>
            {(["home", "car", "extra"] as const).map((kind) => <button key={kind} aria-selected={category === kind} onClick={() => chooseCategory(kind)}>{kind === "home" ? "Homes" : kind === "car" ? "Cars" : "Extras"}<span>›</span></button>)}
          </aside>

          <div className="shop-products">
            <div className="shop-title">
              <div><span>{isGear ? "PLAYER FITTING" : "PLAYER LIFESTYLE"}</span><h2>{isGear ? slotLabel(category as GearSlot) : category === "home" ? "Homes" : category === "car" ? "Cars" : "Extras"}</h2><p>{isGear ? "Compare performance, price and tradeoffs." : `Q rating ${qRating(world, wp).toFixed(0)}, heading toward ${qTarget(world, wp).toFixed(0)}.`}</p></div>
              <strong>{items.length} choices</strong>
            </div>
            <div className="shop-grid" role="radiogroup">
              {shown.map((item) => {
                const m = item.value;
                const gear = item.kind === "gear" ? item.value : undefined;
                const life = item.kind === "lifestyle" ? item.value : undefined;
                const inBag = !!gear && (wp.player.equipment?.[gear.slot] === gear.id || (!wp.player.equipment?.[gear.slot] && gear.price === 0));
                const have = item.kind === "gear" ? m.price === 0 || ownedGear.has(m.id) : lifestyle.some((i) => i.id === m.id);
                return <button key={m.id} className="shop-product" role="radio" aria-checked={selected?.value.id === m.id} onClick={() => setSelectedId(m.id)}>
                  <div className="shop-product-art"><span>{gear ? makerOf(gear) : life!.kind.toUpperCase()}</span><img src={artFor(category, m.id)} alt="" />{(inBag || have) && <b><Check size={11} /> {inBag ? "IN USE" : "OWNED"}</b>}</div>
                  <div className="shop-product-copy"><small>{gear ? `${makerOf(gear)} PERFORMANCE` : "FAIRWAY SELECT"}</small><strong>{m.name}</strong><span className="shop-price">{m.price ? money(m.price) : "Included"}</span><p>{m.blurb}</p>
                    <div className="shop-effects">{gear ? effectTags(gear).slice(0, 3).map((x) => <span key={x.text} className={x.tone}>{x.text}</span>) : <><span className="good">Q +{life!.qBonus}</span><span className="neutral">Upkeep {money(life!.upkeep)} / yr</span></>}</div>
                    <em>{inBag ? "Current selection" : have ? "Already owned" : "Select to compare"}</em>
                  </div>
                </button>;
              })}
            </div>
            {!shown.length && <div className="shop-empty">No products match those filters.</div>}
            <div className="shop-pager"><span>{items.length} choices · page {Math.min(page + 1, pages)} of {pages}</span><div><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div></div>
          </div>

          <aside className="shop-compare">
            <div className="shop-compare-head"><Sparkles size={15} /><span>{isGear ? "CURRENT VS SELECTED" : "SELECTED UPGRADE"}</span></div>
            {selected ? <><div className="shop-compare-items">
              <div><small>{isGear ? "Current" : currentLifestyle ? "Currently owned" : "Current"}</small><img src={artFor(category, currentLifestyle?.id)} alt="" /><strong>{isGear ? currentGear?.name ?? "None" : currentLifestyle?.name ?? "No item"}</strong></div>
              <b>VS</b>
              <div><small>Selected</small><img src={artFor(category, selected.value.id)} alt="" /><strong>{selected.value.name}</strong></div>
            </div>
            <div className="shop-compare-effects">{selected.kind === "gear" ? effectTags(selected.value).map((x) => <div key={x.text}><span className={x.tone}>{x.tone === "good" ? "↑" : x.tone === "trade" ? "!" : "•"}</span><strong>{x.text}</strong></div>) : <><div><span className="good"><Star size={11} /></span><strong>Q rating +{selected.value.qBonus}</strong></div><div><span className="neutral">•</span><strong>{money(selected.value.upkeep)} yearly upkeep</strong></div></>}</div>
            <div className="shop-cost"><CircleDollarSign size={22} /><div><small>{gearOwned || lifestyleOwned ? "READY" : "PLAYER PAYS"}</small><strong>{gearOwned || lifestyleOwned ? "Already owned" : money(selected.value.price)}</strong></div></div>
            {selectedGear && <button className="shop-buy" disabled={gearInBag} onClick={() => game.act((w) => equip(w, clientId, selectedGear.id))}>{gearInBag ? "In use" : gearOwned ? "Put in bag" : `Buy · ${money(selectedGear.price)}`}</button>}
            {selectedLifestyle && <button className="shop-buy" disabled={lifestyleOwned || !!lifestyleBlocked} onClick={() => game.act((w) => buyLifestyle(w, clientId, selectedLifestyle.id))}>{lifestyleOwned ? "Owned" : `Buy · ${money(selectedLifestyle.price)}`}</button>}
            <p>{selectedLifestyle && lifestyleBlocked ? lifestyleBlocked : selectedGear && gearOwned ? "Owned equipment can be swapped in for free." : selectedLifestyle ? "Homes and cars replace the current item with a half-price trade-in." : "The player pays, and the item is equipped immediately."}</p></> : <div className="shop-empty">Choose an item.</div>}
          </aside>
        </div>
      </section>
    </main>
  );
}
