import Link from "next/link";
import type { Metadata } from "next";
import { CATEGORIES } from "@/tools/categories";
import { HOME } from "@/tools/home";
import { TOOL_BY_ID, TOOLS, recentlyAdded, toolPath } from "@/tools/registry";
import { pageMetadata, jsonLdString, websiteJsonLd } from "@/lib/seo";
import { SearchBox } from "@/components/SearchBox";
import { ToolCard, ToolRow, CategoryCard } from "@/components/ToolCard";
import { Icon, type IconName } from "@/components/Icon";
import { ToolIcon } from "@/components/ToolIcon";

export const metadata: Metadata = pageMetadata({
  title: "Workings — Free Online Calculators, Image & PDF Tools",
  description: "Free online calculators plus image and PDF tools: percentage, EMI, SIP, CGPA, compress images, merge PDFs and more. No sign-up; your files stay on your device.",
  path: "/",
  absoluteTitle: true,
});

const need = (id: string) => {
  const t = TOOL_BY_ID.get(id);
  if (!t) throw new Error(`Home page references unknown tool "${id}"`);
  return t;
};

export default function Home() {
  const toolCount = TOOLS.length;
  const roundedCount = Math.floor(toolCount / 10) * 10; // "130+" is only ever claimed when at least 130 tools exist
  const recent = recentlyAdded(8);
  const newIds = new Set(recent.map((t) => t.id));
  const countFor = (id: string) => TOOLS.filter((t) => t.category === id).length;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd()) }} />

      <section className="hero" aria-labelledby="hero-title">
        <div className="container">
          <div className="hero__inner">
            <p className="hero__eyebrow">Free · No sign-up · Runs in your browser</p>
            <h1 id="hero-title">Free online calculators and file tools for everyday questions.</h1>
            <p className="hero__sub">Calculate faster with {roundedCount}+ free tools for maths, money, studies, career, images and PDFs, and development.</p>
            <div className="hero__search">
              <label htmlFor="hero-search-input" className="sr-only">Search all {toolCount} tools</label>
              <SearchBox variant="hero" inputId="hero-search-input" placeholder="Search tools — try “15% of 240”, “EMI”, “compress image” or “JSON”" />
            </div>
            <ul className="chips" aria-label="Popular searches">
              {HOME.searchChips.map((id) => { const t = need(id); return <li key={id}><Link className="chip" href={toolPath(t)}>{t.title.replace(/ (Calculator|Formatter)$/, "")}</Link></li>; })}
            </ul>
          </div>
        </div>
      </section>

      <div className="container">
        <section className="section" aria-labelledby="popular-title">
          <div className="section__head"><h2 id="popular-title">Popular tools</h2><Link className="section__link" href="/tools">Browse all {toolCount} →</Link></div>
          <div className="grid grid--4">{HOME.popular.map((id) => <ToolCard key={id} tool={need(id)} isNew={newIds.has(id)} />)}</div>
        </section>

        <section className="section" aria-labelledby="cats-title">
          <div className="section__head"><h2 id="cats-title">Browse by category</h2><p>{toolCount} tools in {CATEGORIES.length} categories</p></div>
          <div className="grid grid--4 grid--cats">
            {CATEGORIES.map((c) => <CategoryCard key={c.id} category={c} count={countFor(c.id)} />)}
          </div>
        </section>

        {recent.length >= 3 && (
          <section className="section" aria-labelledby="recent-title">
            <div className="section__head"><h2 id="recent-title">Recently added</h2><p>The newest calculators and converters.</p></div>
            <div className="row-grid">{recent.map((t) => <ToolRow key={t.id} tool={t} isNew />)}</div>
          </section>
        )}

        {HOME.sections.map((s) => {
          const cat = CATEGORIES.find((c) => c.id === s.category)!;
          return (
            <section className="section" key={s.key} aria-labelledby={`sec-${s.key}`} data-cat={s.category}>
              <div className="section__head section__head--cat">
                <span className="cat-icon cat-icon--sm"><Icon name={cat.icon as IconName} /></span>
                <div className="section__head-text"><h2 id={`sec-${s.key}`}>{s.title}</h2><p>{s.blurb}</p></div>
                <Link className="section__link" href={`/${s.category}`}>All {cat.name.toLowerCase()} tools →</Link>
              </div>
              <div className="row-grid">{s.ids.map((id) => <ToolRow key={id} tool={need(id)} isNew={newIds.has(id)} />)}</div>
            </section>
          );
        })}

        <section className="section" aria-label="How Workings works">
          <ul className="trust-strip">
            <li><ToolIcon name="bolt" /><span><strong>Answer first.</strong> Use any tool straight away, with no account or pop-ups.</span></li>
            <li><ToolIcon name="formula" /><span><strong>Working shown.</strong> Every result lists its steps, formula and assumptions.</span></li>
            <li><ToolIcon name="lock" /><span><strong>Private by design.</strong> Calculations run in your browser; inputs are not uploaded.</span></li>
          </ul>
          <p className="trust-note">Rules that depend on a country, year or exam carry their source and review date. See the <Link href="/about">methodology</Link>, or report a mistake on the <Link href="/contact">contact page</Link>.</p>
        </section>
      </div>
    </>
  );
}
