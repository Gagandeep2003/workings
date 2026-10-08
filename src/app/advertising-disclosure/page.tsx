import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { STATIC_PAGES } from "@/lib/site";
import { getMonetization } from "@/config/monetization";
import { AFFILIATES } from "@/config/affiliates";
import { SPONSORS } from "@/config/sponsors";

const page = STATIC_PAGES.find((p) => p.path === "/advertising-disclosure")!;
export const metadata = pageMetadata({ title: "Advertising and Affiliate Disclosure", description: page.description, path: "/advertising-disclosure" });

export default function AdvertisingDisclosure() {
  const m = getMonetization();
  const hasAffiliates = m.affiliatesEnabled && AFFILIATES.some((a) => a.active);
  const hasSponsors = m.directAdsEnabled && SPONSORS.some((s) => s.active);
  const none = !m.adsenseEnabled && !hasAffiliates && !hasSponsors;
  return (
    <LegalPage title="Advertising and affiliate disclosure" path="/advertising-disclosure" updated intro="How this site may earn money, and the rules it follows when it does.">
      <h2>Current status</h2>
      <ul>
        <li><strong>Display advertising:</strong> {m.adsenseEnabled ? "shown, served by Google AdSense." : "not currently shown."}</li>
        <li><strong>Affiliate links:</strong> {hasAffiliates ? "present on some pages, marked “Sponsored”." : "none at the moment."}</li>
        <li><strong>Direct sponsorships:</strong> {hasSponsors ? "present on some pages, marked “Sponsored”." : "none at the moment."}</li>
      </ul>
      {none && <p>The site currently earns nothing from its pages. This page describes the rules that will apply if that changes.</p>}
      <h2>Rules we follow</h2>
      <ul>
        <li><strong>Always labelled.</strong> Ads are marked “Advertisement”; affiliate and sponsored items are marked “Sponsored”. Affiliate links appear only where they are genuinely relevant to the tool you’re using.</li>
        <li><strong>Never in the way.</strong> Advertising is kept out of the calculator itself and away from its buttons, with reserved space so the page doesn’t jump while ads load.</li>
        <li><strong>Never changes results.</strong> Advertisers, sponsors and affiliate partners have no influence on any calculation, formula or explanation.</li>
        <li><strong>Marked for search engines.</strong> Paid links carry <code>rel=&quot;sponsored&quot;</code>.</li>
        <li><strong>No extra cost to you.</strong> If you buy through an affiliate link we may earn a commission; the price you pay is the same.</li>
      </ul>
      <h2>Your choices</h2>
      <p>See the <Link href="/privacy-policy">privacy policy</Link> for how advertising and analytics use data and how to manage your preferences. Interested in advertising? See <Link href="/advertise">Advertise with us</Link>.</p>
    </LegalPage>
  );
}
