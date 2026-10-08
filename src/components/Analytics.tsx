"use client";
import { useEffect } from "react";
import { configureAnalytics, createAdapter, trackEvent, type EventName, type EventProps } from "@/lib/analytics";
import type { PublicMonetization } from "@/config/monetization";

/** Wires the analytics abstraction to the configured provider (if any). Renders nothing. */
export function AnalyticsConfigurator({ config }: { config: PublicMonetization["analytics"] }) {
  if (config) {
    const w = globalThis as typeof globalThis & { plausible?: ((...a: unknown[]) => void) & { q?: unknown[] } };
    if (config.provider === "plausible" && !w.plausible) {
      // Plausible's own queue stub, so events fired before its script loads aren't lost.
      const queue: unknown[] = [];
      w.plausible = Object.assign((...args: unknown[]) => { queue.push(args); }, { q: queue });
    }
    configureAnalytics(createAdapter(config.provider));
  } else configureAnalytics(null);
  return null;
}

/** Fires one anonymous event when a page is viewed. */
export function TrackView({ event, props }: { event: EventName; props: EventProps }) {
  useEffect(() => { trackEvent(event, props); }, [event, props]);
  return null;
}
