import type { NextConfig } from "next";
import { readMonetizationConfig } from "./src/config/monetization";

/**
 * Security headers. The Content-Security-Policy is built from the same monetization switches as the app, so ad and
 * analytics domains are only allowed when those features are actually enabled.
 * 'unsafe-inline' for scripts/styles is required by Next.js' inline bootstrap data without a per-request nonce (which
 * would force every page to render dynamically). There is no user-controlled HTML anywhere in the app, and JSON-LD is escaped.
 */
export function buildCsp(env: Record<string, string | undefined> = process.env): string {
  const m = readMonetizationConfig(env);
  const ads = m.adsEnabled && m.adsenseEnabled;
  const analyticsOrigin = m.analytics ? new URL(m.analytics.scriptSrc).origin : "";
  const google = ["https://pagead2.googlesyndication.com", "https://*.googlesyndication.com", "https://*.google.com", "https://*.doubleclick.net", "https://www.googletagservices.com", "https://adservice.google.com", "https://fundingchoicesmessages.google.com", "https://*.adtrafficquality.google"];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(analyticsOrigin ? [analyticsOrigin] : []), ...(ads ? google : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(ads ? ["https:"] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(analyticsOrigin ? [analyticsOrigin] : []), ...(ads ? google : [])],
    "frame-src": ads ? google : ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return [...Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`), "upgrade-insecure-requests"].join("; ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,
  async headers() {
    const headers = [...securityHeaders];
    // The CSP is for production only: the development server needs eval for hot reloading.
    if (process.env.NODE_ENV === "production") headers.push({ key: "Content-Security-Policy", value: buildCsp() });
    return [{ source: "/:path*", headers }];
  },
};

export default config;
