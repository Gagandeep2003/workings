import Link from "next/link";
import { toolPath } from "@/tools/registry";
import type { CategoryDef, ToolDefinition } from "@/tools/types";
import { Icon, type IconName } from "./Icon";

export function ToolCard({ tool, showCategory = false, categoryName }: { tool: ToolDefinition; showCategory?: boolean; categoryName?: string }) {
  return (
    <Link href={toolPath(tool)} className="card tool-card" data-cat={tool.category}>
      <span className="tool-card__top">
        <span className="tool-card__title">{tool.title}</span>
        {showCategory && categoryName && <span className="chip-cat">{categoryName}</span>}
      </span>
      <span className="tool-card__desc">{tool.shortDescription}</span>
    </Link>
  );
}

export function CategoryCard({ category, count }: { category: CategoryDef; count: number }) {
  return (
    <Link href={`/${category.id}`} className="card cat-card" data-cat={category.id}>
      <span className="cat-icon"><Icon name={category.icon as IconName} /></span>
      <span>
        <span className="cat-card__title">{category.name}</span>
        <span className="cat-card__desc" style={{ display: "block" }}>{category.tagline}</span>
        <span className="cat-card__count" style={{ display: "block" }}>{count} tools</span>
      </span>
    </Link>
  );
}
