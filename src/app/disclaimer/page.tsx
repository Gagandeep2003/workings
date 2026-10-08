import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { STATIC_PAGES } from "@/lib/site";

const page = STATIC_PAGES.find((p) => p.path === "/disclaimer")!;
export const metadata = pageMetadata({ title: "Disclaimer", description: page.description, path: "/disclaimer" });

export default function Disclaimer() {
  return (
    <LegalPage title="Disclaimer" path="/disclaimer" updated intro="These tools do arithmetic. They don’t know your circumstances, and they aren’t a substitute for professional advice.">
      <h2>Not financial, tax or legal advice</h2>
      <p>Loan, investment, interest, GST, salary and tax calculators show what a standard formula produces from the figures and assumptions you provide. Real products have fees, charges, rate changes, tax rules and conditions that a general calculator can’t know. Nothing here is a recommendation to borrow, invest, buy or sell. Confirm figures with the lender, bank, tax authority or a qualified adviser before you decide.</p>
      <h2>Estimates and assumptions</h2>
      <p>Where a result is an estimate — for example CTC to take-home pay, leave balances or notice-period dates — the page lists the assumptions used. Your contract, payslip, employer policy and local law decide the actual amount.</p>
      <h2>Rules that change</h2>
      <p>Tax slabs, GST rates, exam marking schemes and grading conversions change over time and vary by place and institution. Pages that depend on such rules show the year they apply to, their sources and the date they were last checked. That date means the rule was re-checked on that day — it isn’t a promise that nothing has changed since. Always confirm with the official source.</p>
      <h2>Exams and education</h2>
      <p>Exam calculators estimate raw marks from your own answer counts using the scheme named on the page. They don’t predict normalised scores, cut-offs or results. Boards and universities set their own conversion rules; where yours differs from the one shown, yours applies.</p>
      <h2>Developer tools</h2>
      <p>Developer tools run in your browser. The JWT decoder decodes only and never verifies a signature, so decoded contents must not be trusted. Formatters change layout, not meaning, but you should review output before using it in production.</p>
      <h2>Accuracy</h2>
      <p>The calculations are tested, but no software is perfect. If you find a mistake please tell us on the <Link href="/contact">contact page</Link>. We aren’t responsible for losses from errors, omissions or reliance on a result.</p>
    </LegalPage>
  );
}
