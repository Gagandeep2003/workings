import type { SVGProps } from "react";

const PATHS: Record<string, React.ReactNode> = {
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  share: (<><circle cx="6" cy="12" r="2.5" /><circle cx="17.5" cy="6" r="2.5" /><circle cx="17.5" cy="18" r="2.5" /><path d="m8.2 10.8 7-3.6M8.2 13.2l7 3.6" /></>),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>),
  alert: (<><path d="M12 4 3 20h18L12 4z" /><path d="M12 10v4M12 17h.01" /></>),
  reset: (<><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v5h5" /></>),
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  math: (<><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 7.5h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  graduation: (<><path d="m2 9 10-5 10 5-10 5L2 9z" /><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6" /></>),
  briefcase: (<><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18" /></>),
  coins: (<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6.5 9.5h.01M17.5 14.5h.01" /></>),
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>),
  lock: (<><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3z" />,
  formula: <path d="M18 5H7l5 7-5 7h11" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "icon", ...rest }: { name: IconName; className?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {PATHS[name]}
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
