import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { AI_SEARCH_BOTS, AI_TRAINING_BOTS } from "@/lib/llms";

export type AiPolicy = "allow" | "search-only" | "block";

/**
 * Public content is fully crawlable (CSS, JS and all). Preview deployments are kept out of search engines.
 *
 * AI crawlers are governed by AI_CRAWLERS (see .env.example):
 *   allow        (default) every crawler may read the site, so assistants and answer engines can cite it
 *   search-only  assistants that fetch pages to answer a question may read the site; crawlers that collect training data may not
 *   block        no AI crawler may read the site
 * Blocking a training crawler does not affect Google Search or Bing rankings. `robots.txt` is a request that well-behaved crawlers honour,
 * not an access control.
 */
export function robotsConfig(env: { vercelEnv?: string; aiPolicy?: string; siteUrl: string }): MetadataRoute.Robots {
  const isPreview = !!env.vercelEnv && env.vercelEnv !== "production";
  if (isPreview) return { rules: { userAgent: "*", disallow: "/" } };
  const policy: AiPolicy = env.aiPolicy === "block" || env.aiPolicy === "search-only" ? env.aiPolicy : "allow";
  const rules: MetadataRoute.Robots["rules"] = [{ userAgent: "*", allow: "/" }];
  if (policy === "allow") rules.push({ userAgent: [...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS], allow: "/" });
  if (policy === "search-only") rules.push({ userAgent: AI_SEARCH_BOTS, allow: "/" }, { userAgent: AI_TRAINING_BOTS, disallow: "/" });
  if (policy === "block") rules.push({ userAgent: [...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS], disallow: "/" });
  return { rules, sitemap: `${env.siteUrl}/sitemap.xml` };
}

export default function robots(): MetadataRoute.Robots {
  return robotsConfig({ vercelEnv: process.env.VERCEL_ENV, aiPolicy: process.env.AI_CRAWLERS, siteUrl: SITE.url });
}
