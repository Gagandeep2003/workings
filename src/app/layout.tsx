import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/figtree";
import "@fontsource-variable/jetbrains-mono";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/files.css";
import { SITE } from "@/lib/site";
import { getMonetization, getPublicMonetization } from "@/config/monetization";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AnalyticsConfigurator } from "@/components/Analytics";

/** Applies the saved theme before first paint (no flash). Reads only a "light" / "dark" value from this browser. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("workings-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { telephone: false, email: false, address: false },
  alternates: { canonical: SITE.url },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f5f1" }, { media: "(prefers-color-scheme: dark)", color: "#0e0f11" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const m = getMonetization();
  const pub = getPublicMonetization();
  return (
    <html lang={SITE.locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <AnalyticsConfigurator config={pub.analytics} />
        <Header />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
        {m.analytics?.provider === "plausible" && <Script src={m.analytics.scriptSrc} data-domain={m.analytics.domain} strategy="afterInteractive" defer />}
        {m.analytics?.provider === "umami" && <Script src={m.analytics.scriptSrc} data-website-id={m.analytics.websiteId} strategy="afterInteractive" defer />}
        {m.adsEnabled && m.adsenseEnabled && (
          <Script id="adsense-loader" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${m.adsensePublisherId}`} strategy="afterInteractive" crossOrigin="anonymous" async />
        )}
      </body>
    </html>
  );
}
