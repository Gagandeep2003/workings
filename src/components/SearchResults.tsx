"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { search, type SearchEntry } from "@/lib/search";
import { SearchBox } from "./SearchBox";

const NAMES: Record<string, string> = { math: "Math", everyday: "Everyday", student: "Student", career: "Career", money: "Money", developer: "Developer", exams: "Exams" };

export function SearchResults() {
  const q = (useSearchParams().get("q") ?? "").slice(0, 100);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { fetch("/search-index.json").then((r) => r.json()).then(setIndex).catch(() => setFailed(true)); }, []);
  const results = index && q ? search(index, q, 30) : [];
  return (
    <div>
      <SearchBox variant="page" initialQuery={q} placeholder="What do you want to calculate, convert or check?" ariaLabel="Search tools" />
      <div style={{ marginTop: "var(--s-6)" }} role="status" aria-live="polite">
        {failed && <p>Search couldn’t load. Please browse the categories instead.</p>}
        {!failed && !index && <p>Loading…</p>}
        {index && q && <p style={{ color: "var(--text-2)" }}>{results.length} result{results.length === 1 ? "" : "s"} for “{q}”</p>}
        {index && !q && <p style={{ color: "var(--text-2)" }}>Type above to search all tools.</p>}
      </div>
      {results.length > 0 && (
        <ul className="grid grid--2" style={{ listStyle: "none", marginTop: "var(--s-4)" }}>
          {results.map((r) => (
            <li key={r.i}>
              <Link href={r.p} className="card tool-card" data-cat={r.c}>
                <span className="tool-card__top"><span className="tool-card__title">{r.t}</span><span className="chip-cat">{NAMES[r.c]}</span></span>
                <span className="tool-card__desc">{r.d}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {index && q && results.length === 0 && (
        <div className="empty-state">
          <h2>Nothing found for “{q}”</h2>
          <p>Try a simpler word, such as “percent”, “loan”, “age” or “json”, or browse a category.</p>
          <ul className="chips">{Object.entries(NAMES).map(([id, name]) => <li key={id}><Link className="chip" href={`/${id}`}>{name}</Link></li>)}</ul>
        </div>
      )}
    </div>
  );
}
