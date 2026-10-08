"use client";
import { useEffect, useMemo, useRef } from "react";
import { useMounted } from "@/lib/useMounted";
import type { Sponsor } from "@/config/sponsors";
import { activeSponsors, detectRegion } from "@/lib/monetization/select";
import { localTodayISO } from "@/lib/dates";
import { trackEvent } from "@/lib/analytics";

/**
 * Direct sponsorship. Candidates come from src/config/sponsors.ts via the server; the date window and region are
 * re-checked here so an expired sponsor disappears even from old static pages. Renders nothing unless something qualifies.
 */
export function SponsorSlot({ candidates, ctx }: { candidates: Sponsor[]; ctx: { toolId?: string; category?: string } }) {
  const mounted = useMounted();
  const ref = useRef<HTMLElement | null>(null);
  const fired = useRef(false);
  const sponsor = useMemo<Sponsor | null>(() => {
    if (!mounted) return null;
    return activeSponsors(candidates, localTodayISO(), detectRegion(navigator.languages))[0] ?? null;
  }, [mounted, candidates]);
  useEffect(() => {
    const el = ref.current;
    if (!sponsor || !el || fired.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting) && !fired.current) { fired.current = true; trackEvent("sponsor_impression", { sponsorId: sponsor.sponsorId, placement: sponsor.placement, toolId: ctx.toolId, category: ctx.category }); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [sponsor, ctx.toolId, ctx.category]);
  if (!sponsor) return null;
  return (
    <aside className="sponsor" ref={ref as React.RefObject<HTMLElement>} aria-label={`Sponsored: ${sponsor.title}`}>
      <span className="sponsor__tag">Sponsored</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {sponsor.image && <img src={sponsor.image} alt="" loading="lazy" width={600} height={300} />}
      <h3>{sponsor.title}</h3>
      <p>{sponsor.description}</p>
      <a
        className="btn btn--secondary btn--sm"
        href={sponsor.destinationUrl}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        onClick={() => trackEvent("sponsor_click", { sponsorId: sponsor.sponsorId, placement: sponsor.placement, toolId: ctx.toolId, category: ctx.category })}
      >
        {sponsor.cta}
        <span className="sr-only"> (opens in a new tab, sponsored link)</span>
      </a>
    </aside>
  );
}
