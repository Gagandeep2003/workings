"use client";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "../Icon";
import { ErrorText, Field } from "./Fields";
import { ResultView } from "./ResultView";
import { EXAMPLE_EVENT } from "./TryExample";
import { loadEngine } from "@/engines/loaders";
import { outputToText } from "@/engines/helpers";
import { defaultValues, fieldErrorsToMap, formatForField, isVisible, normalizeSelects, parseNumberText, validateInputs } from "@/lib/form";
import { localTodayISO } from "@/lib/dates";
import { trackEvent } from "@/lib/analytics";
import { copyToClipboard } from "./CopyButton";
import type { Engine, EngineContext, ToolOutput, ToolRuntime } from "@/tools/types";

const MAX_SHARE_URL = 1800;

function makeContext(): EngineContext {
  return {
    today: localTodayISO(),
    nowMs: Date.now(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    random: (n) => crypto.getRandomValues(new Uint8Array(n)),
  };
}

function readHash(tool: ToolRuntime): Record<string, string> | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.includes("=")) return null;
  const params = new URLSearchParams(hash);
  const found: Record<string, string> = {};
  for (const input of tool.inputs) {
    const raw = params.get(input.id);
    if (raw === null) continue;
    const text = raw.slice(0, input.type === "textarea" ? 2000 : 300);
    if (input.type === "select" && !input.options.some((o) => o.value === text)) continue; // untrusted: only known options
    found[input.id] = text;
  }
  return Object.keys(found).length ? found : null;
}

