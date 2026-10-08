import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { SITE, STATIC_PAGES } from "@/lib/site";
import Link from "next/link";

const page = STATIC_PAGES.find((p) => p.path === "/advertise")!;
export const metadata = pageMetadata({ title: "Advertise With Us", description: page.description, path: "/advertise" });

export default function Advertise() {
  return (
    <LegalPage title="Advertise with us" path="/advertise" intro="Reach people at the moment they are working something out — a loan, a salary offer, a unit conversion, a piece of code. Opportunities are simple and kept deliberately uncluttered.">
      <h2>What’s possible</h2>
      <ul>
        <li><strong>Sponsored placements</strong> — a clearly labelled card on a relevant category or tool page.</li>
        <li><strong>Tool sponsorships</strong> — sponsor a specific tool or group of tools where your product is genuinely relevant.</li>
        <li><strong>Display placements</strong> — standard ad units in reserved spaces away from the calculator controls.</li>
        <li><strong>Other partnerships</strong> — affiliate arrangements and co-created content, where they help the reader.</li>
      </ul>
      <h2>Our standards</h2>
      <ul>
        <li>Every paid placement is labelled “Sponsored” or “Advertisement”.</li>
        <li>Advertising never sits inside the calculator, between the inputs and the result, or beside the buttons, and it never changes a result.</li>
        <li>Sponsor links are marked as sponsored for search engines.</li>
        <li>Sponsors can’t buy changes to a tool’s content or its conclusions.</li>
      </ul>
      <h2>Audience figures</h2>
      <p>This page deliberately doesn’t publish traffic numbers or audience claims. If you need figures for a decision, ask — we will share real analytics data when it is available, and tell you plainly if it isn’t yet.</p>
      <h2>Get in touch</h2>
      {SITE.contactEmail ? <p>Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> with your product, the audience you want to reach and your timing.</p> : <p>A contact address hasn’t been published yet; see the <Link href="/contact">contact page</Link>.</p>}
      <p>See also the <Link href="/advertising-disclosure">advertising and affiliate disclosure</Link>.</p>
    </LegalPage>
  );
}
