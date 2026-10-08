import { getMonetization, type PlacementId } from "@/config/monetization";
import { AFFILIATES, type AffiliatePlacement } from "@/config/affiliates";
import { SPONSORS } from "@/config/sponsors";
import { adPlacementAllowed, affiliateCandidates, maxAffiliateItems, sponsorCandidates } from "@/lib/monetization/select";
import type { ToolDefinition } from "@/tools/types";
import { AdSlot } from "./AdSlot";
import { SponsorSlot } from "./SponsorSlot";
import { AffiliateSlot } from "./Affiliate";

/** A direct sponsor takes the placement when one qualifies; otherwise the programmatic ad slot is used. */
export function Placement({ placement, tool, category }: { placement: PlacementId; tool?: ToolDefinition; category?: string }) {
  const cfg = getMonetization();
  const profile = tool?.adProfile ?? "standard";
  if (!adPlacementAllowed(profile, placement) && placement !== "top") return null;
  if (cfg.directAdsEnabled) {
    const candidates = sponsorCandidates(SPONSORS, placement, { toolId: tool?.id, category: tool?.category ?? category });
    if (candidates.length) return <SponsorSlot candidates={candidates} ctx={{ toolId: tool?.id, category: tool?.category ?? category }} />;
  }
  return <AdSlot placement={placement} profile={placement === "top" ? "standard" : profile} />;
}

/** Affiliate suggestions for a tool. Empty unless AFFILIATES_ENABLED, an active item exists and its topic matches the tool's affiliateProfile. */
export function AffiliatePlacement({ tool, placement }: { tool: ToolDefinition; placement: AffiliatePlacement }) {
  const cfg = getMonetization();
  if (!cfg.affiliatesEnabled || !tool.affiliateProfile) return null;
  const candidates = affiliateCandidates(AFFILIATES, { toolId: tool.id, category: tool.category, affiliateCategories: tool.affiliateProfile.categories }, placement);
  if (!candidates.length) return null;
  return <AffiliateSlot candidates={candidates} limit={maxAffiliateItems(tool.commercialIntent, tool.affiliateProfile.maxItems)} ctx={{ toolId: tool.id, category: tool.category }} />;
}
