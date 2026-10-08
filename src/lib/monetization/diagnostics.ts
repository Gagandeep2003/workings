import { readMonetizationConfig, PLACEMENTS } from "@/config/monetization";
import { AFFILIATES } from "@/config/affiliates";
import { SPONSORS } from "@/config/sponsors";
import { TOOLS } from "@/tools/registry";
import { validateAffiliate, validateSponsor } from "./select";

export type Diagnostic = { label: string; value: string; status: "ok" | "off" | "warn" };

export function monetizationDiagnostics(env: Record<string, string | undefined> = process.env): Diagnostic[] {
  const c = readMonetizationConfig(env);
  const activeAffiliates = AFFILIATES.filter((a) => a.active);
  const activeSponsors = SPONSORS.filter((s) => s.active);
  const monetizable = TOOLS.filter((t) => t.adProfile !== "none" || t.affiliateProfile || t.sponsorProfile);
  const missing: string[] = [];
  if (env.ADS_ENABLED === "true" && env.ADSENSE_ENABLED === "true" && !c.adsenseEnabled) missing.push("ADSENSE_PUBLISHER_ID (format ca-pub-1234567890123456)");
  if (c.adsenseEnabled) for (const p of PLACEMENTS) if (!c.adsenseSlots[p]) missing.push(`ADSENSE_SLOT_${p.toUpperCase().replace("-", "_")} (that placement will stay empty)`);
  if (env.ANALYTICS_ENABLED === "true" && !c.analyticsEnabled) missing.push("analytics provider settings (ANALYTICS_PROVIDER plus ANALYTICS_DOMAIN or ANALYTICS_WEBSITE_ID)");
  if (!env.NEXT_PUBLIC_SITE_URL && !env.VERCEL_PROJECT_PRODUCTION_URL) missing.push("NEXT_PUBLIC_SITE_URL (canonical domain)");
  const invalid = [...AFFILIATES.flatMap((a) => validateAffiliate(a).map((m) => `affiliate ${a.id}: ${m}`)), ...SPONSORS.flatMap((s) => validateSponsor(s).map((m) => `sponsor ${s.sponsorId}: ${m}`))];
  return [
    { label: "Ads enabled (ADS_ENABLED)", value: String(c.adsEnabled), status: c.adsEnabled ? "ok" : "off" },
    { label: "AdSense configured", value: c.adsenseEnabled ? `yes (${c.adsensePublisherId})` : "no", status: c.adsenseEnabled ? "ok" : "off" },
    { label: "AdSense slots filled", value: `${Object.values(c.adsenseSlots).filter(Boolean).length} of ${PLACEMENTS.length}`, status: c.adsenseEnabled && Object.values(c.adsenseSlots).filter(Boolean).length < PLACEMENTS.length ? "warn" : "off" },
    { label: "Direct sponsorship enabled", value: String(c.directAdsEnabled), status: c.directAdsEnabled ? "ok" : "off" },
    { label: "Affiliate system enabled", value: String(c.affiliatesEnabled), status: c.affiliatesEnabled ? "ok" : "off" },
    { label: "Active affiliate items", value: String(activeAffiliates.length), status: activeAffiliates.length ? "ok" : "off" },
    { label: "Active sponsor placements", value: String(activeSponsors.length), status: activeSponsors.length ? "ok" : "off" },
    { label: "Analytics configured", value: c.analyticsEnabled ? `yes (${c.analytics?.provider})` : "no", status: c.analyticsEnabled ? "ok" : "off" },
    { label: "Tool profiles that can show monetization", value: `${monetizable.length} of ${TOOLS.length}`, status: "ok" },
    { label: "  ad profile none / minimal / standard", value: `${TOOLS.filter((t) => t.adProfile === "none").length} / ${TOOLS.filter((t) => t.adProfile === "minimal").length} / ${TOOLS.filter((t) => t.adProfile === "standard").length}`, status: "ok" },
    { label: "  commercial intent low / medium / high", value: `${TOOLS.filter((t) => t.commercialIntent === "low").length} / ${TOOLS.filter((t) => t.commercialIntent === "medium").length} / ${TOOLS.filter((t) => t.commercialIntent === "high").length}`, status: "ok" },
    { label: "Invalid affiliate / sponsor entries", value: invalid.length ? invalid.join("; ") : "none", status: invalid.length ? "warn" : "ok" },
    { label: "Missing environment variables", value: missing.length ? missing.join("; ") : "none", status: missing.length ? "warn" : "ok" },
  ];
}
