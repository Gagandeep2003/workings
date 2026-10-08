"use client";
import { useEffect } from "react";

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

/** One AdSense unit. Rendered only when AdSense is fully configured; the surrounding box reserves its height. */
export function AdsenseUnit({ client, slot }: { client: string; slot: string }) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blockers or script failures must never affect the page */
    }
  }, []);
  return <ins className="adsbygoogle" style={{ display: "block" }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />;
}
