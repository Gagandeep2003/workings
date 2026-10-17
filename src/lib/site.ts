/** Site-wide constants. The only values read from the environment here are non-secret. */
const rawUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  "http://localhost:3000";

export const SITE = {
  name: "Workings",
  tagline: "Answers with the working shown",
  description: "Free calculators, converters and developer tools that show the formula behind every result. No sign-up, no clutter.",
  url: rawUrl.replace(/\/+$/, ""),
  /** Set CONTACT_EMAIL in the environment. Until then the contact page says so instead of inventing an address. */
  contactEmail: process.env.CONTACT_EMAIL?.trim() || "",
  operatorName: process.env.SITE_OPERATOR_NAME?.trim() || "",
  /** "organization" or "person". Structured data about the publisher is only emitted when both name and type are configured. */
  operatorType: (process.env.SITE_OPERATOR_TYPE?.trim().toLowerCase() === "person" ? "person" : process.env.SITE_OPERATOR_TYPE?.trim().toLowerCase() === "organization" ? "organization" : "") as "" | "person" | "organization",
  /** Real date the legal pages were last revised. Update only when their text genuinely changes. */
  legalUpdated: "2026-10-03",
  locale: "en",
} as const;

export const absoluteUrl = (path: string): string => `${SITE.url}${path === "/" ? "" : path}`;

export const STATIC_PAGES = [
  { path: "/tools", title: "All tools", description: "Every calculator, converter and developer tool on Workings, grouped by category." },
  { path: "/about", title: "About", description: "What this site is for, how its calculations are produced and what to expect." },
  { path: "/contact", title: "Contact", description: "How to reach the site owner with corrections, questions or partnership enquiries." },
  { path: "/advertise", title: "Advertise", description: "Sponsorship and advertising opportunities on Workings: labelled placements, tool sponsorships and partnerships, kept away from the calculators." },
  { path: "/privacy-policy", title: "Privacy Policy", description: "What this site does and doesn't do with your data: calculations stay in your browser, there are no accounts, and any analytics or ads are disclosed." },
  { path: "/terms", title: "Terms of Use", description: "The terms for using this website: what you may do, the limits of the information provided, and how the content may be used." },
  { path: "/disclaimer", title: "Disclaimer", description: "Limits of the calculators: not financial, tax, legal, medical or academic advice." },
  { path: "/advertising-disclosure", title: "Advertising and Affiliate Disclosure", description: "How advertising, affiliate links and sponsorships work on this site, and the rules that keep them separate from the calculators and results." },
] as const;
