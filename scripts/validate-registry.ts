import { TOOLS, CATEGORIES } from "../src/tools/registry";
import { validateRegistry } from "../src/tools/validate";

const issues = validateRegistry();
const byCategory = new Map<string, number>();
for (const t of TOOLS) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1);

if (issues.length) {
  console.error(`\n✖ Tool registry validation failed (${issues.length} problem${issues.length === 1 ? "" : "s"}):\n`);
  for (const i of issues) console.error(`  [${i.tool}] ${i.message}`);
  console.error("\nFix these before building.\n");
  process.exit(1);
}
console.log(`✔ Registry OK — ${TOOLS.length} tools in ${CATEGORIES.length} categories (${[...byCategory].map(([k, v]) => `${k} ${v}`).join(", ")})`);
