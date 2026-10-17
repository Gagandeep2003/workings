import type { Block, Inline } from "@/lib/markdown";

/**
 * Renders a parsed Markdown tree with React elements. Nothing here uses dangerouslySetInnerHTML, so text typed by a visitor can never
 * become markup. The parser has already restricted links to http/https/mailto and dropped remote images.
 */
function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text": return <span key={i}>{n.v}</span>;
          case "code": return <code key={i}>{n.v}</code>;
          case "em": return <em key={i}><Inlines nodes={n.c} /></em>;
          case "strong": return <strong key={i}><Inlines nodes={n.c} /></strong>;
          case "del": return <del key={i}><Inlines nodes={n.c} /></del>;
          case "br": return <br key={i} />;
          case "link": return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow ugc"><Inlines nodes={n.c} /><span className="sr-only"> (opens in a new tab)</span></a>;
          case "image": return <span key={i} className="md-image">[image: {n.alt || "no description"}]</span>;
        }
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          // The page already has its own <h1>/<h2>; preview headings are exposed to assistive technology at level 3 and below.
          case "h": return <p key={i} className={`md-h md-h${b.level}`} role="heading" aria-level={Math.min(6, b.level + 2)}><Inlines nodes={b.c} /></p>;
          case "p": return <p key={i}><Inlines nodes={b.c} /></p>;
          case "code": return <pre key={i} tabIndex={0} aria-label={b.lang ? `${b.lang} code` : "Code"}><code>{b.v}</code></pre>;
          case "quote": return <blockquote key={i}><Blocks blocks={b.c} /></blockquote>;
          case "hr": return <hr key={i} />;
          case "list": {
            const items = b.items.map((it, k) => (
              <li key={k} className={it.task === null ? undefined : "md-task"}>
                {it.task !== null && <span aria-hidden="true">{it.task ? "☑" : "☐"} </span>}
                {it.task !== null && <span className="sr-only">{it.task ? "Done: " : "To do: "}</span>}
                <Blocks blocks={it.c} />
              </li>
            ));
            return b.ordered ? <ol key={i} start={b.start}>{items}</ol> : <ul key={i}>{items}</ul>;
          }
          case "table":
            return (
              <div key={i} className="table-wrap" role="region" aria-label="Table" tabIndex={0}>
                <table className="data-table">
                  <thead><tr>{b.head.map((c, k) => <th key={k} scope="col" style={b.align[k] ? { textAlign: b.align[k]! } : undefined}><Inlines nodes={c} /></th>)}</tr></thead>
                  <tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((c, m) => <td key={m} style={b.align[m] ? { textAlign: b.align[m]! } : undefined}><Inlines nodes={c} /></td>)}</tr>)}</tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}

export function MarkdownView({ blocks }: { blocks: Block[] }) {
  return <div className="md-preview"><Blocks blocks={blocks} /></div>;
}
