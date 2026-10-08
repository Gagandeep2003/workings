import Link from "next/link";
import { Breadcrumbs } from "../Breadcrumbs";
import { CalculatorShell } from "./CalculatorShell";
import { ExampleBlock } from "./ExampleBlock";
import { DisclaimerBox, FaqList, FormulaBlock, RegulatoryBox, RelatedTools } from "./ContentBlocks";
import { RichText } from "./RichText";
import { Placement, AffiliatePlacement } from "../monetization/Placements";
import { TrackView } from "../Analytics";
import { Icon } from "../Icon";
import { CATEGORY_BY_ID } from "@/tools/categories";
import type { ToolDefinition } from "@/tools/types";
import { breadcrumbJsonLd, jsonLdString, type Crumb } from "@/lib/seo";
import { formatDateShort, parseISODate } from "@/lib/dates";
import { toolPath } from "@/tools/registry";

export function ToolPageView({ tool }: { tool: ToolDefinition }) {
  const cat = CATEGORY_BY_ID.get(tool.category)!;
  const crumbs: Crumb[] = [{ name: "Home", path: "/" }, { name: cat.name, path: `/${cat.id}` }, { name: tool.title, path: toolPath(tool) }];
  const rev = tool.regulatory ? parseISODate(tool.regulatory.reviewedOn) : null;
  return (
    <div className="container" data-cat={tool.category}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(crumbs)) }} />
      <TrackView event="tool_view" props={{ toolId: tool.id, category: tool.category }} />
      <Breadcrumbs crumbs={crumbs} />
      <header className="page-head">
        <h1>{tool.h1}</h1>
        <p className="page-head__intro">{tool.intro}</p>
        {tool.regulatory && (
          <p className="badge badge--warn">
            <Icon name="info" /> {tool.regulatory.region} · {tool.regulatory.appliesTo.split("—")[0].trim()}{rev ? ` · checked ${formatDateShort(rev)}` : ""}
          </p>
        )}
        {!tool.regulatory && tool.category === "developer" && (
          <p className="badge"><Icon name="lock" /> Runs in your browser — nothing you enter is uploaded</p>
        )}
      </header>

      <CalculatorShell tool={tool} />

      <div className="tool-layout" data-content="tool-body">
        <div className="content">
          <section aria-labelledby="formula-title">
            <h2 id="formula-title">Formula</h2>
            <FormulaBlock formula={tool.formula} />
          </section>

          <section aria-labelledby="how-title" className="copy">
            <h2 id="how-title">How it works</h2>
            {tool.howItWorks.map((p, i) => <p key={i}><RichText text={p} /></p>)}
          </section>

          <section aria-labelledby="example-title">
            <h2 id="example-title">{tool.examples.length > 1 ? "Worked examples" : "Worked example"}</h2>
            <ExampleBlock tool={tool} />
          </section>

          <Placement placement="in-content" tool={tool} />

          <section aria-labelledby="assump-title" className="copy">
            <h2 id="assump-title">Assumptions and limits</h2>
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
          </section>
        </div>

        <aside className="tool-aside" aria-label="More on this topic">
          <div className="aside-stack">
            <div className="card aside-box">
              <h2>More in {cat.name}</h2>
              <RelatedTools tool={tool} layout="list" />
              <p style={{ marginTop: "var(--s-3)" }}><Link href={`/${cat.id}`}>All {cat.name.toLowerCase()} tools <Icon name="arrow" style={{ width: "1em", height: "1em", verticalAlign: "-0.125em" }} /></Link></p>
            </div>
            <AffiliatePlacement tool={tool} placement="sidebar" />
            <Placement placement="sidebar" tool={tool} />
          </div>
        </aside>
      </div>
    </div>
  );
}
