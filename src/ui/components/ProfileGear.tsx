import { EQUIPMENT, KIT_LABELS, KIT_SLOTS, KIT_STANDARD } from "../../engine";
import { APPAREL_ITEMS, APPAREL_LABELS, BRAND_ART, COACH_ROLES, MANAGER_LABEL, MANAGER_SKILLS, availableManagers, coldPuttingStreak, putterSwapBlock, putterSwapLift, swapPutter, weeklyStaffCost, wardrobe, type World, type WorldPlayer } from "../../season";
import { money } from "../format";
import type { Game } from "../useGame";
import { StaffRow } from "../screens/Training";

/** His development director: who runs his staff, what they're paid, and whether he's let hire the coaches. */
function DirectorPanel({ world, game, wp }: { world: World; game: Game; wp: WorldPlayer }) {
  const clientId = wp.player.id;
  const dir = world.managers?.find((d) => d.id === wp.client!.manager);
  const choices = availableManagers(world, clientId);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{MANAGER_LABEL}</h2>
        <span className="secondary small">{dir ? `${money(dir.weeklyFee)}/week, on top of the coaches` : "Nobody in charge yet"}</span>
      </div>
      <p style={{ marginTop: 0 }}>
        <select
          aria-label={MANAGER_LABEL}
          value={dir?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            game.act((w) => (id ? game.lib.hireManager(w, clientId, id) : game.lib.releaseManager(w, clientId)));
          }}
        >
          <option value="">No one</option>
          {choices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.quality}/20 · {money(d.weeklyFee)}/wk
            </option>
          ))}
        </select>
      </p>
      {dir && (
        <>
          <p className="small" style={{ marginTop: 0 }}>{dir.skills.map((s) => MANAGER_SKILLS[s]?.label).join(" · ")}</p>
          <ul className="small secondary">
            {dir.skills.map((s) => <li key={s}><strong>{MANAGER_SKILLS[s]?.label}:</strong> {MANAGER_SKILLS[s]?.blurb}</li>)}
          </ul>
        </>
      )}
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={!!wp.client!.autoHire}
          disabled={!dir}
          onChange={(e) => game.act((w) => game.lib.setAutoHire(w, clientId, e.target.checked))}
        />
        {dir ? `Let ${dir.name.split(" ")[0]} hire the best coaches for him` : "Let the director hire the best coaches for him"}
      </label>
      <p className="muted small">
        {dir
          ? "He fills empty slots with the coaches he rates best and swaps one out only for a clear step up. His read is a guess: the sharper his eye, the closer it is to the truth."
          : "Hire a director to run his staff. The better the director, the better the coaches he picks. Skills change what he pays, how often he swaps and what he won't touch."}
      </p>
    </section>
  );
}

/** His coaches on his page: his director, the coaches he hires, and who lets one go (clients only). */
export function ProfileCoaches({ world, game, wp }: { world: World; game: Game; wp: WorldPlayer }) {
  if (!wp.client) return <section className="panel"><p className="empty">Only your clients' coaches are yours to manage.</p></section>;
  const weekly = weeklyStaffCost(world, wp.player.id);
  return (
    <>
      <DirectorPanel world={world} game={game} wp={wp} />
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
        <p className="muted small">Pick a coach to hire or change one by hand; pick "No one" to let him go. Better coaches speed up development in their area.</p>
      </section>
    </>
  );
}

/** What's in his bag, and who dresses him. */
/** The putter swap: open after two cold putting weeks in a row, then a four-week wait. */
function PutterSwapPanel({ world, game, wp }: { world: World; game: Game; wp: WorldPlayer }) {
  const id = wp.player.id;
  const block = putterSwapBlock(world, id);
  const lift = putterSwapLift(wp);
  const swap = wp.client?.putterSwap;
  const cold = coldPuttingStreak(wp);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Putter swap</h2>
        <span className="secondary small">{cold >= 2 ? `Cold on the greens ${cold} events running` : cold === 1 ? "Cold on the greens last time out" : "Putting is fine"}</span>
      </div>
      <p style={{ marginTop: 0 }}>
        {lift > 0
          ? `His new putter has him seeing the line again: +${lift.toFixed(2)} putting a round next time out.`
          : lift < 0
            ? `The new putter doesn't sit right: ${lift.toFixed(2)} putting a round next time out.`
            : swap
              ? "The new putter's lift has worn off."
              : "A new putter can wake up a cold putting stroke for an event or two."}
      </p>
      <button className="btn btn-small" disabled={!!block} onClick={() => game.act((w) => swapPutter(w, id))}>Try a new putter</button>
      <p className="muted small">{block ?? "Usually +0.10 putting a round in his next event, +0.05 in the one after, then it fades. One time in five it just feels wrong (−0.05). He can swap again after four weeks."}</p>
    </section>
  );
}

export function ProfileEquipment({ wp, world, game }: { wp: WorldPlayer; world?: World; game?: Game }) {
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
          {KIT_SLOTS.map((slot) => {
            const model = EQUIPMENT.find((e) => e.id === (wp.player.equipment?.[slot] ?? KIT_STANDARD[slot]));
            return (
              <article key={slot} className="bag-card">
                <img className="club-art" src={`${base}art/clubs/${slot === "ball" ? "ball.svg" : `${slot}.webp`}`} alt="" />
                <span className="recruit-label">{KIT_LABELS[slot]}</span>
                <strong>{model?.name ?? "Tour standard"}</strong>
                <span className="small secondary">{model?.blurb}</span>
              </article>
            );
          })}
        </div>
        {wp.client && <p className="muted small">Buy or swap clubs and apparel in Clients → Store.</p>}
      </section>
      {wp.client && world && game && <PutterSwapPanel world={world} game={game} wp={wp} />}
      <section className="panel">
        <div className="panel-head">
          <h2>What he wears</h2>
          <span className="secondary small">What he has on, and who sponsors it</span>
        </div>
        <div className="bag-grid">
          {APPAREL_ITEMS.map((it) => {
            const brand = kit[it];
            const deal = brand ? wp.client?.sponsors.find((s) => s.sponsor === brand) : undefined;
            const art = brand ? BRAND_ART[brand] : undefined;
            // The piece he bought for this slot (see the Store), if any.
            const worn = EQUIPMENT.find((e) => e.id === wp.player.equipment?.[it]);
            return (
              <article key={it} className={`bag-card${brand ? " sponsored" : ""}`}>
                {art ? <img className="apparel-art" src={`${base}${art.banner}`} alt="" /> : <div className="apparel-art blank" aria-hidden />}
                <span className="recruit-label">{APPAREL_LABELS[it]}</span>
                <strong>{worn?.name ?? "Standard kit"}</strong>
                {worn && <span className="small secondary">{worn.blurb}</span>}
                <span className="small secondary">{brand ? `${brand}${deal ? `, ${money(deal.annualValue)} a season to S${deal.untilSeason}` : ""}` : "Unbranded · open for a deal"}</span>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
