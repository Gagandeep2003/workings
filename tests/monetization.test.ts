import { describe, it, expect } from "vitest";
import { readMonetizationConfig } from "@/config/monetization";
import { ALLOWED_PROPS, createAdapter, sanitizeProps, trackEvent, configureAnalytics } from "@/lib/analytics";
import { activeSponsors, adPlacementAllowed, affiliateCandidates, detectRegion, matchesRegion, maxAffiliateItems, pickAffiliates, sponsorCandidates, validateAffiliate, validateSponsor, allowedAdPlacements } from "@/lib/monetization/select";
import type { AffiliateItem } from "@/config/affiliates";
import type { Sponsor } from "@/config/sponsors";
import { AFFILIATES } from "@/config/affiliates";
import { SPONSORS } from "@/config/sponsors";
import { TOOLS } from "@/tools/registry";
import { monetizationDiagnostics } from "@/lib/monetization/diagnostics";

const aff = (o: Partial<AffiliateItem> = {}): AffiliateItem => ({ id: "x-loan", merchant: "Acme", name: "Acme Loans", category: "loans", description: "d", url: "https://example.com/p", disclosureRequired: true, regions: ["GLOBAL"], active: true, placement: "result-below", priority: 1, ...o });
const spons = (o: Partial<Sponsor> = {}): Sponsor => ({ sponsorId: "acme", placement: "sidebar", title: "t", description: "d", cta: "Go", destinationUrl: "https://example.com", startDate: "2026-01-01", endDate: "2026-12-31", active: true, targetRegions: ["GLOBAL"], ...o });

describe("monetization is OFF by default", () => {
  it("everything is disabled with an empty environment", () => {
    const c = readMonetizationConfig({});
    expect(c).toMatchObject({ adsEnabled: false, adsenseEnabled: false, directAdsEnabled: false, affiliatesEnabled: false, analyticsEnabled: false, analytics: null });
  });
  it("ships with no affiliates and no sponsors configured", () => {
    expect(AFFILIATES).toEqual([]);
    expect(SPONSORS).toEqual([]);
  });
  it("AdSense needs the master switch, its own switch and a valid publisher id", () => {
    expect(readMonetizationConfig({ ADSENSE_ENABLED: "true", ADSENSE_PUBLISHER_ID: "ca-pub-1234567890123456" }).adsenseEnabled).toBe(false);
    expect(readMonetizationConfig({ ADS_ENABLED: "true", ADSENSE_ENABLED: "true" }).adsenseEnabled).toBe(false);
    expect(readMonetizationConfig({ ADS_ENABLED: "true", ADSENSE_ENABLED: "true", ADSENSE_PUBLISHER_ID: "pub-bad" }).adsenseEnabled).toBe(false);
    const on = readMonetizationConfig({ ADS_ENABLED: "true", ADSENSE_ENABLED: "true", ADSENSE_PUBLISHER_ID: "ca-pub-1234567890123456", ADSENSE_SLOT_TOP: "1234567890", ADSENSE_SLOT_FOOTER: "junk" });
    expect(on.adsenseEnabled).toBe(true);
    expect(on.adsenseSlots.top).toBe("1234567890");
    expect(on.adsenseSlots.footer).toBeUndefined();
  });
  it("analytics needs a provider and its identifier", () => {
    expect(readMonetizationConfig({ ANALYTICS_ENABLED: "true" }).analyticsEnabled).toBe(false);
    expect(readMonetizationConfig({ ANALYTICS_ENABLED: "true", ANALYTICS_PROVIDER: "plausible" }).analyticsEnabled).toBe(false);
    expect(readMonetizationConfig({ ANALYTICS_ENABLED: "true", ANALYTICS_PROVIDER: "plausible", ANALYTICS_DOMAIN: "example.com" }).analytics?.scriptSrc).toBe("https://plausible.io/js/script.js");
    expect(readMonetizationConfig({ ANALYTICS_ENABLED: "true", ANALYTICS_PROVIDER: "umami", ANALYTICS_WEBSITE_ID: "abc" }).analyticsEnabled).toBe(false);
    expect(readMonetizationConfig({ ANALYTICS_ENABLED: "true", ANALYTICS_PROVIDER: "umami", ANALYTICS_WEBSITE_ID: "abc", ANALYTICS_SCRIPT_SRC: "http://insecure/x.js" }).analyticsEnabled).toBe(false);
    expect(readMonetizationConfig({ ANALYTICS_ENABLED: "true", ANALYTICS_PROVIDER: "umami", ANALYTICS_WEBSITE_ID: "abc", ANALYTICS_SCRIPT_SRC: "https://stats.example.com/s.js" }).analyticsEnabled).toBe(true);
  });
  it("the shape passed to the browser holds no secrets", () => {
    const c = readMonetizationConfig({ ADS_ENABLED: "true", ADSENSE_ENABLED: "true", ADSENSE_PUBLISHER_ID: "ca-pub-1234567890123456", ANALYTICS_ENABLED: "true", ANALYTICS_PROVIDER: "plausible", ANALYTICS_DOMAIN: "example.com" });
    expect(Object.keys({ analytics: c.analytics })).toEqual(["analytics"]);
    expect(JSON.stringify(c.analytics)).not.toMatch(/KEY|SECRET|TOKEN|ca-pub/i);
  });
});

