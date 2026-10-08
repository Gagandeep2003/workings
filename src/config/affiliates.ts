/**
 * Affiliate registry — the ONLY place affiliate URLs live.
 *
 * It ships empty on purpose: no affiliate link appears anywhere until you add a real, relevant offer here
 * AND set AFFILIATES_ENABLED=true. See docs/MONETIZATION.md for a worked example.
 */
export type Region = "GLOBAL" | "IN" | "US" | "GB" | "CA" | "AU";
export const REGIONS: Region[] = ["GLOBAL", "IN", "US", "GB", "CA", "AU"];

export type AffiliatePlacement = "result-below" | "in-content" | "sidebar";

export type AffiliateItem = {
  id: string;
  merchant: string;
  name: string;
  /** Topical category. Only tools whose affiliateProfile.categories includes this will ever show the item. */
  category: string;
  description: string;
  /** Plain destination (used when no tracking URL is set). Must be https. */
  url: string;
  /** Affiliate tracking link. Preferred over `url` when present. Must be https. */
  trackingUrl?: string;
  disclosureRequired: boolean;
  /** Regions the offer is valid in. Use ["GLOBAL"] for everywhere. */
  regions: Region[];
  active: boolean;
  placement: AffiliatePlacement;
  /** Higher shows first. */
  priority: number;
};

export const AFFILIATES: AffiliateItem[] = [];
