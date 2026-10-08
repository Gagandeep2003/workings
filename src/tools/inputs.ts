/** Small builders so tool definitions stay readable. */
import { CURRENCIES } from "@/lib/format";
import type { DateInput, NumberInput, SelectInput, SelectOption, TextInput, TextareaInput, TimeInput } from "./types";

type Rest<T extends { type: string }> = Omit<T, "type">;

export const numberField = (f: Rest<NumberInput>): NumberInput => ({ type: "number", ...f });
export const textField = (f: Rest<TextInput>): TextInput => ({ type: "text", ...f });
export const textareaField = (f: Rest<TextareaInput>): TextareaInput => ({ type: "textarea", rows: 5, ...f });
export const dateField = (f: Rest<DateInput>): DateInput => ({ type: "date", ...f });
export const timeField = (f: Rest<TimeInput>): TimeInput => ({ type: "time", ...f });
export const selectField = (f: Rest<SelectInput>): SelectInput => ({ type: "select", ...f });

export const opts = (...pairs: [string, string][]): SelectOption[] => pairs.map(([value, label]) => ({ value, label }));

/** Optional currency symbol selector shared by all money tools. */
export const currencyField = (defaultCode = ""): SelectInput =>
  selectField({
    id: "currency",
    label: "Currency symbol",
    required: false,
    default: defaultCode,
    hint: "Only changes how amounts are displayed — it never changes the calculation.",
    options: CURRENCIES.map((c) => ({ value: c.code, label: c.label })),
  });

/** Money amounts: grouped, positive, up to a trillion. */
export const amountField = (f: Rest<NumberInput>): NumberInput =>
  numberField({ group: true, max: 1e12, ...f });

export const percentField = (f: Rest<NumberInput>): NumberInput => numberField({ unit: "%", ...f });
