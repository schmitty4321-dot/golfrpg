import { EQUIPMENT, EQUIPMENT_SLOTS, SLOT_LABELS, STANDARD } from "../../engine";
import { APPAREL_ITEMS, APPAREL_LABELS, BRAND_ART, COACH_ROLES, weeklyStaffCost, wardrobe, type World, type WorldPlayer } from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";
import { StaffRow } from "../screens/Training";

/** His coaches on his page: hire, change or let one go (clients only). */
export function ProfileCoaches({ world, game, wp }: { world: World; game: Game; wp: WorldPlayer }) {
  if (!wp.client) return <section className="panel"><p className="empty">Only your clients' coaches are yours to manage.</p></section>;
  const weekly = weeklyStaffCost(world, wp.player.id);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Coaches</h2>
        <span className="secondary small">{money(weekly)}/week, paid from his winnings</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Role</th><th>Coach</th><th>Quality</th><th className="num">Per week</th><th /></tr></thead>
          <tbody>
            {COACH_ROLES.map((role) => <StaffRow key={role} role={role} world={world} game={game} clientId={wp.player.id} />)}
          </tbody>
        </table>
      </div>
      <p className="muted small">Pick a coach to hire or change one; pick "No one" to let him go. Better coaches speed up development in their area.</p>
    </section>
  );
}

/** What's in his bag, and who dresses him. */
export function ProfileEquipment({ wp }: { wp: WorldPlayer }) {
  const clubDeal = wp.client?.sponsors.find((s) => s.category === "equipment");
  const kit = wardrobe(wp);
  const base = import.meta.env.BASE_URL;
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>In the bag</h2>
          <span className="secondary small">{clubDeal ? `Club deal: ${clubDeal.sponsor}, ${money(clubDeal.annualValue)} a season` : "No club deal"}</span>
        </div>
        <div className="bag-grid">
          {EQUIPMENT_SLOTS.map((slot) => {
            const model = EQUIPMENT.find((e) => e.id === (wp.player.equipment?.[slot] ?? STANDARD[slot]));
            return (
              <article key={slot} className="bag-card">
                <img className="club-art" src={`${base}art/clubs/${slot}.webp`} alt="" />
                <span className="recruit-label">{SLOT_LABELS[slot]}</span>
                <strong>{model?.name ?? "Tour standard"}</strong>
                <span className="small secondary">{model?.blurb}</span>
              </article>
            );
          })}
        </div>
        {wp.client && <p className="muted small">Change his clubs on Clients → Team &amp; gear.</p>}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>What he wears</h2>
          <span className="secondary small">Apparel deals: a full kit, or a hat, shirt or shoes deal on its own</span>
        </div>
        <div className="bag-grid">
          {APPAREL_ITEMS.map((it) => {
            const brand = kit[it];
            const deal = brand ? wp.client?.sponsors.find((s) => s.sponsor === brand) : undefined;
            const art = brand ? BRAND_ART[brand] : undefined;
            return (
              <article key={it} className={`bag-card${brand ? " sponsored" : ""}`}>
                {art ? <img className="apparel-art" src={`${base}${art.banner}`} alt="" /> : <div className="apparel-art blank" aria-hidden />}
                <span className="recruit-label">{APPAREL_LABELS[it]}</span>
                <strong>{brand ?? "Unbranded"}</strong>
                <span className="small secondary">{deal ? `${money(deal.annualValue)} a season to S${deal.untilSeason}` : "Open for a deal"}</span>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
