"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
/** false during server rendering and hydration, true afterwards — avoids setState-in-effect for browser-only values. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
