import type { World } from "../../season";
import type { Game } from "../useGame";
import { CurrentSponsorships, SponsorshipOffers } from "./Agency";
import { BrandsPanel } from "./Headquarters";

/**
 * Partnerships and sponsorships in one place: offers for your clients waiting
 * on an answer, the deals they have, and the agency's own brand partnerships.
 */
export function Partnerships({ world, game }: { world: World; game: Game }) {
  return (
    <main>
      <SponsorshipOffers world={world} game={game} />
      <CurrentSponsorships world={world} />
      <BrandsPanel world={world} game={game} />
    </main>
  );
}
