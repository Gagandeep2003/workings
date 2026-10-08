import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { SITE, STATIC_PAGES } from "@/lib/site";
import { TOOLS, toolPath } from "@/tools/registry";
import { formatDateShort, parseISODate } from "@/lib/dates";

const page = STATIC_PAGES.find((p) => p.path === "/about")!;
export const metadata = pageMetadata({ title: "About and Methodology", description: page.description, path: "/about" });

export default function About() {
  const regulated = TOOLS.filter((t) => t.regulatory);
  return (
    <LegalPage title="About and methodology" path="/about" intro={`${SITE.name} is a collection of free calculators, converters and developer tools. Its aim is simple: give you the answer immediately, show how it was worked out, and point you to the next useful tool.`}>
      <h2>What this site is for</h2>
      <p>Everyday questions — what is 15% of this, how many days until that, what will this loan really cost — shouldn’t need an account, a pop-up or a wall of text. Every tool works as soon as the page loads, and the explanation, formula and a worked example sit underneath for anyone who wants to check the method.</p>
      <h2>How results are produced</h2>
      <ul>
        <li><strong>Plain, tested code.</strong> Every result comes from a deterministic function with unit tests covering normal values, decimals, zero, boundaries, rounding and invalid input. Nothing is estimated by a language model or looked up at run time.</li>
        <li><strong>Exact arithmetic where it matters.</strong> Money schedules are held in whole cents or paise so balances end at exactly zero; fractions and large counts use exact integers; dates use calendar arithmetic with no time-zone surprises (only the time-zone converter depends on your device’s time-zone data).</li>
        <li><strong>One table of unit factors.</strong> All converters share one table using exact legal definitions, so two pages can’t disagree.</li>
        <li><strong>Worked examples are computed, not typed.</strong> The example on each page is run through the same code when the site is built, so it can’t drift out of date.</li>
      </ul>
      <h2>How accuracy is handled</h2>
      <p>We state the assumptions behind each tool on its page and say so when a result is an estimate. Where a rule depends on a country, year or institution — income tax, GST, exam marking schemes, grade conversions — the tool names the rule, links its sources and shows the date it was last checked. If a rule is uncertain or conflicting sources disagree, the tool is limited to what is certain or left out; for CGPA conversion, for instance, only the CBSE multiplier is named, and your own university’s formula can be entered. We don’t guarantee that any result is error-free: please verify anything important against the official source.</p>
      {regulated.length > 0 && (
        <>
          <h2>Tools that depend on rules, and when they were checked</h2>
          <div className="table-wrap" role="region" aria-label="Rule-based tools" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th scope="col">Tool</th><th scope="col">Rule applied</th><th scope="col">Last checked</th></tr></thead>
              <tbody>
                {regulated.map((t) => {
                  const d = parseISODate(t.regulatory!.reviewedOn);
                  return (
                    <tr key={t.id}>
                      <th scope="row" style={{ fontWeight: 600 }}><Link href={toolPath(t)}>{t.title}</Link></th>
                      <td className="wrap">{t.regulatory!.appliesTo}</td>
                      <td>{d ? formatDateShort(d) : t.regulatory!.reviewedOn}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>These dates change only when the rule and its sources have genuinely been re-checked.</p>
        </>
      )}
      <h2>Your data</h2>
      <p>Calculations run in your browser. What you type into a calculator isn’t sent to a server, and the developer tools process JSON, tokens, text and code entirely on your device. See the <Link href="/privacy-policy">privacy policy</Link> for the details.</p>
      <h2>How the site is funded</h2>
      <p>The site is free to use. It may in future show clearly labelled advertising, affiliate links or sponsorships; none of these affect how a result is calculated. Read the <Link href="/advertising-disclosure">advertising and affiliate disclosure</Link>.</p>
      <h2>What this site is not</h2>
      <p>It is not a source of financial, tax, legal, academic or professional advice, and it can’t see your personal circumstances. See the <Link href="/disclaimer">disclaimer</Link>.</p>
      <h2>Who runs it</h2>
      <p>{SITE.operatorName ? `${SITE.name} is operated by ${SITE.operatorName}.` : `${SITE.name} is run by an independent site owner.`} Spotted a mistake or have a suggestion? Please use the <Link href="/contact">contact page</Link> — corrections are welcome.</p>
    </LegalPage>
  );
}
