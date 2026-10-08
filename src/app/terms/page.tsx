import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { SITE, STATIC_PAGES } from "@/lib/site";

const page = STATIC_PAGES.find((p) => p.path === "/terms")!;
export const metadata = pageMetadata({ title: "Terms of Use", description: page.description, path: "/terms" });

export default function Terms() {
  return (
    <LegalPage title="Terms of use" path="/terms" updated intro={`By using ${SITE.name} you agree to these terms. They are written to be short and readable.`}>
      <h2>Using the site</h2>
      <p>You may use the calculators, converters and tools for personal or professional purposes, free of charge. Please don’t misuse the site: no attempts to disrupt it, overload it with automated requests, or scrape it at a rate that affects other visitors.</p>
      <h2>Information, not advice</h2>
      <p>Results and explanations are provided for general information. They are not financial, tax, legal, academic, medical or other professional advice, and you are responsible for decisions you make using them. See the <Link href="/disclaimer">disclaimer</Link>.</p>
      <h2>No warranty</h2>
      <p>We work to make the calculations correct and say where rules apply, but the site is provided “as is”, without warranties of any kind, to the extent the law allows. We don’t guarantee that results are free of error, complete, current or suitable for your purpose, or that the site will always be available.</p>
      <h2>Limitation of liability</h2>
      <p>To the extent permitted by law, the site owner isn’t liable for losses arising from your use of, or reliance on, the site or its results. Nothing here limits liability that cannot lawfully be limited.</p>
      <h2>Content and ownership</h2>
      <p>The text, design and code of the site belong to its owner. You may link to any page. You may quote short extracts with a link back, but please don’t copy whole pages or tools. Formulas, unit definitions and public rules are not owned by anyone.</p>
      <h2>Links to other sites</h2>
      <p>The site links to external websites, including official sources and sponsored or affiliate links. We aren’t responsible for their content or practices. See the <Link href="/advertising-disclosure">advertising and affiliate disclosure</Link>.</p>
      <h2>Changes</h2>
      <p>We may update the tools and these terms. The revision date above changes when the terms change; continuing to use the site means you accept the current version.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: see the <Link href="/contact">contact page</Link>.</p>
    </LegalPage>
  );
}
