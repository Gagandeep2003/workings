import { getMonetization, type PlacementId } from "@/config/monetization";
import { adPlacementAllowed } from "@/lib/monetization/select";
import type { AdProfile } from "@/tools/types";
import { AdsenseUnit } from "./AdsenseUnit";

type Props = { placement: PlacementId; profile?: AdProfile };

/**
 * Reusable ad placement. Renders nothing unless advertising is explicitly configured (a labelled dashed
 * placeholder is shown in development only). The box has a fixed minimum height per placement so loading an
 * ad can't shift the layout, and it is never placed inside or directly beside calculator controls.
 */
export function AdSlot({ placement, profile = "standard" }: Props) {
  if (!adPlacementAllowed(profile, placement)) return null;
  const cfg = getMonetization();
  const live = cfg.adsEnabled && cfg.adsenseEnabled;
  if (live) {
    const slot = cfg.adsenseSlots[placement];
    if (!slot) return null;
    return (
      <aside className={`ad ad--${placement}`} aria-label="Advertisement">
        <span className="ad__label">Advertisement</span>
        <div className="ad__box"><AdsenseUnit client={cfg.adsensePublisherId} slot={slot} /></div>
      </aside>
    );
  }
  if (process.env.NODE_ENV !== "production") {
    return (
      <aside className={`ad ad--dev ad--${placement}`} aria-label="Ad placeholder (development only)">
        <div className="ad__box">Ad slot “{placement}” — placeholder (ads are disabled; nothing renders in production)</div>
      </aside>
    );
  }
  return null;
}
