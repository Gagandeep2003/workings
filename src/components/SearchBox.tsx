"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { search as runSearch, type SearchEntry } from "@/lib/search";
import { trackEvent } from "@/lib/analytics";

type Entry = SearchEntry & { pop?: 1 };
const CATEGORY_NAMES: Record<string, string> = { math: "Math", everyday: "Everyday", student: "Student", career: "Career", money: "Money", developer: "Developer", exams: "Exams" };

let indexPromise: Promise<Entry[]> | null = null;
function loadIndex(): Promise<Entry[]> {
  indexPromise ??= fetch("/search-index.json")
    .then((r) => { if (!r.ok) throw new Error("index"); return r.json() as Promise<Entry[]>; })
    .catch((e) => { indexPromise = null; throw e; });
  return indexPromise;
}

type Props = { variant: "hero" | "header" | "page"; placeholder?: string; autoFocus?: boolean; initialQuery?: string; inputId?: string; ariaLabel?: string };

export function SearchBox({ variant, placeholder = "Search tools…", autoFocus, initialQuery = "", inputId, ariaLabel = "Search tools" }: Props) {
  const router = useRouter();
  const uid = useId();
  const listId = `${uid}-list`;
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeRaw, setActive] = useState<number | null>(null);
  const [index, setIndex] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ensureIndex = useCallback(() => {
    if (index || failed) return;
    loadIndex().then(setIndex).catch(() => setFailed(true));
  }, [index, failed]);

  useEffect(() => {
    if (variant !== "hero") return;
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const t = idle ? idle(ensureIndex) : window.setTimeout(ensureIndex, 800);
    return () => { if (!idle) window.clearTimeout(t as number); };
  }, [variant, ensureIndex]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const trimmed = query.trim();
  const results = useMemo(() => {
    if (!index) return [];
    if (!trimmed) return index.filter((e) => e.pop).slice(0, 6);
    return runSearch(index, trimmed, 8) as Entry[];
  }, [index, trimmed]);
  const showingPopular = !trimmed;

  const active = activeRaw !== null && activeRaw < results.length ? activeRaw : trimmed && results.length ? 0 : -1;

  const go = (entry: Entry) => {
    trackEvent("tool_search", { resultCount: results.length, queryLength: trimmed.length });
    setOpen(false);
    inputRef.current?.blur();
    router.push(entry.p);
  };
  const submitAll = () => {
    if (!trimmed) return;
    trackEvent("tool_search", { resultCount: results.length, queryLength: trimmed.length });
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (results.length) setActive((active + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (results.length) setActive(active <= 0 ? results.length - 1 : active - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && results[active]) go(results[active]);
      else if (trimmed) submitAll();
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); setOpen(false); }
      else if (query) { e.preventDefault(); setQuery(""); }
    }
  };

  const panelVisible = open && (index !== null || failed);
  const statusText = !open ? "" : !index ? (failed ? "" : "Loading tools…") : trimmed ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Popular tools";

  return (
    <div className={`search search--${variant}`} ref={wrapRef}>
      <div className="search__field">
        <Icon name="search" className="search__icon" />
        <input
          ref={inputRef}
          type="search"
          className="search__input"
          role="combobox"
          aria-expanded={panelVisible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={panelVisible && active >= 0 ? `${uid}-opt-${active}` : undefined}
          id={inputId}
          aria-label={inputId ? undefined : ariaLabel}
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          onChange={(e) => { setQuery(e.target.value); setActive(null); setOpen(true); ensureIndex(); }}
          onFocus={() => { setOpen(true); ensureIndex(); }}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button type="button" className="search__clear" aria-label="Clear search" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
            <Icon name="close" className="icon" style={{ width: "1rem", height: "1rem" }} />
          </button>
        )}
      </div>
      <div className="sr-only" role="status" aria-live="polite">{statusText}</div>
      {open && (
        <div className="search__panel" hidden={!panelVisible && !!index}>
          {!index && !failed && <p className="search__status">Loading tools…</p>}
          {failed && (
            <div className="search__status">
              Search couldn’t load. Browse by category instead:
              <ul className="chips" style={{ justifyContent: "flex-start" }}>{Object.entries(CATEGORY_NAMES).map(([id, name]) => <li key={id}><Link className="chip" href={`/${id}`}>{name}</Link></li>)}</ul>
            </div>
          )}
          {index && results.length > 0 && (
            <>
              {showingPopular && <div className="search__heading">Popular tools</div>}
              <ul className="search__list" id={listId} role="listbox" aria-label={showingPopular ? "Popular tools" : "Search results"}>
                {results.map((r, i) => (
                  <li
                    key={r.i}
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="search__option"
                    onMouseEnter={() => setActive(i)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => go(r)}
                  >
                    <span className="search__option-main">
                      <span className="search__option-title" style={{ display: "block" }}>{r.t}</span>
                      <span className="search__option-desc" style={{ display: "block" }}>{r.d}</span>
                    </span>
                    <span className="chip-cat" data-cat={r.c}>{CATEGORY_NAMES[r.c] ?? r.c}</span>
                  </li>
                ))}
              </ul>
              {trimmed && <p className="search__hint">↑ ↓ to move · Enter to open · Esc to close</p>}
            </>
          )}
          {index && results.length === 0 && trimmed && (
            <div className="search__status" id={listId}>
              <strong>No tools match “{trimmed.slice(0, 60)}”.</strong>
              <p style={{ marginTop: "var(--s-1)" }}>Try a simpler word (for example “percent”, “loan” or “json”), or browse a category:</p>
              <ul className="chips" style={{ justifyContent: "flex-start" }}>{Object.entries(CATEGORY_NAMES).map(([id, name]) => <li key={id}><Link className="chip" href={`/${id}`}>{name}</Link></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
