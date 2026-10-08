/**
 * Central monetization configuration. Everything is OFF unless explicitly enabled by environment variables.
 * These variables are read on the server at build time; only the *resolved, non-secret* values are ever passed
 * to the browser (see getPublicMonetization). Never prefix a secret with NEXT_PUBLIC_.
 */
const flag = (v: string | undefined): boolean => v === "true" || v === "1";
const clean = (v: string | undefined): string => (v ?? "").trim();

export type PlacementId = "top" | "in-content" | "result-below" | "sidebar" | "footer";
export const PLACEMENTS: PlacementId[] = ["top", "in-content", "result-below", "sidebar", "footer"];

export type AnalyticsProviderId = "plausible" | "umami";

export type MonetizationConfig = {
  adsEnabled: boolean;
  adsenseEnabled: boolean;
  adsensePublisherId: string;
  adsenseSlots: Partial<Record<PlacementId, string>>;
  directAdsEnabled: boolean;
  affiliatesEnabled: boolean;
  analyticsEnabled: boolean;
  analytics: { provider: AnalyticsProviderId; domain: string; scriptSrc: string; websiteId: string } | null;
};

const PUBLISHER_RE = /^ca-pub-\d{10,20}$/;
const SLOT_RE = /^\d{6,20}$/;

export function readMonetizationConfig(env: Record<string, string | undefined> = process.env): MonetizationConfig {
  const adsEnabled = flag(env.ADS_ENABLED);
  const publisher = clean(env.ADSENSE_PUBLISHER_ID);
  const adsenseEnabled = adsEnabled && flag(env.ADSENSE_ENABLED) && PUBLISHER_RE.test(publisher);
  const slotFor = (key: string) => (SLOT_RE.test(clean(env[key])) ? clean(env[key]) : undefined);
  const provider = clean(env.ANALYTICS_PROVIDER) as AnalyticsProviderId;
  const analyticsEnabled = flag(env.ANALYTICS_ENABLED) && (provider === "plausible" || provider === "umami");
  const domain = clean(env.ANALYTICS_DOMAIN);
  const websiteId = clean(env.ANALYTICS_WEBSITE_ID);
  const defaultSrc = provider === "plausible" ? "https://plausible.io/js/script.js" : "";
  const scriptSrc = clean(env.ANALYTICS_SCRIPT_SRC) || defaultSrc;
  const configured = provider === "plausible" ? !!domain && /^https:\/\//.test(scriptSrc) : provider === "umami" ? !!websiteId && /^https:\/\//.test(scriptSrc) : false;
  return {
    adsEnabled,
    adsenseEnabled,
    adsensePublisherId: adsenseEnabled ? publisher : "",
    adsenseSlots: {
      top: slotFor("ADSENSE_SLOT_TOP"),
      "in-content": slotFor("ADSENSE_SLOT_IN_CONTENT"),
      "result-below": slotFor("ADSENSE_SLOT_RESULT_BELOW"),
      sidebar: slotFor("ADSENSE_SLOT_SIDEBAR"),
      footer: slotFor("ADSENSE_SLOT_FOOTER"),
    },
    directAdsEnabled: flag(env.DIRECT_ADS_ENABLED),
    affiliatesEnabled: flag(env.AFFILIATES_ENABLED),
    analyticsEnabled: analyticsEnabled && configured,
    analytics: analyticsEnabled && configured ? { provider, domain, scriptSrc, websiteId } : null,
  };
}

let cached: MonetizationConfig | null = null;
export function getMonetization(): MonetizationConfig {
  return (cached ??= readMonetizationConfig());
}

/** The only shape that may be passed to client components. Contains no secrets (AdSense IDs are public by design). */
export type PublicMonetization = {
  analytics: MonetizationConfig["analytics"];
};
export const getPublicMonetization = (): PublicMonetization => ({ analytics: getMonetization().analytics });
