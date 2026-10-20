import Link from "next/link";
import { Breadcrumbs } from "../Breadcrumbs";
import { CalculatorShell } from "./CalculatorShell";
import { ClientToolHost } from "./ClientToolHost";
import { ExampleBlock } from "./ExampleBlock";
import { DisclaimerBox, FaqList, FormulaBlock, RegulatoryBox, RelatedTools } from "./ContentBlocks";
import { RichText } from "./RichText";
import { Placement, AffiliatePlacement } from "../monetization/Placements";
import { TrackView } from "../Analytics";
import { Icon } from "../Icon";
import { ToolIcon } from "../ToolIcon";
import { CATEGORY_BY_ID } from "@/tools/categories";
import type { ToolDefinition } from "@/tools/types";
import { jsonLdString, toolJsonLd, type Crumb } from "@/lib/seo";
import { formatDateShort, parseISODate } from "@/lib/dates";
import { toolPath } from "@/tools/registry";

export function ToolPageView({ tool }: { tool: ToolDefinition }) {
  const cat = CATEGORY_BY_ID.get(tool.category)!;
  const crumbs: Crumb[] = [{ name: "Home", path: "/" }, { name: cat.name, path: `/${cat.id}` }, { name: tool.title, path: toolPath(tool) }];
  const rev = tool.regulatory ? parseISODate(tool.regulatory.reviewedOn) : null;
  return (
    <div className="container" data-cat={tool.category}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(toolJsonLd(tool, crumbs)) }} />
      <TrackView event="tool_view" props={{ toolId: tool.id, category: tool.category }} />
      <Breadcrumbs crumbs={crumbs} />
      <header className="page-head page-head--tool">
        <div className="page-head__title">
          <span className="cat-icon cat-icon--lg" aria-hidden="true"><ToolIcon name={tool.icon} /></span>
          <h1>{tool.h1}</h1>
        </div>
        <p className="page-head__intro">{tool.intro}</p>
        {tool.regulatory && (
          <p className="badge badge--warn">
            <Icon name="info" /> {tool.regulatory.region} · {tool.regulatory.appliesTo.split("—")[0].trim()}{rev ? ` · checked ${formatDateShort(rev)}` : ""}
          </p>
        )}
        {!tool.regulatory && tool.category === "developer" && (
          <p className="badge"><Icon name="lock" /> Runs in your browser — nothing you enter is uploaded</p>
        )}
        {tool.category === "image-pdf" && (
          <p className="badge"><Icon name="lock" /> Your files never leave your device — nothing is uploaded</p>
        )}
      </header>

      {tool.client ? (
        <section id="calculator" aria-labelledby="calculator-title">
          <h2 id="calculator-title" className="sr-only">{tool.title}</h2>
          <noscript><p className="card" style={{ padding: "var(--s-5)" }}>This tool runs in your browser and needs JavaScript. Everything below explains how it works and what it supports.</p></noscript>
          <ClientToolHost component={tool.client.component} preset={tool.client.preset} />
          <Placement placement="result-below" tool={tool} />
          <AffiliatePlacement tool={tool} placement="result-below" />
        </section>
      ) : (
        <CalculatorShell tool={tool} />
      )}

      <div className="tool-layout" data-content="tool-body">
        <div className="content">
          {tool.client ? (
            <>
              <section aria-labelledby="how-title" className="copy">
                <h2 id="how-title">How to use it</h2>
                {tool.howItWorks.map((p, i) => <p key={i}><RichText text={p} /></p>)}
              </section>

              <section aria-labelledby="specs-title">
                <h2 id="specs-title">Supported formats and limits</h2>
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Formats and limits table (scrollable)">
                  <table className="spec-table">
                    <tbody>{(tool.specs ?? []).map((s) => <tr key={s.label}><th scope="row">{s.label}</th><td><RichText text={s.value} /></td></tr>)}</tbody>
                  </table>
                </div>
              </section>

              <section aria-labelledby="example-title">
                <h2 id="example-title">{(tool.practicalExamples?.length ?? 0) > 1 ? "Practical examples" : "Practical example"}</h2>
                {(tool.practicalExamples ?? []).map((e) => (
                  <div className="example" key={e.title}>
                    <div className="example__head"><h3>{e.title}</h3></div>
                    <div className="example__body">
                      <dl>
                        <div><dt>Situation</dt><dd><RichText text={e.scenario} /></dd></div>
                        <div><dt>What to expect</dt><dd><RichText text={e.result} /></dd></div>
                      </dl>
                    </div>
                  </div>
                ))}
              </section>

              <section aria-labelledby="formula-title">
                <h2 id="formula-title">The numbers behind it</h2>
                <FormulaBlock formula={tool.formula} />
              </section>
            </>
          ) : (
            <>
              <section aria-labelledby="formula-title">
                <h2 id="formula-title">Formula</h2>
                <FormulaBlock formula={tool.formula} />
              </section>

              <section aria-labelledby="example-title">
                <h2 id="example-title">{tool.examples.length > 1 ? "Worked examples" : "Worked example"}</h2>
                <ExampleBlock tool={tool} />
              </section>

              <section aria-labelledby="how-title" className="copy">
                <h2 id="how-title">How it works</h2>
                {tool.howItWorks.map((p, i) => <p key={i}><RichText text={p} /></p>)}
              </section>
            </>
          )}

          <Placement placement="in-content" tool={tool} />

          <section aria-labelledby="assump-title" className="copy">
            <h2 id="assump-title">{tool.client ? "Honest limits" : "Assumptions and limits"}</h2>
            <ul>{tool.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </section>

          {tool.disclaimer && <DisclaimerBox kind={tool.disclaimer} />}
          {tool.regulatory && <RegulatoryBox info={tool.regulatory} />}

          {tool.faqs && tool.faqs.length > 0 && (
            <section aria-labelledby="faq-title">
              <h2 id="faq-title">Common questions</h2>
              <FaqList faqs={tool.faqs} />
            </section>
          )}

          <AffiliatePlacement tool={tool} placement="in-content" />

          <section aria-labelledby="related-title">
            <h2 id="related-title">Related tools</h2>
            <RelatedTools tool={tool} />
            <p className="directory-links">
              <Link href={`/${cat.id}`}>All {cat.inline ?? cat.name.toLowerCase()} tools</Link>
              <span aria-hidden="true">·</span>
              <Link href="/tools">Browse the full tool directory</Link>
            </p>
          </section>
        </div>

        <aside className="tool-aside" aria-label="More on this topic">
          <div className="aside-stack">
            <div className="card aside-box">
              <h2>More in {cat.name}</h2>
              <RelatedTools tool={tool} layout="list" />
              <p style={{ marginTop: "var(--s-3)" }}><Link href={`/${cat.id}`}>All {cat.inline ?? cat.name.toLowerCase()} tools <Icon name="arrow" style={{ width: "1em", height: "1em", verticalAlign: "-0.125em" }} /></Link></p>
            </div>
            <AffiliatePlacement tool={tool} placement="sidebar" />
            <Placement placement="sidebar" tool={tool} />
          </div>
        </aside>
      </div>
    </div>
  );
}
