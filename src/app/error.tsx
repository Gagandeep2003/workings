"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="container">
      <div className="empty-state">
        <h1>Something went wrong</h1>
        <p>This page hit an unexpected problem. Your inputs aren’t stored anywhere, so nothing is lost. Try again, or head back to the home page.</p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn--primary" onClick={reset} style={{ flex: "0 0 auto" }}>Try again</button>
          <Link href="/" className="btn btn--secondary">Go home</Link>
        </div>
      </div>
    </div>
  );
}
