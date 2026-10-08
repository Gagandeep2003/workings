import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_BY_ID, isCategoryId } from "@/tools/categories";
import { TOOL_BY_ID } from "@/tools/registry";
import { categoryMetadata, breadcrumbJsonLd, jsonLdString } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ToolCard } from "@/components/ToolCard";
import { Icon, type IconName } from "@/components/Icon";
import { TrackView } from "@/components/Analytics";
import { Placement } from "@/components/monetization/Placements";

export const dynamicParams = false;
export const generateStaticParams = () => CATEGORIES.map((c) => ({ category: c.id }));

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  return isCategoryId(category) ? categoryMetadata(CATEGORY_BY_ID.get(category)!) : {};
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isCategoryId(category)) notFound();
  const cat = CATEGORY_BY_ID.get(category)!;
  const crumbs = [{ name: "Home", path: "/" }, { name: cat.name, path: `/${cat.id}` }];
  const others = CATEGORIES.filter((c) => c.id !== cat.id);
  return (
    <div className="container" data-cat={cat.id}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs)) }} />
      <TrackView event="category_view" props={{ category: cat.id }} />
      <Breadcrumbs crumbs={crumbs} />
      <header className="page-head" style={{ maxWidth: "56rem" }}>
        <span className="cat-icon" style={{ marginBottom: "var(--s-3)" }}><Icon name={cat.icon as IconName} /></span>
        <h1>{cat.name === "Exams" ? "Exam score calculators" : `${cat.name} calculators and tools`}</h1>
        <p className="page-head__intro">{cat.tagline}.</p>
        <div className="copy" style={{ marginTop: "var(--s-4)", display: "grid", gap: "var(--s-3)" }}>{cat.intro.map((p) => <p key={p}>{p}</p>)}</div>
      </header>
      <Placement placement="top" category={cat.id} />
      {cat.groups.map((g) => (
        <section key={g.title} className="section" aria-labelledby={`g-${g.title.replace(/\W+/g, "-")}`}>
          <div className="section__head">
            <h2 id={`g-${g.title.replace(/\W+/g, "-")}`}>{g.title}</h2>
            {g.description && <p>{g.description}</p>}
          </div>
          <div className="grid grid--3">
            {g.toolIds.map((id) => <ToolCard key={id} tool={TOOL_BY_ID.get(id)!} />)}
          </div>
        </section>
      ))}
      <section className="section" aria-labelledby="other-cats">
        <div className="section__head"><h2 id="other-cats">Other categories</h2></div>
        <ul className="chips" style={{ justifyContent: "flex-start" }}>
          {others.map((c) => <li key={c.id}><Link className="chip" href={`/${c.id}`}>{c.name}</Link></li>)}
        </ul>
      </section>
    </div>
  );
}
