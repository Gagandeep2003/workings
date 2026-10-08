import type { Metadata } from "next";
import { Breadcrumbs } from "./Breadcrumbs";
import { SITE } from "@/lib/site";
import { formatDateShort, parseISODate } from "@/lib/dates";
import { breadcrumbJsonLd, jsonLdString } from "@/lib/seo";

export function LegalPage({ title, path, intro, updated, children }: { title: string; path: string; intro?: string; updated?: boolean; children: React.ReactNode }) {
  const crumbs = [{ name: "Home", path: "/" }, { name: title, path }];
  const d = parseISODate(SITE.legalUpdated);
  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs)) }} />
      <Breadcrumbs crumbs={crumbs} />
      <article className="prose" style={{ paddingBottom: "var(--s-8)" }}>
        <h1>{title}</h1>
        {intro && <p style={{ fontSize: "var(--fs-lg)" }}>{intro}</p>}
        {updated && d && <p style={{ color: "var(--text-3)", fontSize: "var(--fs-sm)" }}>Last revised {formatDateShort(d)}.</p>}
        {children}
      </article>
    </div>
  );
}

export type { Metadata };
