import Link from "next/link";

export function AffiliateDisclosure({ compact = false }: { compact?: boolean }) {
  return (
    <p className="affiliate-note">
      {compact ? "Affiliate link: " : "Disclosure: "}
      we may earn a commission if you buy through links marked “Sponsored”, at no extra cost to you. It never changes the calculation. <Link href="/advertising-disclosure">How this works</Link>.
    </p>
  );
}
