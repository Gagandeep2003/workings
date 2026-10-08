"use client";
import { useEffect, useMemo, useRef } from "react";
import { useMounted } from "@/lib/useMounted";
import type { AffiliateItem, Region } from "@/config/affiliates";
import { detectRegion, pickAffiliates } from "@/lib/monetization/select";
import { trackEvent } from "@/lib/analytics";
import { AffiliateDisclosure } from "./AffiliateDisclosure";
import { Icon } from "../Icon";

type Ctx = { toolId: string; category: string };

function useVisibleOnce(onVisible: () => void) {
  const ref = useRef<HTMLElement | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !fired.current) { fired.current = true; onVisible(); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

const href = (a: AffiliateItem) => a.trackingUrl ?? a.url;

export function AffiliateCard({ item, ctx }: { item: AffiliateItem; ctx: Ctx }) {
  const ref = useVisibleOnce(() => trackEvent("affiliate_impression", { affiliateId: item.id, toolId: ctx.toolId, category: ctx.category }));
  return (
    <aside className="affiliate" ref={ref as React.RefObject<HTMLElement>} aria-label={`Sponsored: ${item.name}`}>
      <span className="affiliate__tag">Sponsored · {item.merchant}</span>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <a
        className="btn btn--secondary btn--sm"
        href={href(item)}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        onClick={() => trackEvent("affiliate_click", { affiliateId: item.id, toolId: ctx.toolId, category: ctx.category })}
      >
        View {item.merchant} <Icon name="arrow" />
        <span className="sr-only"> (opens in a new tab, sponsored link)</span>
      </a>
    </aside>
  );
}

export function AffiliateRecommendation({ item, ctx }: { item: AffiliateItem; ctx: Ctx }) {
  return (
    <p className="inline-rec">
      <span className="affiliate__tag" style={{ marginBottom: 0 }}>Sponsored · </span>
      <a href={href(item)} target="_blank" rel="sponsored nofollow noopener noreferrer" onClick={() => trackEvent("affiliate_click", { affiliateId: item.id, toolId: ctx.toolId, category: ctx.category })}>{item.name}</a>
      {" — "}{item.description}
    </p>
  );
}

/** Filters server-supplied candidates by the visitor's region (browser language only; unknown = GLOBAL) and renders them below the tool. */
export function AffiliateSlot({ candidates, limit, ctx, variant = "cards" }: { candidates: AffiliateItem[]; limit: number; ctx: Ctx; variant?: "cards" | "inline" }) {
  const mounted = useMounted();
  const items = useMemo(() => {
    if (!mounted) return [];
    const region: Region = detectRegion(navigator.languages);
    return pickAffiliates(candidates, region, limit);
  }, [mounted, candidates, limit]);
  if (items.length === 0) return null;
  return (
    <section className="affiliate-slot" aria-label="Sponsored suggestions">
      {items.map((i) => (variant === "inline" ? <AffiliateRecommendation key={i.id} item={i} ctx={ctx} /> : <AffiliateCard key={i.id} item={i} ctx={ctx} />))}
      {items.some((i) => i.disclosureRequired) && <AffiliateDisclosure />}
    </section>
  );
}
