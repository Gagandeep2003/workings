"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type Props = { getText: () => string; label?: string; doneLabel?: string; className?: string; onCopied?: () => void; size?: "sm" | "md"; variant?: "secondary" | "ghost" };

export function CopyButton({ getText, label = "Copy", doneLabel = "Copied", className = "", onCopied, size = "sm", variant = "secondary" }: Props) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <>
      <button
        type="button"
        className={`btn btn--${variant} ${size === "sm" ? "btn--sm" : ""} ${className}`}
        data-state={state === "done" ? "done" : undefined}
        onClick={async () => {
          const ok = await copyToClipboard(getText());
          setState(ok ? "done" : "failed");
          if (ok) onCopied?.();
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setState("idle"), 2200);
        }}
      >
        <Icon name={state === "done" ? "check" : "copy"} />
        {state === "done" ? doneLabel : state === "failed" ? "Press Ctrl+C to copy" : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{state === "done" ? doneLabel : state === "failed" ? "Copy failed" : ""}</span>
    </>
  );
}
