import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";
import type { CategoryDef, CategoryId, ToolDefinition } from "@/tools/types";
import { TOOL_BY_ID, toolPath } from "@/tools/registry";
import { plainText as flatten } from "./rich";

const plainText = (text: string) => flatten(text, (id) => TOOL_BY_ID.get(id)?.title);

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

const ID = {
  website: () => `${SITE.url}/#website`,
  publisher: () => `${SITE.url}/#publisher`,
};

/** Publisher entity — emitted only when the site owner has configured an accurate name AND type (see .env.example). */
function publisherNode() {
  if (!SITE.operatorName || !SITE.operatorType) return null;
  return {
    "@type": SITE.operatorType === "person" ? "Person" : "Organization",
    "@id": ID.publisher(),
    name: SITE.operatorName,
    url: absoluteUrl("/"),
    ...(SITE.contactEmail && SITE.operatorType === "organization" ? { email: SITE.contactEmail } : {}),
  };
}

/** Home-page structured data: the WebSite (with an on-site search action that really works) and, if configured, its publisher. */
export function websiteJsonLd() {
  const publisher = publisherNode();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": ID.website(),
        name: SITE.name,
        url: absoluteUrl("/"),
        description: SITE.description,
        inLanguage: SITE.locale,
        ...(publisher ? { publisher: { "@id": ID.publisher() } } : {}),
        potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
      },
      ...(publisher ? [publisher] : []),
    ],
  };
}

/** schema.org applicationCategory values (free text, but these are the recognised ones). */
const APP_CATEGORY: Record<CategoryId, string> = {
  math: "EducationalApplication", everyday: "UtilitiesApplication", student: "EducationalApplication", career: "BusinessApplication",
  money: "FinanceApplication", developer: "DeveloperApplication", exams: "EducationalApplication", "image-pdf": "MultimediaApplication",
};

/**
 * Tool page structured data. Every property describes something visible on the page: the breadcrumb trail, the free
 * in-browser tool itself and — only when the page really shows them — its questions and answers. No ratings, reviews or prices.
 */
export function toolJsonLd(t: ToolDefinition, crumbs: Crumb[]) {
  const url = absoluteUrl(toolPath(t));
  const publisher = publisherNode();
  const graph: Record<string, unknown>[] = [
    breadcrumbNode(crumbs),
    {
      "@type": "WebApplication",
      "@id": `${url}#tool`,
      name: t.title,
      url,
      description: t.seoDescription,
      applicationCategory: APP_CATEGORY[t.category],
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      isAccessibleForFree: true,
      ...(t.client && t.specs ? { featureList: t.specs.map((s) => `${s.label}: ${s.value}`) } : {}),
      inLanguage: SITE.locale,
      isPartOf: { "@id": ID.website() },
      ...(publisher ? { publisher: { "@id": ID.publisher() } } : {}),
      ...(t.addedOn ? { datePublished: t.addedOn } : {}),
      ...(t.lastModified || t.regulatory?.reviewedOn ? { dateModified: t.lastModified ?? t.regulatory?.reviewedOn } : {}),
    },
  ];
  if (t.faqs?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: t.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plainText(f.a) } })),
    });
  }
  if (publisher) graph.push(publisher);
  return { "@context": "https://schema.org", "@graph": graph };
}

/** Category (and directory) pages: a collection that lists real, linked tools. */
export function collectionJsonLd(name: string, path: string, description: string, tools: ToolDefinition[], crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbNode(crumbs),
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl(path)}#page`,
        name,
        url: absoluteUrl(path),
        description,
        isPartOf: { "@id": ID.website() },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: tools.length,
          itemListElement: tools.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(toolPath(t)), name: t.title })),
        },
      },
    ],
  };
}

function breadcrumbNode(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
  };
}

/** Serialise JSON-LD safely for inclusion in a <script> tag (escapes characters that could close the tag). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
