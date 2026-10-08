import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";
import type { CategoryDef, ToolDefinition } from "@/tools/types";
import { toolPath } from "@/tools/registry";

const OG_IMAGE = { url: "/og-default.png", width: 1200, height: 630, alt: `${SITE.name} — ${SITE.tagline}` };

type PageMeta = { title: string; description: string; path: string; noindex?: boolean; absoluteTitle?: boolean };

export function pageMetadata({ title, description, path, noindex, absoluteTitle }: PageMeta): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { type: "website", siteName: SITE.name, title: fullTitle, description, url: absoluteUrl(path), images: [OG_IMAGE], locale: "en_US" },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [OG_IMAGE.url] },
  };
}

export const toolMetadata = (t: ToolDefinition): Metadata => pageMetadata({ title: t.seoTitle, description: t.seoDescription, path: toolPath(t) });
export const categoryMetadata = (c: CategoryDef): Metadata => pageMetadata({ title: c.seoTitle, description: c.seoDescription, path: `/${c.id}` });

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
  };
}

export function websiteJsonLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: absoluteUrl("/"), description: SITE.description, inLanguage: SITE.locale };
}

/** Serialise JSON-LD safely for inclusion in a <script> tag (escapes characters that could close the tag). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
