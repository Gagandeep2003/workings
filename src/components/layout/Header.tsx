import Link from "next/link";
import { CATEGORIES } from "@/tools/categories";
import { BrandMark } from "../Icon";
import { SITE } from "@/lib/site";
import { MainNav, type NavItem } from "./MainNav";
import { HeaderControls } from "./HeaderControls";
import { SearchBox } from "../SearchBox";
import { ThemeToggle } from "./ThemeToggle";

const ITEMS: NavItem[] = CATEGORIES.map((c) => ({ href: `/${c.id}`, label: c.name, icon: c.icon }));

export function Header() {
  return (
    <header className="site-header">
      <div className="container site-header__bar">
        <Link href="/" className="brand" aria-label={`${SITE.name} — home`}>
          <BrandMark />
          <span>{SITE.name}</span>
        </Link>
        <MainNav items={ITEMS} variant="bar" />
        <span className="site-header__spacer" />
        <div className="site-header__search">
          <SearchBox variant="header" placeholder="Search tools…" />
        </div>
        <ThemeToggle />
        <HeaderControls items={ITEMS} />
      </div>
    </header>
  );
}
