import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** Public content is fully crawlable (CSS, JS and all). Preview deployments are kept out of search engines. */
export default function robots(): MetadataRoute.Robots {
  const isPreview = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
  if (isPreview) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE.url}/sitemap.xml` };
}
