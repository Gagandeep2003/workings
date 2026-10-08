import { ToolRunner } from "./ToolRunner";
import { toRuntime } from "@/tools/registry";
import type { ToolDefinition } from "@/tools/types";
import { Placement, AffiliatePlacement } from "../monetization/Placements";

/**
 * The shared calculator frame. Ads and affiliate blocks are placed *after* the calculator with generous spacing —
 * never between the inputs and the result, and never beside the buttons.
 */
export function CalculatorShell({ tool }: { tool: ToolDefinition }) {
  return (
    <section id="calculator" aria-labelledby="calculator-title">
      <h2 id="calculator-title" className="sr-only">{tool.title}</h2>
      <ToolRunner tool={toRuntime(tool)} />
      <Placement placement="result-below" tool={tool} />
      <AffiliatePlacement tool={tool} placement="result-below" />
    </section>
  );
}
