/** Form helpers shared by the UI and the tests: visibility rules, parsing and validation. */
import type { FieldError, InputDef, NumberInput, SelectInput, SelectOption, Values } from "@/tools/types";

const MAX_TEXT = 200_000;
const MAX_SAFE_INPUT = 1e15;

export function isVisible(input: InputDef, values: Record<string, string>): boolean {
  if (!input.showIf) return true;
  const current = values[input.showIf.field] ?? "";
  const expected = input.showIf.equals;
  return Array.isArray(expected) ? expected.includes(current) : current === expected;
}

export function visibleOptions(input: SelectInput, values: Record<string, string>): SelectOption[] {
  return input.options.filter((o) => {
    if (!o.when) return true;
    const current = values[o.when.field] ?? "";
    return Array.isArray(o.when.equals) ? o.when.equals.includes(current) : current === o.when.equals;
  });
}

export function defaultValues(inputs: InputDef[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const input of inputs) {
    if (input.default !== undefined) values[input.id] = input.default;
    else if (input.type === "select") values[input.id] = input.options[0]?.value ?? "";
    else values[input.id] = "";
  }
  return normalizeSelects(inputs, values);
}

/** Keep dependent selects on a valid option when the controlling field changes. */
export function normalizeSelects(inputs: InputDef[], values: Record<string, string>): Record<string, string> {
  const next = { ...values };
  for (const input of inputs) {
    if (input.type !== "select") continue;
    const options = visibleOptions(input, next);
    if (options.length && !options.some((o) => o.value === next[input.id])) next[input.id] = (options[input.fallbackIndex ?? 0] ?? options[0]).value;
  }
  return next;
}

export type ParsedNumber = { ok: true; value: number } | { ok: false; message: string };

const PLAIN = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const WESTERN = /^[+-]?\d{1,3}(,\d{3})+(\.\d*)?$/;
const LAKH = /^[+-]?\d{1,2}(,\d{2})*,\d{3}(\.\d*)?$/;

/** Parse what a person types into a number. Accepts 1,234.5 and 12,34,567 grouping, a trailing % and currency symbols. */
export function parseNumberText(raw: string): ParsedNumber {
  let text = raw.trim().replace(/\u2212/g, "-").replace(/\s/g, "");
  text = text.replace(/^([+-]?)[$€£₹]/, "$1").replace(/%$/, "");
  if (text === "") return { ok: false, message: "Enter a number." };
  if (/^[+-]?\d+,\d{1,2}$/.test(text) && !text.includes(".")) {
    return { ok: false, message: "Use a dot for decimals (for example 12.5). Commas are only for thousands." };
  }
  if (text.includes(",")) {
    if (!(WESTERN.test(text) || LAKH.test(text))) {
      return { ok: false, message: "Commas must separate thousands (1,234 or 12,34,567). Use a dot for decimals." };
    }
    text = text.replace(/,/g, "");
  }
  if (!PLAIN.test(text)) return { ok: false, message: "Enter a plain number such as 250, 12.5 or -3." };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, message: "That number is too large." };
  return { ok: true, value };
}

export function formatForField(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 10, useGrouping: true }).format(value);
}

function validateNumber(input: NumberInput, raw: string): { value?: number; error?: string } {
  const parsed = parseNumberText(raw);
  if (!parsed.ok) return { error: parsed.message };
  const { value } = parsed;
  const unit = input.unit ? ` ${input.unit}` : "";
  if (Math.abs(value) > MAX_SAFE_INPUT && input.max === undefined) return { error: "That number is too large to calculate reliably." };
  if (value < 0 && !input.allowNegative && !(input.min !== undefined && input.min < 0)) {
    return { error: `${input.label} can't be negative.` };
  }
  if (input.integer && !Number.isInteger(value)) return { error: `${input.label} must be a whole number.` };
  if (input.min !== undefined && value < input.min) return { error: `${input.label} must be at least ${input.min}${unit}.` };
  if (input.max !== undefined && value > input.max) return { error: `${input.label} can't be more than ${input.max}${unit}.` };
  return { value };
}

export type ValidationResult = { errors: Record<string, string>; values: Values };

/** Validate raw string inputs against their definitions. Hidden fields are ignored. */
export function validateInputs(inputs: InputDef[], raw: Record<string, string>): ValidationResult {
  const errors: Record<string, string> = {};
  const values: Values = {};
  for (const input of inputs) {
    if (!isVisible(input, raw)) continue;
    const text = raw[input.id] ?? "";
    const required = input.required !== false;
    if (text.trim() === "") {
      if (required) {
        errors[input.id] = input.type === "select" ? `Choose ${input.label.toLowerCase()}.` : `${input.label} is required.`;
      }
      values[input.id] = input.type === "select" ? text : undefined;
      continue;
    }
    switch (input.type) {
      case "number": {
        const r = validateNumber(input, text);
        if (r.error) errors[input.id] = r.error;
        else values[input.id] = r.value;
        break;
      }
      case "select": {
        const ok = visibleOptions(input, raw).some((o) => o.value === text);
        if (!ok) errors[input.id] = `Choose a valid option for ${input.label.toLowerCase()}.`;
        else values[input.id] = text;
        break;
      }
      case "date": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) errors[input.id] = "Enter a date as YYYY-MM-DD, or use the date picker.";
        else values[input.id] = text;
        break;
      }
      case "time": {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) errors[input.id] = "Enter a time as HH:MM (24-hour), for example 14:30.";
        else values[input.id] = text;
        break;
      }
      case "text":
      case "textarea": {
        const max = input.maxLength ?? MAX_TEXT;
        if (text.length > max) errors[input.id] = `${input.label} is too long (limit ${max.toLocaleString("en-US")} characters).`;
        else values[input.id] = input.type === "textarea" ? text : text.trim();
        break;
      }
    }
  }
  return { errors, values };
}

export function fieldErrorsToMap(errors: FieldError[]): { fields: Record<string, string>; general: string[] } {
  const fields: Record<string, string> = {};
  const general: string[] = [];
  for (const e of errors) {
    if (e.field && !fields[e.field]) fields[e.field] = e.message;
    else if (!e.field) general.push(e.message);
  }
  return { fields, general };
}