export function ToolRunner({ tool }: { tool: ToolRuntime }) {
  const uid = useId().replace(/:/g, "");
  const initial = useRef(defaultValues(tool.inputs));
  const [values, setValues] = useState<Record<string, string>>(initial.current);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string[]>([]);
  const [output, setOutput] = useState<ToolOutput | null>(null);
  const [stale, setStale] = useState(false);
  const [live, setLive] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const engineRef = useRef<Promise<Engine> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const calcs = useRef(0);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const getEngine = useCallback(() => (engineRef.current ??= loadEngine(tool.engineModule, tool.id)), [tool.engineModule, tool.id]);

  // Start loading this tool's calculation code as soon as the page is interactive.
  useEffect(() => { getEngine().catch(() => setLoadFailed(true)); }, [getEngine]);

  const focusField = useCallback((id: string) => {
    const el = document.getElementById(`${uid}-${id}`);
    el?.focus({ preventScroll: false });
  }, [uid]);

  const run = useCallback(async (vals: Record<string, string>, opts: { explicit: boolean; revealAll: boolean }) => {
    const v = validateInputs(tool.inputs, vals);
    const errorIds = Object.keys(v.errors);
    if (errorIds.length) {
      if (opts.revealAll) {
        setErrors(v.errors);
        setGeneral([]);
        setOutput(null);
        setStale(false);
        const first = tool.inputs.find((i) => v.errors[i.id]);
        if (first) focusField(first.id);
      } else {
        setOutput(null);
        setStale(false);
      }
      return;
    }
    setErrors({});
    try {
      const engine = await getEngine();
      const res = engine(v.values, makeContext());
      if (res.ok) {
        setOutput(res.output);
        setGeneral([]);
        setStale(false);
        setShareNote("");
        setLive(`${res.output.primary.label}: ${outputToText(tool.title, res.output).split("\n")[1]?.split(": ").slice(1).join(": ") ?? ""}`);
        if (opts.explicit || calcs.current === 0) trackEvent("tool_calculation", { toolId: tool.id, category: tool.category });
        calcs.current++;
        if (opts.explicit) {
          requestAnimationFrame(() => {
            const el = resultRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (r.top > window.innerHeight * 0.75 || r.top < 0) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
          });
        }
      } else {
        const { fields, general: gen } = fieldErrorsToMap(res.errors);
        setErrors(fields);
        setGeneral(gen);
        setOutput(null);
        setStale(false);
        if (opts.explicit) {
          const first = tool.inputs.find((i) => fields[i.id]);
          if (first) focusField(first.id);
        }
      }
    } catch (e) {
      console.error(e);
      setGeneral(["Something went wrong while calculating. Please check your inputs and try again."]);
      setOutput(null);
    }
  }, [tool, getEngine, focusField]);

  // live tools recalculate while typing
  useEffect(() => {
    if (tool.mode !== "live" || !dirty.current) return;
    const t = window.setTimeout(() => { void run(values, { explicit: false, revealAll: false }); }, 140);
    return () => window.clearTimeout(t);
  }, [values, tool.mode, run]);

  // restore a shared link, and listen for "Try this example"
  useEffect(() => {
    const fromHash = readHash(tool);
    if (fromHash) {
      const next = normalizeSelects(tool.inputs, { ...initial.current, ...fromHash });
      setValues(next);
      dirty.current = true;
      void run(next, { explicit: false, revealAll: true });
    }
    const onExample = (e: Event) => {
      const d = (e as CustomEvent<{ toolId: string; inputs: Record<string, string> }>).detail;
      if (d.toolId !== tool.id) return;
      const next = normalizeSelects(tool.inputs, { ...initial.current, ...d.inputs });
      setValues(next);
      dirty.current = true;
      void run(next, { explicit: true, revealAll: true });
    };
    window.addEventListener(EXAMPLE_EVENT, onExample);
    return () => window.removeEventListener(EXAMPLE_EVENT, onExample);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.id]);

  const onChange = (id: string, text: string) => {
    dirty.current = true;
    setValues((prev) => normalizeSelects(tool.inputs, { ...prev, [id]: text }));
    setErrors((e) => { if (!e[id]) return e; const { [id]: _drop, ...rest } = e; void _drop; return rest; });
    if (tool.mode === "submit") setStale(true);
  };

  const onBlur = (id: string) => {
    const input = tool.inputs.find((i) => i.id === id);
    if (!input) return;
    const text = valuesRef.current[id] ?? "";
    if (input.type === "number" && input.group && text.trim() !== "") {
      const p = parseNumberText(text);
      if (p.ok && /^[+-]?\d+(\.\d*)?$/.test(text.trim())) setValues((prev) => ({ ...prev, [id]: formatForField(p.value) }));
    }
    if (text.trim() === "") return; // "required" is only reported on submit
    const v = validateInputs(tool.inputs, valuesRef.current);
    if (v.errors[id]) setErrors((e) => ({ ...e, [id]: v.errors[id] }));
  };

  const submit = (e?: React.FormEvent) => { e?.preventDefault(); void run(values, { explicit: true, revealAll: true }); };

  const reset = () => {
    const fresh = defaultValues(tool.inputs);
    setValues(fresh);
    setErrors({});
    setGeneral([]);
    setOutput(null);
    setStale(false);
    setLive("");
    setShareNote("");
    dirty.current = false;
    calcs.current = 0;
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
    const first = tool.inputs.find((i) => isVisible(i, fresh));
    if (first) focusField(first.id);
  };

  const swap = () => {
    if (!tool.swapFields) return;
    const [a, b] = tool.swapFields;
    dirty.current = true;
    setValues((prev) => ({ ...prev, [a]: prev[b], [b]: prev[a] }));
    if (tool.mode === "submit") setStale(true);
  };

  const share = async () => {
    const params = new URLSearchParams();
    for (const i of tool.inputs) if (isVisible(i, values) && (values[i.id] ?? "") !== "") params.set(i.id, values[i.id]);
    const url = `${window.location.origin}${window.location.pathname}#${params.toString()}`;
    if (url.length > MAX_SHARE_URL) { setShareNote("There is too much data to fit in a link. Use “Copy result” instead."); return; }
    trackEvent("tool_result_share", { toolId: tool.id, category: tool.category });
    const note = "Link copied. It contains the values you entered (after the #, which is never sent to our servers). Only share it with people you’re happy to show them to.";
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: tool.title, url }); setShareNote(""); return; } catch { /* cancelled: fall back to copy */ }
    }
    setShareNote((await copyToClipboard(url)) ? note : "Couldn’t copy automatically. Copy the address from your browser’s address bar after pressing Calculate.");
  };

  const visibleInputs = tool.inputs.filter((i) => isVisible(i, values));
  const hasOptional = visibleInputs.some((i) => i.required === false);
  const errorList = Object.entries(errors).map(([id, message]) => ({ id, message, label: tool.inputs.find((i) => i.id === id)?.label ?? id }));
  const singleColumn = visibleInputs.length <= 2 && visibleInputs.every((i) => i.type === "textarea");
  const headingId = `${uid}-result-title`;

  return (
    <div className={`calc ${singleColumn ? "calc--single" : ""}`}>
      <div className="card calc__form">
        <form ref={formRef} onSubmit={submit} noValidate aria-label={`${tool.title} inputs`}>
          {hasOptional && <p className="required-note">All fields are required unless marked “optional”.</p>}
          <div className="form-grid">
            {(errorList.length > 0 || general.length > 0) && (
              <div className="form-errors" role="alert">
                <strong>{errorList.length + general.length > 1 ? "Please fix these problems:" : "Please fix this problem:"}</strong>
                <ul>
                  {general.map((g) => <li key={g}><ErrorText message={g} /></li>)}
                  {errorList.map((e) => (
                    <li key={e.id}><a href={`#${uid}-${e.id}`} onClick={(ev) => { ev.preventDefault(); focusField(e.id); }}>{e.label}</a>: <ErrorText message={e.message} /></li>
                  ))}
                </ul>
              </div>
            )}
            {loadFailed && <p className="form-errors" role="alert">This calculator couldn’t load. Check your connection and reload the page.</p>}
            {visibleInputs.map((input) => (
              <Fragment key={input.id}>
                <Field
                  input={input}
                  idPrefix={uid}
                  value={values[input.id] ?? ""}
                  values={values}
                  error={errors[input.id]}
                  onChange={onChange}
                  onBlur={onBlur}
                  onTextareaSubmit={() => formRef.current?.requestSubmit()}
                />
                {tool.swapFields && tool.swapFields[1] === input.id && (
                  <div className="swap-row">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={swap}><Icon name="swap" /> Swap</button>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn--primary">{tool.submitLabel}</button>
            <button type="button" className="btn btn--secondary" onClick={reset}><Icon name="reset" /> Reset</button>
          </div>
          {visibleInputs.some((i) => i.type === "textarea") && <p className="form-note">Tip: press Ctrl+Enter (Cmd+Enter on Mac) inside a text box to run.</p>}
        </form>
      </div>
      <div className="calc__result-col" ref={resultRef}>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{live}</div>
        {output ? (
          <ResultView
            output={output}
            copyText={outputToText(tool.title, output)}
            stale={stale}
            shareable={tool.shareable}
            onShare={share}
            onCopied={() => trackEvent("tool_result_copy", { toolId: tool.id, category: tool.category })}
            shareNote={shareNote}
            headingId={headingId}
          />
        ) : (
          <div className="result-placeholder">
            <Icon name="formula" className="icon" style={{ width: "2rem", height: "2rem" }} />
            <strong>Your result will appear here</strong>
            <span>{tool.mode === "live" ? "Start typing and it updates instantly." : `Fill in the fields and press “${tool.submitLabel}”.`}</span>
          </div>
        )}
      </div>
    </div>
  );
}



