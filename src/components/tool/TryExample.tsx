"use client";
import { Icon } from "../Icon";

export const EXAMPLE_EVENT = "workings:example";

/** Loads a worked example's inputs into the calculator above and runs it. */
export function TryExample({ toolId, inputs }: { toolId: string; inputs: Record<string, string> }) {
  return (
    <button
      type="button"
      className="btn btn--secondary btn--sm no-print"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(EXAMPLE_EVENT, { detail: { toolId, inputs } }));
        document.getElementById("calculator")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      }}
    >
      <Icon name="arrow" /> Try this example
    </button>
  );
}
