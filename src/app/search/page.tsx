import { Suspense } from "react";
import { SearchResults } from "@/components/SearchResults";
import { pageMetadata } from "@/lib/seo";

/** Internal search results are for visitors, not for search engines: noindex, but links are still followed. */
export const metadata = pageMetadata({ title: "Search", description: "Search all calculators, converters and developer tools by name, topic or the question you want answered.", path: "/search", noindex: true });

export default function SearchPage() {
  return (
    <div className="container" style={{ paddingTop: "var(--s-6)", paddingBottom: "var(--s-8)" }}>
      <h1 style={{ marginBottom: "var(--s-4)" }}>Search tools</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
