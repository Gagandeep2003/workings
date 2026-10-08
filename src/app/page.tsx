import Link from "next/link";
import type { Metadata } from "next";
import { CATEGORIES } from "@/tools/categories";
import { POPULAR_TOOL_IDS, TOOL_BY_ID, TOOLS, toolPath } from "@/tools/registry";
import { pageMetadata, jsonLdString, websiteJsonLd } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { SearchBox } from "@/components/SearchBox";
import { ToolCard, CategoryCard } from "@/components/ToolCard";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = pageMetadata({
  title: `${SITE.name} — Calculators, Converters and Developer Tools`,
  description: SITE.description,
  path: "/",
  absoluteTitle: true,
});

const SPOTLIGHT = ["student", "money", "developer"] as const;
const CHIP_IDS = ["percentage-calculator", "emi-calculator", "age-calculator", "cgpa-to-percentage-calculator", "json-formatter", "unit-converter"];

export default function Home() {
  const popular = POPULAR_TOOL_IDS.map((id) => TOOL_BY_ID.get(id)!);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd()) }} />
      <section className="hero" aria-labelledby="hero-title">
        <div className="container">
          <div className="hero__inner">
            <p className="hero__eyebrow">Free · No sign-up · Runs in your browser</p>
            <h1 id="hero-title">Get the answer. <em>See the working.</em></h1>
            <p className="hero__sub">Calculators, converters and developer tools where every result comes with the formula behind it.</p>
            <div className="hero__search">
              <label htmlFor="hero-search-input">What do you want to calculate, convert, check, or generate?</label>
              <HeroSearch />
            </div>
            <ul className="chips" aria-label="Popular searches">
              {CHIP_IDS.map((id) => { const t = TOOL_BY_ID.get(id)!; return <li key={id}><Link className="chip" href={toolPath(t)}>{t.title.replace(/ Calculator$/, "")}</Link></li>; })}
            </ul>
          </div>
        </div>
      </section>

      <div className="container">
        <section className="section" aria-labelledby="popular-title">
          <div className="section__head"><h2 id="popular-title">Popular tools</h2><p>The ones most people come for.</p></div>
          <div className="grid grid--3">{popular.map((t) => <ToolCard key={t.id} tool={t} />)}</div>
        </section>

        <section className="section" aria-labelledby="cats-title">
          <div className="section__head"><h2 id="cats-title">Browse by category</h2><p>{TOOLS.length} tools in {CATEGORIES.length} categories.</p></div>
          <div className="grid grid--3">
            {CATEGORIES.map((c) => <CategoryCard key={c.id} category={c} count={TOOLS.filter((t) => t.category === c.id).length} />)}
          </div>
        </section>

        <section className="section" aria-labelledby="how-title">
          <div className="section__head"><h2 id="how-title">How this site works</h2></div>
          <div className="pillars">
            <div className="card pillar"><h3><Icon name="bolt" style={{ verticalAlign: "-0.2em", marginRight: 6, color: "var(--accent-text)" }} />Answer first</h3><p>Open a tool and use it straight away. There’s no account, no pop-up and nothing to install.</p></div>
            <div className="card pillar"><h3><Icon name="formula" style={{ verticalAlign: "-0.2em", marginRight: 6, color: "var(--accent-text)" }} />Working shown</h3><p>Each result lists the steps with your numbers, and each page explains the formula, a worked example and the assumptions made.</p></div>
            <div className="card pillar"><h3><Icon name="lock" style={{ verticalAlign: "-0.2em", marginRight: 6, color: "var(--accent-text)" }} />Stays on your device</h3><p>Calculations run in your browser. What you type isn’t sent to a server, and developer tools never upload your data.</p></div>
          </div>
        </section>

        {SPOTLIGHT.map((id) => {
          const cat = CATEGORIES.find((c) => c.id === id)!;
          const ids = cat.groups.flatMap((g) => g.toolIds).slice(0, 4);
          return (
            <section className="section" key={id} aria-labelledby={`spot-${id}`} data-cat={id}>
              <div className="section__head">
                <h2 id={`spot-${id}`}>{cat.name}</h2>
                <Link className="section__link" href={`/${id}`}>All {cat.name.toLowerCase()} tools →</Link>
              </div>
              <div className="grid grid--4">{ids.map((tid) => <ToolCard key={tid} tool={TOOL_BY_ID.get(tid)!} />)}</div>
            </section>
          );
        })}

        <section className="section" aria-labelledby="trust-title">
          <div className="card pillar" style={{ padding: "var(--s-6)" }}>
            <h2 id="trust-title" style={{ fontSize: "var(--fs-lg)" }}>How accuracy is handled</h2>
            <p style={{ marginTop: "var(--s-2)", maxWidth: "46rem" }}>
              Every calculation is plain, tested code — never guessed. Rules that depend on a country, year or exam are labelled with their source and the date they were last checked, and anything uncertain is left out. Read more about the <Link href="/about">methodology</Link> or tell us about a mistake on the <Link href="/contact">contact page</Link>.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function HeroSearch() {
  return <SearchBox variant="hero" inputId="hero-search-input" placeholder="Try “15% of 240”, “EMI”, “days between dates” or “JSON”" />;
}
