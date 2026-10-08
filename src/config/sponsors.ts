/**
 * Direct sponsorships — configured locally, no ad server. Ships empty.
 * Sponsor images must live in /public/sponsors (so the Content-Security-Policy can stay strict).
 * A sponsor stops showing automatically once its endDate has passed.
 */
import type { Region } from "./affiliates";

export type SponsorPlacement = "top" | "in-content" | "result-below" | "sidebar" | "footer";

export type Sponsor = {
  sponsorId: string;
  placement: SponsorPlacement;
  /** Path under /public, e.g. "/sponsors/acme.png". */
  image?: string;
  title: string;
  description: string;
  cta: string;
  /** https URL the sponsor wants visitors sent to. */
  destinationUrl: string;
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  endDate: string;
  active: boolean;
  targetRegions: Region[];
  /** Optionally restrict to these tool categories or tool ids. Empty = any eligible page. */
  categories?: string[];
  toolIds?: string[];
};

export const SPONSORS: Sponsor[] = [];
