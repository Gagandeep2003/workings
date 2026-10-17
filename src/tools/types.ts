import type { Value } from "@/lib/format";
import type { ToolIconName } from "@/components/icon-data";
import type { Block as MarkdownBlock } from "@/lib/markdown";

export type CategoryId = "math" | "everyday" | "student" | "career" | "money" | "developer" | "exams";
export const CATEGORY_IDS: CategoryId[] = ["math", "everyday", "student", "career", "money", "developer", "exams"];

// ---- Inputs ------------------------------------------------------------------------------------
export type ShowIf = { field: string; equals: string | string[] };

type BaseInput = {
  id: string;
  label: string;
  hint?: string;
  /** Fields are required unless this is explicitly false. */
  required?: boolean;
  showIf?: ShowIf;
  /** Span both columns of the form grid (long selects, text areas are always wide). */
  wide?: boolean;
  /** Initial value (always a string, exactly as a user would type it). */
  default?: string;
};

export type NumberInput = BaseInput & {
  type: "number";
  unit?: string;
  prefix?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Negative numbers are rejected unless this is true. */
  allowNegative?: boolean;
  /** Re-format with thousands separators when the field loses focus. */
  group?: boolean;
};
export type TextInput = BaseInput & { type: "text"; placeholder?: string; maxLength?: number; monospace?: boolean };
export type TextareaInput = BaseInput & {
  type: "textarea"; placeholder?: string; rows?: number; maxLength?: number; monospace?: boolean;
};
export type DateInput = BaseInput & { type: "date" };
export type TimeInput = BaseInput & { type: "time" };
export type SelectOption = { value: string; label: string; group?: string; when?: ShowIf };
export type SelectInput = BaseInput & { type: "select"; options: SelectOption[]; fallbackIndex?: number };

export type InputDef = NumberInput | TextInput | TextareaInput | DateInput | TimeInput | SelectInput;
export type FieldValue = string | number | undefined;
/** Values after validation: numbers are parsed, optional empty fields are `undefined`. */
export type Values = Record<string, FieldValue>;

// ---- Results -----------------------------------------------------------------------------------
export type Labeled = { label: string; value: Value; hint?: string };
export type TableCell = string | number | Value;
export type ResultTable = { caption?: string; columns: string[]; rows: TableCell[][]; maxHeight?: boolean };
export type TextBlock = { label: string; value: string; language?: string; copyable?: boolean };
export type Highlight = { text: string; ranges: [number, number][] };

export type ToolOutput = {
  primary: Labeled;
  secondary?: Labeled[];
  table?: ResultTable;
  /** "How this was calculated" lines, with the user's actual numbers substituted. */
  steps?: string[];
  /** Short warnings or assumptions that applied to *this* calculation. */
  notes?: string[];
  texts?: TextBlock[];
  /** A rendered Markdown preview (a parsed tree, never raw HTML). Used by the Markdown previewer. */
  markdown?: MarkdownBlock[];
  qr?: { matrix: boolean[][]; text: string };
  swatch?: string;
  highlight?: Highlight;
  /** Plain-text version used by "Copy result". Generated automatically when omitted. */
  copyText?: string;
};

export type FieldError = { field?: string; message: string };
export type ToolResult = { ok: true; output: ToolOutput } | { ok: false; errors: FieldError[] };

export type EngineContext = {
  /** Today's date in the user's calendar, YYYY-MM-DD. Injected so engines stay deterministic. */
  today: string;
  nowMs: number;
  timeZone: string;
  random: (bytes: number) => Uint8Array;
};

/** Engines are pure functions of their inputs. They may be async (the hash tool uses the browser's Web Crypto API). */
export type Engine = (values: Values, ctx: EngineContext) => ToolResult | Promise<ToolResult>;
export type EngineMap = Record<string, Engine>;

// ---- Tool definition ---------------------------------------------------------------------------
export type Paragraph = string; // supports [[tool-id]] and [[tool-id|anchor text]] links, `code`
export type Example = {
  title: string;
  inputs: Record<string, string>;
  /** Optional narrative shown with the computed result. */
  note?: string;
  /** Pretend "today" for date-dependent examples so the example stays stable. */
  today?: string;
};
export type FormulaDef = { expression: string[]; where?: string[]; plain: string };
export type Faq = { q: string; a: Paragraph };
export type Source = { label: string; url: string };

