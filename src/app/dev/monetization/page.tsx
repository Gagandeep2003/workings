import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { monetizationDiagnostics } from "@/lib/monetization/diagnostics";

export const metadata: Metadata = { title: "Monetization readiness (dev only)", robots: { index: false, follow: false } };

/** Development-only diagnostic. Returns 404 in production builds. */
export default function MonetizationDiagnostics() {
  if (process.env.NODE_ENV === "production") notFound();
  const rows = monetizationDiagnostics();
  return (
    <div className="container" style={{ paddingBlock: "var(--s-8)" }}>
      <h1>Monetization readiness</h1>
      <p style={{ color: "var(--text-2)", margin: "var(--s-3) 0 var(--s-5)" }}>Visible in development only. Nothing here is rendered in production.</p>
      <div className="table-wrap" role="region" aria-label="Diagnostics" tabIndex={0}>
        <table className="data-table">
          <thead><tr><th scope="col">Check</th><th scope="col">Value</th><th scope="col">Status</th></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r.label}><th scope="row" style={{ fontWeight: 600 }}>{r.label}</th><td className="wrap">{r.value}</td><td>{r.status === "ok" ? "✓ OK" : r.status === "warn" ? "⚠ Check" : "— off"}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
