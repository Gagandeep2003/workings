import { createElement } from "react";
import type { SVGProps } from "react";
import { TOOL_ICONS, UI_ICONS, type ToolIconName } from "./icon-data";

/**
 * Icon for a tool or category. Only import this from server components: the full set is larger than the
 * browser UI set and would otherwise be added to the JavaScript every visitor downloads.
 */
export function ToolIcon({ name, className = "icon", ...rest }: { name: ToolIconName; className?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const shapes = TOOL_ICONS[name] ?? UI_ICONS[name] ?? [];
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {shapes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
