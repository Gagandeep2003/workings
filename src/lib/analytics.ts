"use client";
/**
 * Analytics abstraction. The rest of the app only ever calls trackEvent(name, props).
 * - Disabled automatically unless a provider is configured (ANALYTICS_ENABLED + provider + id).
 * - Only an allow-list of anonymous property keys is ever sent, with strictly validated values, so calculator
 *   inputs, JSON, tokens or any user-typed text can never leak through, even by mistake.
 */
import type { MonetizationConfig } from "@/config/monetization";

export const EVENT_NAMES = [
  "tool_view", "tool_calculation", "tool_result_copy", "tool_result_share", "tool_search", "category_view",
  "affiliate_click", "affiliate_impression", "ad_impression", "sponsor_click", "sponsor_impression",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Property keys that may be sent. Anything else is dropped. */
export const ALLOWED_PROPS = ["toolId", "category", "placement", "affiliateId", "sponsorId", "resultCount", "queryLength", "mode"] as const;
export type EventProps = Partial<Record<(typeof ALLOWED_PROPS)[number], string | number | boolean>>;

const SAFE_STRING = /^[a-z0-9][a-z0-9_.:-]{0,63}$/i;

export function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!props) return out;
  for (const key of ALLOWED_PROPS) {
    const v = props[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.min(Math.max(Math.round(v), 0), 1_000_000);
    else if (typeof v === "boolean") out[key] = v;
    else if (typeof v === "string" && SAFE_STRING.test(v)) out[key] = v;
  }
  return out;
}

export type AnalyticsAdapter = { name: string; send: (event: EventName, props: Record<string, string | number | boolean>) => void };

type W = typeof globalThis & {
  plausible?: (name: string, o?: { props?: Record<string, unknown> }) => void;
  umami?: { track: (name: string, data?: Record<string, unknown>) => void };
};

export function createAdapter(provider: NonNullable<MonetizationConfig["analytics"]>["provider"], w: W = globalThis as W): AnalyticsAdapter {
  if (provider === "plausible") return { name: "plausible", send: (e, p) => w.plausible?.(e, { props: p }) };
  return { name: "umami", send: (e, p) => w.umami?.track(e, p) };
}

let adapter: AnalyticsAdapter | null = null;
export const configureAnalytics = (a: AnalyticsAdapter | null): void => { adapter = a; };
export const analyticsEnabled = (): boolean => adapter !== null;

export function trackEvent(name: EventName, props?: EventProps): void {
  if (!adapter || !EVENT_NAMES.includes(name)) return;
  try {
    adapter.send(name, sanitizeProps(props as Record<string, unknown>));
  } catch {
    /* analytics must never break the page */
  }
}