/** Rules that depend on a jurisdiction / year / institution. Only fill `reviewedOn` when really reviewed. */
export type RegulatoryInfo = {
  region: string;
  appliesTo: string;
  effectiveFrom: string;
  reviewedOn: string;
  sources: Source[];
  note?: string;
};

export type Disclaimer = "finance" | "tax" | "salary" | "exam" | "education" | "estimate" | "security";
export type CommercialIntent = "low" | "medium" | "high";
export type AdProfile = "none" | "minimal" | "standard";
export type Reviewal = "evergreen" | "periodic" | "dynamic";

export type EngineModule =
  | "math/percentage" | "math/fractions" | "math/numbers" | "math/commerce" | "math/motion"
  | "everyday/dates" | "everyday/convert" | "everyday/timezone"
  | "student/marks" | "student/grades"
  | "career/salary" | "career/time" | "career/ctc"
  | "money/loans" | "money/growth" | "money/tax"
  | "developer/json" | "developer/encode" | "developer/web" | "developer/text" | "developer/regex" | "developer/qr"
  | "exams/ssc"
  | "math/algebra"
  | "math/geometry"
  | "math/numtheory"
  | "math/statistics"
  | "math/scientific"
  | "everyday/time"
  | "money/planning"
  | "career/overtime"
  | "developer/hash"
  | "developer/diff"
  | "developer/cron"
  | "developer/more"
  | "developer/markdown"
  | "exams/entrance"
  | "exams/gate"
  | "exams/management"
  | "exams/percentile"
  | "exams/government"
  | "exams/planner";

export type ToolDefinition = {
  id: string;
  slug: string;
  category: CategoryId;
  title: string;
  /** Icon name from src/components/icon-data.ts (Lucide). Shown on tool cards and the tool page header. */
  icon: ToolIconName;
  h1: string;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  aliases: string[];
  /** Natural phrases people type, e.g. "how much is 15% of 200". */
  phrases?: string[];
  tags: string[];
  engineModule: EngineModule;
  inputs: InputDef[];
  /** Which labels the engine returns — validated by tests against the real engine output. */
  output: { primary: string[]; secondary?: string[] };
  /** One-sentence explanation shown directly under the H1. */
  intro: string;
  formula: FormulaDef;
  howItWorks: Paragraph[];
  examples: Example[];
  assumptions: string[];
  faqs?: Faq[];
  disclaimer?: Disclaimer;
  regulatory?: RegulatoryInfo;
  relatedTools: string[];
  requiresDynamicData: boolean;
  /** "live" recalculates while typing; "submit" waits for Enter / the button. */
  mode: "submit" | "live";
  submitLabel?: string;
  /** Pair of select fields that can be swapped with one click. */
  swapFields?: [string, string];
  /** Share links put the inputs in the URL fragment. Disabled for tools that handle secrets. */
  shareable: boolean;
  /** Exams only: set for general tools that apply no exam-specific rule (so there is no scheme, source or year to cite). */
  ruleFree?: boolean;
  /** The real date (YYYY-MM-DD) this tool was first published. Drives the home page's "Recently added" list; leave unset if unknown. */
  addedOn?: string;
  /** Keep what the visitor typed in this browser (localStorage) between visits. Never leaves the device. */
  persist?: boolean;
  reviewal: Reviewal;
  commercialIntent: CommercialIntent;
  adProfile: AdProfile;
  affiliateProfile?: { categories: string[]; maxItems?: number };
  sponsorProfile?: { placements: string[] };
  /** Real, meaningful modification date (YYYY-MM-DD). Leave unset unless the content was genuinely revised. */
  lastModified?: string;
};

export type ToolRuntime = {
  id: string;
  category: CategoryId;
  title: string;
  engineModule: EngineModule;
  inputs: InputDef[];
  mode: "submit" | "live";
  submitLabel: string;
  swapFields?: [string, string];
  shareable: boolean;
  persist?: boolean;
  examples: { title: string; inputs: Record<string, string> }[];
  primaryLabel: string;
};

export type CategoryDef = {
  id: CategoryId;
  name: string;
  icon: string;
  tagline: string;
  seoTitle: string;
  seoDescription: string;
  intro: string[];
  groups: { title: string; description?: string; toolIds: string[]; /** Tools from other categories shown as "also useful" links. */ alsoToolIds?: string[] }[];
};
