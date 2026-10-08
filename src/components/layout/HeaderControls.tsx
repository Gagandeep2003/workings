"use client";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "../Icon";
import { MainNav, type NavItem } from "./MainNav";
import { SearchBox } from "../SearchBox";

/** Mobile search and menu. Panels drop down under the header (not a full-screen overlay) and close on navigation or Escape. */
export function HeaderControls({ items }: { items: NavItem[] }) {
  const [state, setState] = useState<{ open: "menu" | "search" | null; path: string }>({ open: null, path: "" });
  const pathname = usePathname();
  // a panel opened on one page is considered closed once the route changes
  const open = state.path === pathname ? state.open : null;
  const setOpen = (o: "menu" | "search" | null) => setState({ open: o, path: pathname });
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    const onDown = (e: PointerEvent) => {
      const header = wrapRef.current?.closest(".site-header");
      if (header && !header.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={wrapRef} className="site-header__actions">
      <button type="button" className="icon-btn" aria-label="Search tools" aria-expanded={open === "search"} aria-controls={panelId} onClick={() => setOpen(open === "search" ? null : "search")}>
        <Icon name={open === "search" ? "close" : "search"} />
      </button>
      <button type="button" className="icon-btn" aria-label="Browse categories" aria-expanded={open === "menu"} aria-controls={panelId} onClick={() => setOpen(open === "menu" ? null : "menu")}>
        <Icon name={open === "menu" ? "close" : "menu"} />
      </button>
      {open && (
        <div className="mobile-panel" id={panelId}>
          <div className="container">
            {open === "search" ? <SearchBox variant="page" autoFocus placeholder="Search calculators, converters, tools…" /> : <MainNav items={items} variant="list" />}
          </div>
        </div>
      )}
    </div>
  );
}
