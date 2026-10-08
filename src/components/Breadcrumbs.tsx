import Link from "next/link";
import type { Crumb } from "@/lib/seo";

/** Visible breadcrumb trail; the matching BreadcrumbList JSON-LD is emitted by the page. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.path}>
            {i === crumbs.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.path}>{c.name}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
