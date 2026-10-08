import Link from "next/link";
import { parseRich } from "@/lib/rich";
import { TOOL_BY_ID, toolPath } from "@/tools/registry";

export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRich(text).map((p, i) => {
        if (p.t === "text") return <span key={i}>{p.v}</span>;
        if (p.t === "code") return <code key={i}>{p.v}</code>;
        const tool = TOOL_BY_ID.get(p.id);
        if (!tool) throw new Error(`Content links to unknown tool "${p.id}"`);
        return <Link key={i} href={toolPath(tool)}>{p.label ?? tool.title}</Link>;
      })}
    </>
  );
}
