import Link from "next/link";
import { Icon } from "../Icon";
import { RichText } from "./RichText";
import { ToolCard } from "../ToolCard";
import { TOOL_BY_ID, toolPath } from "@/tools/registry";
import { CATEGORY_BY_ID } from "@/tools/categories";
import type { Disclaimer, FormulaDef, RegulatoryInfo, ToolDefinition, Faq } from "@/tools/types";
import { formatDateShort, parseISODate } from "@/lib/dates";

export function FormulaBlock({ formula }: { formula: FormulaDef }) {
  return (
    <div className="formula">
      <ul className="formula__lines">{formula.expression.map((l) => <li key={l}><code>{l}</code></li>)}</ul>
      {formula.where && formula.where.length > 0 && (
        <ul className="formula__where" aria-label="Where">{formula.where.map((w) => <li key={w}>{w}</li>)}</ul>
      )}
      <p className="formula__plain">{formula.plain}</p>
    </div>
  );
}

const DISCLAIMERS: Record<Disclaimer, { title: string; body: string }> = {
  finance: { title: "A calculation, not financial advice", body: "This calculator does the arithmetic from the numbers and assumptions you give it. Real financial products add fees, taxes, rate changes and conditions it can’t know. Confirm figures with your lender, bank or a qualified adviser before you decide." },
  tax: { title: "An estimate, not tax advice", body: "Tax rules change, differ by person and are interpreted by the authorities. Use this as a planning figure and check the official source (linked below) or a qualified professional before relying on it." },
  salary: { title: "An estimate", body: "Salary results depend on your employer, contract, region and tax position, so treat them as an estimate rather than a promise of what you will be paid." },
  exam: { title: "Check the official notice", body: "Exam rules change with each notification. This tool uses the scheme stated below for the named cycle only. It estimates raw marks from your own answer count and doesn’t predict normalised scores or cut-offs." },
  education: { title: "Your institution’s rules come first", body: "Boards and universities set their own grading and conversion rules. Where they differ, the rule printed by your institution is the one that counts." },
  estimate: { title: "An estimate based on stated assumptions", body: "The result follows the assumptions listed on this page. Your contract, employer policy or local rules decide the actual figure." },
  security: { title: "Decoding is not verifying", body: "This tool only decodes the token. It never checks the signature, so don’t treat its contents as trustworthy or use it to make access decisions." },
};

export function DisclaimerBox({ kind }: { kind: Disclaimer }) {
  const d = DISCLAIMERS[kind];
  return (
    <div className="disclaimer" role="note">
      <Icon name="info" />
      <div><strong>{d.title}</strong>{d.body}</div>
    </div>
  );
}

export function RegulatoryBox({ info }: { info: RegulatoryInfo }) {
  const eff = parseISODate(info.effectiveFrom);
  const rev = parseISODate(info.reviewedOn);
  return (
    <section className="sources" aria-labelledby="sources-title">
      <h2 id="sources-title">Rules, sources and review date</h2>
      <dl>
        <dt>Applies to</dt><dd>{info.appliesTo} — {info.region}</dd>
        <dt>Effective from</dt><dd>{eff ? formatDateShort(eff) : info.effectiveFrom}</dd>
        <dt>Last checked</dt><dd>{rev ? formatDateShort(rev) : info.reviewedOn}</dd>
        <dt>Sources</dt>
        <dd>
          <ul>{info.sources.map((s) => <li key={s.url}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>)}</ul>
        </dd>
        {info.note && (<><dt>Note</dt><dd>{info.note}</dd></>)}
      </dl>
    </section>
  );
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="faq">
      {faqs.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <div><RichText text={f.a} /></div>
        </details>
      ))}
    </div>
  );
}

export function RelatedTools({ tool, layout = "cards" }: { tool: ToolDefinition; layout?: "cards" | "list" }) {
  const items = tool.relatedTools.map((id) => TOOL_BY_ID.get(id)!).filter(Boolean);
  if (layout === "list") {
    return (
      <ul className="aside-list">
        {items.slice(0, 6).map((t) => <li key={t.id}><Link href={toolPath(t)}>{t.title}</Link></li>)}
      </ul>
    );
  }
  return (
    <div className="grid grid--2">
      {items.map((t) => <ToolCard key={t.id} tool={t} showCategory={t.category !== tool.category} categoryName={CATEGORY_BY_ID.get(t.category)?.name} />)}
    </div>
  );
}
