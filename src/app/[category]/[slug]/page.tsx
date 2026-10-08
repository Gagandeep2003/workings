import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, getTool } from "@/tools/registry";
import { isCategoryId } from "@/tools/categories";
import { toolMetadata } from "@/lib/seo";
import { ToolPageView } from "@/components/tool/ToolPageView";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ category: t.category, slug: t.slug }));
}

type Props = { params: Promise<{ category: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const tool = isCategoryId(category) ? getTool(category, slug) : undefined;
  if (!tool) return {};
  return toolMetadata(tool);
}

export default async function ToolPage({ params }: Props) {
  const { category, slug } = await params;
  const tool = isCategoryId(category) ? getTool(category, slug) : undefined;
  if (!tool) notFound();
  return <ToolPageView tool={tool} />;
}
