import Link from "next/link";
import { toolPath } from "@/tools/registry";
import type { CategoryDef, ToolDefinition } from "@/tools/types";
import { Icon, type IconName } from "./Icon";
import { ToolIcon } from "./ToolIcon";

/** Large card: icon, name, one line of description and an arrow that shows it is clickable. */
export function ToolCard({ tool, showCategory = false, categoryName, isNew = false }: { tool: ToolDefinition; showCategory?: boolean; categoryName?: string; isNew?: boolean }) {
  return (
    <Link href={toolPath(tool)} className="card tool-card" data-cat={tool.category}>
      <span className="tool-card__head">
        <span className="cat-icon tool-card__icon"><ToolIcon name={tool.icon} /></span>
        <span className="tool-card__top">
          <span className="tool-card__title">{tool.title}</span>
          {isNew && <span className="badge-new">New</span>}
          {showCategory && categoryName && <span className="chip-cat">{categoryName}</span>}
        </span>
      </span>
      <span className="tool-card__desc">{tool.shortDescription}</span>
      <ToolIcon name="arrow" className="tool-card__go" />
    </Link>
  );
}

/** Compact row for dense lists (home-page spotlights, directory). Same link target, less visual weight. */
export function ToolRow({ tool, isNew = false }: { tool: ToolDefinition; isNew?: boolean }) {
  return (
    <Link href={toolPath(tool)} className="tool-row" data-cat={tool.category}>
      <span className="cat-icon cat-icon--sm"><ToolIcon name={tool.icon} /></span>
      <span className="tool-row__text">
        <span className="tool-row__title">{tool.title}{isNew && <span className="badge-new">New</span>}</span>
        <span className="tool-row__desc">{tool.shortDescription}</span>
      </span>
    </Link>
  );
}

export function CategoryCard({ category, count }: { category: CategoryDef; count: number }) {
  return (
    <Link href={`/${category.id}`} className="card cat-card" data-cat={category.id}>
      <span className="cat-icon cat-icon--lg"><Icon name={category.icon as IconName} /></span>
      <span className="cat-card__body">
        <span className="cat-card__title">{category.name}</span>
        <span className="cat-card__desc">{category.tagline}</span>
        <span className="cat-card__count">{count} {count === 1 ? "tool" : "tools"} <Icon name="arrow" className="cat-card__arrow" /></span>
      </span>
    </Link>
  );
}
