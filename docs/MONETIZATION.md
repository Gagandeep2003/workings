# Monetization architecture

Three independent channels, each behind its own switch, all **off by default**. The site, the calculators and the SEO output are identical with everything off
(verified: with no variables set no ad, sponsor, affiliate or analytics markup is emitted, and the CSP stays at its strictest).

| Channel | Switch(es) | Config | Components |
| --- | --- | --- | --- |
| Programmatic ads (AdSense) | `ADS_ENABLED` **and** `ADSENSE_ENABLED` **and** `ADSENSE_PUBLISHER_ID` | `ADSENSE_SLOT_<PLACEMENT>` | `AdSlot`, `AdsenseUnit` |
| Affiliate links | `AFFILIATES_ENABLED` | `src/config/affiliates.ts` | `AffiliatePlacement` → `AffiliateSlot` → `AffiliateCard` / `AffiliateRecommendation`, `AffiliateDisclosure` |
| Direct sponsors | `DIRECT_ADS_ENABLED` | `src/config/sponsors.ts` | `Placement` → `SponsorSlot` |
| Analytics | `ANALYTICS_ENABLED` + provider | `ANALYTICS_*` | `lib/analytics.ts`, `AnalyticsConfigurator`, `TrackView` |

## Placement rules

* Placements: `top` (category pages), `in-content`, `result-below`, `sidebar` (desktop ≥ 1100 px), `footer`. They live in shared layout components (`CalculatorShell`, `ToolPageView`, category page, `Footer`) —
  **no individual tool page mentions an ad**.
* Never inside the calculator, between inputs and result, or beside the buttons: `result-below` is rendered after the whole calculator block with ≥ 48 px of space and an "Advertisement" label.
* Each placement reserves a fixed minimum height (100 / 280 / 250 / 600 px) so late-loading ads don't shift the layout (measured CLS < 0.1 with all five placements enabled).
* A tool's `adProfile` decides which placements it may use: `none` (no ads), `minimal` (`in-content`, `footer` — used by all developer tools), `standard` (all).
* A tool's `commercialIntent` (`low | medium | high`) limits affiliate density: high-intent pages (loans, salary) show **one** affiliate item by default; low/medium show two. It never changes copy, titles or ranking signals.
* A direct sponsor, when one qualifies for a placement, takes that placement; otherwise the AdSense slot is used.
* If every ad script fails (blocker, network), the calculator is unaffected (tested).
* With ads disabled the slot renders nothing in production; in `next dev` it renders a dashed placeholder.

## Affiliate registry

`AffiliateItem`: `id, merchant, name, category, description, url, trackingUrl?, disclosureRequired, regions, active, placement, priority`.
An item shows only if: `AFFILIATES_ENABLED`, `active`, valid (https, disclosure on), its `category` is listed in the tool's `affiliateProfile.categories`, its `placement` matches, and the visitor's region
(browser-language region subtag only; unknown → `GLOBAL`) is in `regions`. Links carry `rel="sponsored nofollow noopener noreferrer"` and open in a new tab, with a disclosure line.

```ts
// src/config/affiliates.ts
export const AFFILIATES: AffiliateItem[] = [{
  id: "example-loan-comparison", merchant: "Example Bank", name: "Compare personal loan offers",
  category: "loans",            // tools with affiliateProfile: { categories: ["loans"] } (the EMI family)
  description: "See current personal-loan rates side by side.",
  url: "https://example.com/loans", trackingUrl: "https://example.com/loans?aff=YOUR_ID",
  disclosureRequired: true, regions: ["IN"], active: true, placement: "in-content", priority: 10,
}];
```
Tool topic profiles in use: `loans`, `investing`, `jobs`, `tax`, `accounting`, `exam-prep`, `developer-tools`. Add a category name to a tool's `affiliateProfile` to make it eligible.

## Sponsors

`Sponsor`: `sponsorId, placement, image?, title, description, cta, destinationUrl, startDate, endDate, active, targetRegions` (+ optional `categories`, `toolIds`). Dates are re-checked in the browser, so an expired sponsor
vanishes from already-built pages. Images must be in `public/sponsors/` (keeps `img-src` strict). Links are `rel="sponsored"`.

## Analytics and attribution

`trackEvent(name, props)` is the only call the app makes. Events: `tool_view, tool_calculation, tool_result_copy, tool_result_share, tool_search, category_view, affiliate_click, affiliate_impression,
ad_impression (reserved), sponsor_click, sponsor_impression`. Property keys are allow-listed (`toolId, category, placement, affiliateId, sponsorId, resultCount, queryLength, mode`) and values must be short
identifier-like strings or numbers — **calculator inputs, amounts, JSON, tokens and search text cannot be sent, even by mistake** (unit-tested). Providers (Plausible, Umami) are adapters in `lib/analytics.ts`; add another by
implementing `AnalyticsAdapter`. `ad_impression` is intentionally not fired for AdSense (fill and viewability aren't observable from the page).

Attribution questions and the events that answer them (group by `toolId` / `category` in the provider): traffic per tool/category → `tool_view`, `category_view`; completed use → `tool_calculation`;
affiliate clicks per tool/category → `affiliate_click`; sponsor placements and clicks → `sponsor_impression`, `sponsor_click`. Revenue itself isn't computed — join with your ad/affiliate reports offline.

## Going further later

The frontend talks to `lib/monetization/select.ts` (pure functions) and `config/*`. To drive these from a backend or admin tool later, replace the two config modules with a fetch (cached at build or via ISR) returning the same
shapes; components and layouts don't change. No admin, auth, database, ad server or payment code exists in this project by design.
