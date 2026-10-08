/**
 * Pure selection logic for monetization placements. No React, no environment access — so it is trivially
 * testable and can be swapped for a backend-driven source later without touching the components.
 */
import type { AdProfile, CommercialIntent } from "@/tools/types";
import type { AffiliateItem, AffiliatePlacement, Region } from "@/config/affiliates";
import { REGIONS } from "@/config/affiliates";
import type { Sponsor, SponsorPlacement } from "@/config/sponsors";
import type { PlacementId } from "@/config/monetization";

/** Which ad placements a page profile may use. The calculator itself is never inside any of them. */
const AD_PLACEMENTS: Record<AdProfile, PlacementId[]> = {
  none: [],
  minimal: ["in-content", "footer"],
  standard: ["top", "result-below", "in-content", "sidebar", "footer"],
};
export const allowedAdPlacements = (profile: AdProfile): PlacementId[] => AD_PLACEMENTS[profile];
export const adPlacementAllowed = (profile: AdProfile, placement: PlacementId): boolean => AD_PLACEMENTS[profile].includes(placement);

/** High-intent pages (loans, salary) get fewer commercial blocks, not more. */
export const maxAffiliateItems = (intent: CommercialIntent, explicit?: number): number => explicit ?? (intent === "high" ? 1 : 2);

export type PageContext = { toolId?: string; category?: string; affiliateCategories?: string[]; commercialIntent?: CommercialIntent };

const isHttps = (u: string | undefined): boolean => !!u && /^https:\/\//i.test(u);

export function validateAffiliate(a: AffiliateItem): string[] {
  const problems: string[] = [];
  if (!a.id || !/^[a-z0-9-]+$/.test(a.id)) problems.push("id must be lowercase-kebab-case");
  if (!isHttps(a.url)) problems.push("url must be https");
  if (a.trackingUrl !== undefined && !isHttps(a.trackingUrl)) problems.push("trackingUrl must be https");
  if (!a.regions.length || a.regions.some((r) => !REGIONS.includes(r))) problems.push("regions invalid");
  if (!a.merchant || !a.name || !a.description) problems.push("merchant, name and description are required");
  if (!a.disclosureRequired) problems.push("disclosureRequired should be true for affiliate links");
  return problems;
}

/** Items that could ever show on this page. Region is applied separately, in the browser. */
export function affiliateCandidates(items: AffiliateItem[], ctx: PageContext, placement?: AffiliatePlacement): AffiliateItem[] {
  if (!ctx.affiliateCategories?.length) return [];
  return items
    .filter((a) => a.active && validateAffiliate(a).length === 0)
    .filter((a) => ctx.affiliateCategories!.includes(a.category))
    .filter((a) => !placement || a.placement === placement)
    .sort((a, b) => b.priority - a.priority);
}

/** Apply the visitor's region. Unknown region is treated as GLOBAL — never guessed. */
export function matchesRegion(regions: Region[], visitor: Region): boolean {
  return regions.includes("GLOBAL") || regions.includes(visitor);
}

export function pickAffiliates(items: AffiliateItem[], visitor: Region, limit: number): AffiliateItem[] {
  return items.filter((a) => matchesRegion(a.regions, visitor)).slice(0, Math.max(0, limit));
}

/** Only the language region subtag of the browser (en-IN → IN). No IP lookup, no fingerprinting. */
export function detectRegion(languages: readonly string[] | undefined): Region {
  for (const lang of languages ?? []) {
    const m = /^[a-z]{2,3}-([A-Za-z]{2})\b/.exec(lang);
    if (!m) continue;
    const code = m[1].toUpperCase();
    if (code === "UK") return "GB";
    if (REGIONS.includes(code as Region)) return code as Region;
  }
  return "GLOBAL";
}

export type SponsorValidation = string[];
export function validateSponsor(s: Sponsor): SponsorValidation {
  const p: string[] = [];
  if (!/^[a-z0-9-]+$/.test(s.sponsorId)) p.push("sponsorId must be lowercase-kebab-case");
  if (!isHttps(s.destinationUrl)) p.push("destinationUrl must be https");
  if (s.image !== undefined && !/^\/sponsors\/[\w.-]+$/.test(s.image)) p.push("image must be a file under /public/sponsors");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(s.endDate)) p.push("dates must be YYYY-MM-DD");
  else if (s.endDate < s.startDate) p.push("endDate is before startDate");
  if (!s.title || !s.cta) p.push("title and cta are required");
  if (!s.targetRegions.length) p.push("targetRegions required");
  return p;
}

export function sponsorCandidates(items: Sponsor[], placement: SponsorPlacement, ctx: PageContext): Sponsor[] {
  return items
    .filter((s) => s.active && s.placement === placement && validateSponsor(s).length === 0)
    .filter((s) => !s.categories?.length || (ctx.category && s.categories.includes(ctx.category)))
    .filter((s) => !s.toolIds?.length || (ctx.toolId && s.toolIds.includes(ctx.toolId)));
}

/** Runtime filter (date window + region), applied in the browser so an expired sponsor disappears even on old static pages. */
export function activeSponsors(items: Sponsor[], todayISO: string, visitor: Region): Sponsor[] {
  return items.filter((s) => s.startDate <= todayISO && todayISO <= s.endDate && matchesRegion(s.targetRegions, visitor));
}
