"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../Icon";

export type NavItem = { href: string; label: string; icon: string };

export function MainNav({ items, variant }: { items: NavItem[]; variant: "bar" | "list" }) {
  const pathname = usePathname() ?? "";
  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined);
  if (variant === "bar") {
    return (
      <nav className="nav" aria-label="Primary">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={current(i.href)}>{i.label}</Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Primary">
      <ul>
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={current(i.href)} data-cat={i.href.slice(1)}>
              <span className="cat-icon" style={{ width: "2.25rem", height: "2.25rem" }}><Icon name={i.icon as IconName} /></span>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