describe("analytics never carries user-entered data", () => {
  it("drops unknown keys and unsafe values", () => {
    const s = sanitizeProps({ toolId: "emi-calculator", category: "money", principal: 1000000, input: "secret", text: "hello world", json: '{"a":1}', placement: "result-below<script>", resultCount: 3.7, queryLength: -5, mode: true });
    expect(s).toEqual({ toolId: "emi-calculator", category: "money", resultCount: 4, queryLength: 0, mode: true });
    expect(Object.keys(s).every((k) => (ALLOWED_PROPS as readonly string[]).includes(k))).toBe(true);
    expect(sanitizeProps({ toolId: "a".repeat(100) })).toEqual({});
    expect(sanitizeProps({ toolId: "has space" })).toEqual({});
    expect(sanitizeProps({ toolId: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" })).toEqual({});
    expect(sanitizeProps(undefined)).toEqual({});
  });
  it("does nothing when no provider is configured", () => {
    configureAnalytics(null);
    expect(() => trackEvent("tool_view", { toolId: "x" })).not.toThrow();
  });
  it("sends through whichever adapter is configured, and survives adapter errors", () => {
    const calls: unknown[] = [];
    const w = { plausible: (n: string, o: unknown) => calls.push([n, o]) } as never;
    configureAnalytics(createAdapter("plausible", w));
    trackEvent("tool_calculation", { toolId: "emi-calculator", category: "money", principal: 5 } as never);
    expect(calls).toEqual([["tool_calculation", { props: { toolId: "emi-calculator", category: "money" } }]]);
    const umami: unknown[] = [];
    configureAnalytics(createAdapter("umami", { umami: { track: (n: string, d: unknown) => umami.push([n, d]) } } as never));
    trackEvent("tool_result_copy", { toolId: "a" });
    expect(umami).toEqual([["tool_result_copy", { toolId: "a" }]]);
    configureAnalytics({ name: "bad", send: () => { throw new Error("boom"); } });
    expect(() => trackEvent("tool_view", { toolId: "a" })).not.toThrow();
    configureAnalytics(null);
  });
});

describe("ad placement rules", () => {
  it("never places ads in the calculator and respects page profiles", () => {
    expect(allowedAdPlacements("none")).toEqual([]);
    expect(adPlacementAllowed("minimal", "result-below")).toBe(false);
    expect(adPlacementAllowed("minimal", "sidebar")).toBe(false);
    expect(adPlacementAllowed("standard", "result-below")).toBe(true);
  });
  it("developer tools (which handle sensitive text) use the minimal ad profile", () => {
    for (const t of TOOLS.filter((x) => x.category === "developer")) expect(t.adProfile, t.id).not.toBe("standard");
  });
  it("high-intent pages show at most one affiliate item by default", () => {
    expect(maxAffiliateItems("high")).toBe(1);
    expect(maxAffiliateItems("low")).toBe(2);
    expect(maxAffiliateItems("high", 3)).toBe(3);
  });
});

describe("affiliates", () => {
  it("only offers items that are active, valid and topically relevant", () => {
    const items = [aff(), aff({ id: "b", category: "shoes" }), aff({ id: "c", active: false }), aff({ id: "d", url: "http://insecure.example" }), aff({ id: "e", priority: 9 })];
    const got = affiliateCandidates(items, { affiliateCategories: ["loans"] });
    expect(got.map((a) => a.id)).toEqual(["e", "x-loan"]);
    expect(affiliateCandidates(items, {})).toEqual([]);
    expect(affiliateCandidates(items, { affiliateCategories: ["loans"] }, "sidebar")).toEqual([]);
  });
  it("matches regions, defaulting to GLOBAL when the visitor can't be classified", () => {
    expect(matchesRegion(["GLOBAL"], "IN")).toBe(true);
    expect(matchesRegion(["IN"], "IN")).toBe(true);
    expect(matchesRegion(["IN"], "GLOBAL")).toBe(false);
    expect(matchesRegion(["US", "GB"], "IN")).toBe(false);
    expect(pickAffiliates([aff({ regions: ["IN"] }), aff({ id: "g" })], "GLOBAL", 5).map((a) => a.id)).toEqual(["g"]);
    expect(pickAffiliates([aff(), aff({ id: "g" })], "US", 1)).toHaveLength(1);
    expect(detectRegion(["en-IN", "en"])).toBe("IN");
    expect(detectRegion(["en-GB"])).toBe("GB");
    expect(detectRegion(["en"])).toBe("GLOBAL");
    expect(detectRegion(["fr-FR"])).toBe("GLOBAL");
    expect(detectRegion(undefined)).toBe("GLOBAL");
  });
  it("validates registry entries", () => {
    expect(validateAffiliate(aff())).toEqual([]);
    expect(validateAffiliate(aff({ disclosureRequired: false }))).toContain("disclosureRequired should be true for affiliate links");
    expect(validateAffiliate(aff({ trackingUrl: "http://x" }))).toContain("trackingUrl must be https");
    expect(validateAffiliate(aff({ regions: [] }))).toContain("regions invalid");
  });
});

describe("sponsors", () => {
  it("filters by placement and page, and by date window and region at runtime", () => {
    const list = [spons(), spons({ sponsorId: "b", placement: "top" }), spons({ sponsorId: "c", categories: ["money"] }), spons({ sponsorId: "d", active: false }), spons({ sponsorId: "e", image: "https://evil.example/x.png" })];
    expect(sponsorCandidates(list, "sidebar", { category: "math" }).map((s) => s.sponsorId)).toEqual(["acme"]);
    expect(sponsorCandidates(list, "sidebar", { category: "money" }).map((s) => s.sponsorId)).toEqual(["acme", "c"]);
    expect(activeSponsors([spons()], "2026-06-01", "GLOBAL")).toHaveLength(1);
    expect(activeSponsors([spons()], "2027-01-01", "GLOBAL")).toHaveLength(0);
    expect(activeSponsors([spons()], "2025-12-31", "GLOBAL")).toHaveLength(0);
    expect(activeSponsors([spons({ targetRegions: ["IN"] })], "2026-06-01", "US")).toHaveLength(0);
    expect(validateSponsor(spons({ endDate: "2025-01-01" }))).toContain("endDate is before startDate");
    expect(validateSponsor(spons({ destinationUrl: "http://x" }))).toContain("destinationUrl must be https");
  });
});

describe("dev diagnostics", () => {
  it("reports an all-off configuration without failing", () => {
    const d = monetizationDiagnostics({});
    expect(d.find((x) => x.label.startsWith("Ads enabled"))?.value).toBe("false");
    expect(d.find((x) => x.label === "Active affiliate items")?.value).toBe("0");
    expect(d.find((x) => x.label === "Missing environment variables")?.value).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });
  it("flags incomplete configuration", () => {
    const d = monetizationDiagnostics({ ADS_ENABLED: "true", ADSENSE_ENABLED: "true", NEXT_PUBLIC_SITE_URL: "https://x.com" });
    expect(d.find((x) => x.label === "Missing environment variables")?.value).toMatch(/ADSENSE_PUBLISHER_ID/);
  });
});
