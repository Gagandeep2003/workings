import { loadEngine } from "@/engines/loaders";
import { makeContext } from "@/engines/helpers";
import { defaultValues, isVisible, validateInputs } from "@/lib/form";
import { formatNumber, formatValue } from "@/lib/format";
import type { ToolDefinition } from "@/tools/types";
import { TryExample } from "./TryExample";

/** Worked examples are computed from the real engine at build time, so the page can never show a stale or wrong answer. */
export async function ExampleBlock({ tool }: { tool: ToolDefinition }) {
  const engine = await loadEngine(tool.engineModule, tool.id);
  const blocks = await Promise.all(tool.examples.map(async (ex) => {
    const raw = { ...defaultValues(tool.inputs), ...ex.inputs };
    const { errors, values } = validateInputs(tool.inputs, raw);
    if (Object.keys(errors).length) throw new Error(`Example "${ex.title}" of ${tool.id} is invalid: ${JSON.stringify(errors)}`);
    const res = await engine(values, makeContext({ today: ex.today ?? "2026-01-01", nowMs: Date.UTC(2026, 0, 1, 12), timeZone: "UTC" }));
    if (!res.ok) throw new Error(`Example "${ex.title}" of ${tool.id} failed: ${res.errors.map((e) => e.message).join("; ")}`);
    const rows = tool.inputs
      .filter((i) => isVisible(i, raw) && (raw[i.id] ?? "").trim() !== "")
      .map((i) => {
        const text = raw[i.id];
        let shown = text;
        if (i.type === "select") shown = i.options.find((o) => o.value === text)?.label ?? text;
        else if (i.type === "number" && values[i.id] !== undefined) shown = formatNumber(values[i.id] as number, { maxDecimals: 10 }) + (i.unit ? ` ${i.unit}` : "");
        else if (shown.length > 240) shown = shown.slice(0, 240) + "…";
        return { label: i.label, shown };
      });
    return { ex, rows, out: res.output };
  }));
  return (
    <div>
      {blocks.map(({ ex, rows, out }) => (
        <div className="example" key={ex.title}>
          <div className="example__head">
            <h3>{ex.title}</h3>
            <TryExample toolId={tool.id} inputs={{ ...defaultValues(tool.inputs), ...ex.inputs }} />
          </div>
          <div className="example__body">
            <dl>
              {rows.map((r) => (<div key={r.label}><dt>{r.label}</dt><dd>{r.shown}</dd></div>))}
            </dl>
            <div className="example__result">
              <p className="example__label">{out.primary.label}</p>
              <p className="big">{formatValue(out.primary.value)}</p>
              {out.secondary?.slice(0, 3).map((s) => (
                <p key={s.label} style={{ marginTop: "var(--s-1)", fontSize: "var(--fs-base)" }}>{s.label}: <strong>{formatValue(s.value)}</strong></p>
              ))}
              {out.texts?.[0] && <pre style={{ margin: "var(--s-2) 0 0", fontSize: "0.8125rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{out.texts[0].value.length > 360 ? out.texts[0].value.slice(0, 360) + "…" : out.texts[0].value}</pre>}
              {out.qr && <p style={{ marginTop: "var(--s-2)", fontSize: "var(--fs-base)" }}>{out.qr.matrix.length} × {out.qr.matrix.length} QR code for “{out.qr.text}”.</p>}
              {ex.note && <p style={{ marginTop: "var(--s-2)", fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>{ex.note}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
