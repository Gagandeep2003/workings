"use client";
import { useEffect, useState } from "react";
import { Icon } from "../Icon";

type Mode = "system" | "light" | "dark";
const KEY = "workings-theme";
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Mode, string> = { system: "System", light: "Light", dark: "Dark" };
const ICON = { system: "monitor", light: "sun", dark: "moon" } as const;

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

/**
 * Cycles System → Light → Dark. The choice is kept in this browser only (localStorage). A tiny inline script in the
 * root layout applies it before first paint, so there is no flash of the wrong theme.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    let saved: Mode = "system";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") saved = v;
    } catch { /* storage blocked: stay on the system theme */ }
    // Sync React state with what the pre-paint script already applied to the document.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(saved);
  }, []);

  const choose = () => {
    const next = NEXT[mode];
    setMode(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch { /* ignore */ }
  };

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={choose}
      aria-label={`Colour theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}.`}
      title={`Theme: ${LABEL[mode]} (click for ${LABEL[NEXT[mode]]})`}
    >
      <Icon name={ICON[mode]} />
    </button>
  );
}
