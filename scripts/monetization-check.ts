import { monetizationDiagnostics } from "../src/lib/monetization/diagnostics";

const rows = monetizationDiagnostics();
const width = Math.max(...rows.map((r) => r.label.length));
console.log("\nMonetization readiness (development report)\n");
for (const r of rows) console.log(`${r.status === "ok" ? "✔" : r.status === "warn" ? "⚠" : "·"} ${r.label.padEnd(width)}  ${r.value}`);
console.log("\nEverything is off by default; the site works fully with all monetization disabled.");
process.exit(rows.some((r) => r.label.startsWith("Invalid") && r.status === "warn") ? 1 : 0);
