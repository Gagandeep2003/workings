import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/tools/categories";
import { TOOL_BY_ID, TOOLS, recentlyAdded } from "@/tools/registry";
import { collectionJsonLd, jsonLdString, pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ToolRow } from "@/components/ToolCard";
import { Icon, type IconName } from "@/components/Icon";

export const metadata: Metadata = pageMetadata({
  title: "All Calculators and Tools — Full Directory",
  description: "Every free calculator, converter, exam score tool and developer utility on Workings in one list, grouped by category and linked directly.",
  path: "/tools",
});

export default function ToolDirectory() {
  const crumbs = [{ name: "Home", path: "/" }, { name: "All tools", path: "/tools" }];
  const newIds = new Set(recentlyAdded(8).map((t) => t.id));
  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(collectionJsonLd("All calculators and tools", "/tools", "Directory of every tool on Workings, grouped by category.", TOOLS, crumbs)) }} />
      <Breadcrumbs crumbs={crumbs} />
      <header className="page-head">
        <h1>All calculators and tools</h1>
        <p className="page-head__intro">{TOOLS.length} free tools in {CATEGORIES.length} categories. Pick a category or scroll the full list.</p>
        <ul className="chips" style={{ justifyContent: "flex-start" }} aria-label="Jump to a category">
          {CATEGORIES.map((c) => <li key={c.id}><a className="chip" href={`#${c.id}`}>{c.name}</a></li>)}
        </ul>
      </header>
      {CATEGORIES.map((c) => {
        const ids = [...new Set(c.groups.flatMap((g) => g.toolIds))];
        return (
          <section key={c.id} id={c.id} className="section" aria-labelledby={`dir-${c.id}`} data-cat={c.id}>
            <div className="section__head section__head--cat">
              <span className="cat-icon cat-icon--sm"><Icon name={c.icon as IconName} /></span>
              <div className="section__head-text"><h2 id={`dir-${c.id}`}>{c.name}</h2><p>{c.tagline}</p></div>
              <Link className="section__link" href={`/${c.id}`}>Open {c.name.toLowerCase()} page →</Link>
            </div>
            <div className="row-grid">{ids.map((id) => <ToolRow key={id} tool={TOOL_BY_ID.get(id)!} isNew={newIds.has(id)} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
