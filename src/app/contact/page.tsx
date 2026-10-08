import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { SITE, STATIC_PAGES } from "@/lib/site";

const page = STATIC_PAGES.find((p) => p.path === "/contact")!;
export const metadata = pageMetadata({ title: "Contact and Corrections", description: page.description, path: "/contact" });

export default function Contact() {
  return (
    <LegalPage title="Contact and corrections" path="/contact" intro="The most useful message you can send is a correction. If a result looks wrong, tell us which tool, what you entered and what you expected.">
      <h2>Email</h2>
      {SITE.contactEmail ? (
        <p><a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>
      ) : (
        <p>A contact address has not been published for this site yet.</p>
      )}
      <h2>What to include</h2>
      <ul>
        <li>The name of the tool and the page address.</li>
        <li>The values you entered (leave out anything private — a similar example is fine).</li>
        <li>The result you got, and the result you expected, with the source if you have one.</li>
      </ul>
      <h2>What we can’t do</h2>
      <p>We can’t give personal financial, tax, legal or academic advice, or look up your own records. For those, contact your lender, tax authority, institution or a qualified professional.</p>
      <h2>Partnerships and advertising</h2>
      <p>For sponsorship or partnership enquiries see the <Link href="/advertise">advertising page</Link>.</p>
    </LegalPage>
  );
}
