import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { SITE, STATIC_PAGES } from "@/lib/site";
import { getMonetization } from "@/config/monetization";

const page = STATIC_PAGES.find((p) => p.path === "/privacy-policy")!;
export const metadata = pageMetadata({ title: "Privacy Policy", description: page.description, path: "/privacy-policy" });

export default function Privacy() {
  const m = getMonetization();
  const who = SITE.operatorName || `the owner of ${SITE.name}`;
  return (
    <LegalPage title="Privacy policy" path="/privacy-policy" updated intro={`${SITE.name} is built so that you can use it without giving anything away. This page explains exactly what that means.`}>
      <h2>The short version</h2>
      <ul>
        <li>There are no accounts, no sign-up and no payment.</li>
        <li>What you type into a calculator or developer tool is processed in your browser. It is not sent to us or stored on a server.</li>
        <li>We don’t set cookies of our own and don’t use your browser’s local storage.</li>
        <li>{m.analyticsEnabled ? "We use privacy-friendly analytics that count visits and tool use without recording what you enter." : "At the moment this site doesn’t use analytics."} {m.adsenseEnabled ? "Advertising is shown and can involve cookies (see below)." : "At the moment it doesn’t show ads that use cookies."}</li>
      </ul>
      <h2>What stays on your device</h2>
      <p>Numbers, text, JSON, tokens, regular expressions and code you enter are processed by JavaScript running in your browser tab and discarded when you leave. The developer tools never upload their input.</p>
      <p>The “Share link” button on calculators puts your entered values in the part of the address after the <code>#</code>. Browsers don’t send that part to servers, but anyone you give the link to can see the values, so only share it with people you’re comfortable showing them to. Share links are switched off on tools that handle sensitive data.</p>
      <h2>Information handled by our hosting provider</h2>
      <p>Like any website, our hosting provider receives standard technical information when your browser requests a page — your IP address, browser type and the page requested — and may keep it in server logs for security and operational reasons. We don’t use it to identify you.</p>
      <h2>Analytics</h2>
      {m.analyticsEnabled ? (
        <p>We use {m.analytics?.provider === "plausible" ? "Plausible" : "Umami"}, a privacy-focused analytics service, to count page views and a few anonymous events such as which tool was opened, whether a calculation was completed, a result was copied, or a search was made. The events carry only the tool and category names — never the values, text or files you enter — and we don’t build profiles of individual visitors.</p>
      ) : (
        <p>This site doesn’t currently run analytics. If that changes, this page will be updated first, and any analytics will record only anonymous events (such as which tool was opened), never the values you enter.</p>
      )}
      <h2>Advertising</h2>
      {m.adsenseEnabled ? (
        <p>This site shows advertising served by Google AdSense. Google and its partners may use cookies or similar technologies to show and measure ads and, depending on your location and choices, to personalise them. Where required, you will be asked for consent through a consent message. You can learn more and manage ad personalisation in Google’s own ad settings. Ads are always labelled and are kept away from the calculators.</p>
      ) : (
        <p>This site doesn’t currently show third-party advertising. If it does in future, this page will say which providers are used and how to manage your choices.</p>
      )}
      <h2>Affiliate links and sponsors</h2>
      <p>Some pages may contain labelled affiliate or sponsored links. Following one takes you to another website, which has its own privacy policy. {m.affiliatesEnabled ? "We record anonymous click counts per link to see which suggestions are useful; this doesn’t include what you entered into a calculator." : "None are active at the moment."} See the <Link href="/advertising-disclosure">advertising and affiliate disclosure</Link>.</p>
      <h2>Fonts and other resources</h2>
      <p>Fonts, scripts and styles are served from this site itself, so loading a page doesn’t contact a font or tracking service.</p>
      <h2>Children</h2>
      <p>The tools are general-purpose and not directed at young children. We don’t knowingly collect personal information from anyone.</p>
      <h2>Your rights and questions</h2>
      <p>Because we don’t collect personal data directly, there is normally nothing for us to access or delete. If you have a privacy question, contact {who}{SITE.contactEmail ? <> at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></> : <> through the <Link href="/contact">contact page</Link></>}.</p>
      <h2>Changes</h2>
      <p>If how the site handles data changes, this page will be updated and the revision date at the top changed.</p>
    </LegalPage>
  );
}
