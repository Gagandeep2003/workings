import Link from "next/link";
import type { Metadata } from "next";
import { SearchBox } from "@/components/SearchBox";
import { POPULAR_TOOL_IDS, TOOL_BY_ID, toolPath } from "@/tools/registry";
import { CATEGORIES } from "@/tools/categories";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div className="container">
      <div className="empty-state">
        <h1>That page doesn’t exist</h1>
        <p>The address may be mistyped or the tool may have moved. Search for what you need:</p>
        <div style={{ maxWidth: "30rem", margin: "var(--s-5) auto 0", textAlign: "left" }}><SearchBox variant="page" ariaLabel="Search tools" placeholder="Search calculators, converters, tools…" /></div>
        <ul className="chips">{POPULAR_TOOL_IDS.slice(0, 6).map((id) => { const t = TOOL_BY_ID.get(id)!; return <li key={id}><Link className="chip" href={toolPath(t)}>{t.title}</Link></li>; })}</ul>
        <ul className="chips">{CATEGORIES.map((c) => <li key={c.id}><Link className="chip" href={`/${c.id}`}>{c.name}</Link></li>)}</ul>
      </div>
    </div>
  );
}
