"use client";
import { useId } from "react";
import { Icon } from "../Icon";
import type { InputDef } from "@/tools/types";
import { visibleOptions, parseNumberText } from "@/lib/form";
import { formatNumber } from "@/lib/format";

type FieldProps = {
  input: InputDef;
  idPrefix: string;
  value: string;
  values: Record<string, string>;
  error?: string;
  onChange: (id: string, value: string) => void;
  onBlur: (id: string) => void;
  onTextareaSubmit?: () => void;
};

export function Field({ input, idPrefix, value, values, error, onChange, onBlur, onTextareaSubmit }: FieldProps) {
  const base = `${idPrefix}-${input.id}`;
  const hintId = input.hint ? `${base}-hint` : undefined;
  const readId = `${base}-read`;
  const errId = error ? `${base}-err` : undefined;
  const required = input.required !== false;

  let readback: string | undefined;
  if (input.type === "number" && input.group && value) {
    const p = parseNumberText(value);
    if (p.ok && Math.abs(p.value) >= 10000) {
      const grouped = formatNumber(p.value, { maxDecimals: 6 });
      if (grouped !== value.trim().replace(/^\+/, "")) readback = grouped; // only when it adds something the user can't already see
    }
  }
  const describedBy = [hintId, readback ? readId : undefined, errId].filter(Boolean).join(" ") || undefined;
  const common = {
    id: base,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    "aria-required": required ? true : undefined,
  } as const;

  let control: React.ReactNode;
  switch (input.type) {
    case "number":
      control = (
        <div className="control-wrap">
          <input
            {...common}
            className={`input input--num ${input.unit ? "input--has-unit" : ""}`}
            type="text"
            inputMode={input.allowNegative || (input.min !== undefined && input.min < 0) ? "text" : input.integer ? "numeric" : "decimal"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={input.placeholder}
            value={value}
            onChange={(e) => onChange(input.id, e.target.value)}
            onBlur={() => onBlur(input.id)}
          />
          {input.unit && <span className="control-unit" aria-hidden="true">{input.unit}</span>}
        </div>
      );
      break;
    case "text":
      control = <input {...common} className={`input ${input.monospace ? "input--mono" : ""}`} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={input.placeholder} maxLength={input.maxLength} value={value} onChange={(e) => onChange(input.id, e.target.value)} onBlur={() => onBlur(input.id)} />;
      break;
    case "textarea":
      control = (
        <textarea
          {...common}
          className={`textarea ${input.monospace ? "textarea--mono" : ""}`}
          rows={input.rows ?? 5}
          placeholder={input.placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(input.id, e.target.value)}
          onBlur={() => onBlur(input.id)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onTextareaSubmit?.(); } }}
        />
      );
      break;
    case "date":
      control = <input {...common} className="input" type="date" min="0001-01-01" max="9999-12-31" value={value} onChange={(e) => onChange(input.id, e.target.value)} onBlur={() => onBlur(input.id)} />;
      break;
    case "time":
      control = <input {...common} className="input" type="time" value={value} onChange={(e) => onChange(input.id, e.target.value)} onBlur={() => onBlur(input.id)} />;
      break;
    case "select": {
      const options = visibleOptions(input, values);
      const groups = [...new Set(options.map((o) => o.group).filter(Boolean))] as string[];
      control = (
        <select {...common} className="select" value={value} onChange={(e) => onChange(input.id, e.target.value)} onBlur={() => onBlur(input.id)}>
          {groups.length === 0
            ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
            : groups.map((g) => (
                <optgroup key={g} label={g}>
                  {options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
        </select>
      );
      break;
    }
  }

  return (
    <div className={`field ${input.wide || input.type === "textarea" ? "field--wide" : ""}`}>
      <label className="field__label" htmlFor={base}>
        {input.label}
        {!required && <span className="field__optional">(optional)</span>}
      </label>
      {control}
      {input.hint && <p className="field__hint" id={hintId}>{input.hint}</p>}
      {readback && <p className="field__readback" id={readId}>Reads as {readback}</p>}
      {error && (
        <p className="field__error" id={errId}>
          <Icon name="alert" />
          <ErrorText message={error} />
        </p>
      )}
    </div>
  );
}

/** Message text; if it carries a code excerpt after the first line, show that line-for-line in monospace so the caret lines up. */
export function ErrorText({ message }: { message: string }) {
  const nl = message.indexOf("\n");
  if (nl === -1) return <span>{message}</span>;
  return (
    <span style={{ minWidth: 0 }}>
      <span>{message.slice(0, nl)}</span>
      <code className="err-excerpt">{message.slice(nl + 1)}</code>
    </span>
  );
}

export function useFieldIdPrefix(): string {
  return useId().replace(/:/g, "");
}
