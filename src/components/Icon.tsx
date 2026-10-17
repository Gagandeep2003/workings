import { createElement } from "react";
import type { SVGProps } from "react";
import { UI_ICONS, type UiIconName } from "./icon-data";

export type IconName = UiIconName;

/** Small UI icon set (this module is bundled for the browser, so it only contains what the interactive UI needs). */
export function Icon({ name, className = "icon", ...rest }: { name: IconName; className?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const shapes = UI_ICONS[name] ?? [];
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {shapes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

export function BrandMark({ className = "brand__mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 12h14M9 20h9" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="23" cy="20" r="1.9" fill="var(--on-accent)" />
    </svg>
  );
}
