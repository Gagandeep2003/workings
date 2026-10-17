import Link from "next/link";
import { CATEGORIES } from "@/tools/categories";
import { BrandMark } from "../Icon";
import { SITE } from "@/lib/site";
import { AdSlot } from "../monetization/AdSlot";

export function Footer({ showAd = true }: { showAd?: boolean }) {
  return (
    <>
      {showAd && (
        <div className="container">
          <AdSlot placement="footer" profile="minimal" />
        </div>
      )}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-about">
              <Link href="/" className="brand"><BrandMark /><span>{SITE.name}</span></Link>
              <p>Free calculators, converters and developer tools that show their working. No account, and your inputs stay in your browser.</p>
            </div>
            <nav aria-labelledby="footer-categories">
              <h2 id="footer-categories">Tools</h2>
              <ul>
                {CATEGORIES.map((c) => <li key={c.id}><Link href={`/${c.id}`}>{c.name}</Link></li>)}
                <li><Link href="/tools"><strong>All tools (directory)</strong></Link></li>
              </ul>
            </nav>
            <nav aria-labelledby="footer-site">
              <h2 id="footer-site">Site</h2>
              <ul>
                <li><Link href="/about">About and methodology</Link></li>
                <li><Link href="/contact">Contact and corrections</Link></li>
                <li><Link href="/advertise">Advertise</Link></li>
              </ul>
            </nav>
            <nav aria-labelledby="footer-legal">
              <h2 id="footer-legal">Legal</h2>
              <ul>
                <li><Link href="/privacy-policy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Use</Link></li>
                <li><Link href="/disclaimer">Disclaimer</Link></li>
                <li><Link href="/advertising-disclosure">Advertising disclosure</Link></li>
              </ul>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} {SITE.operatorName || SITE.name}</span>
            <span>Results are for information only and are not professional advice.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
