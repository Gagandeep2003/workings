/**
 * Editorial choices for the home page, in one place. Every id is checked against the registry by
 * `npm run validate:registry`, so a renamed or removed tool fails the build instead of leaving a dead card.
 * Everything else the home page shows (counts, category cards, "Recently added") is derived from the registry.
 */
export const HOME = {
  /** Shown as the large cards under the search box. Chosen for usefulness, not novelty. */
  popular: [
    "image-compressor", "jpg-to-pdf", "merge-pdf", "passport-photo-resizer",
    "percentage-calculator", "emi-calculator", "sip-calculator", "gst-calculator",
    "age-calculator", "cgpa-to-percentage-calculator", "unit-converter", "pdf-compressor",
  ],
  /** Short suggestion chips under the hero search box. */
  searchChips: ["image-compressor", "jpg-to-pdf", "percentage-calculator", "emi-calculator", "age-calculator", "json-formatter"],
  sections: [
    {
      key: "files",
      title: "Image and PDF tools",
      blurb: "Compress, resize, convert and merge files. They never leave your device.",
      category: "image-pdf" as const,
      ids: ["image-compressor", "image-resizer", "image-converter", "passport-photo-resizer", "jpg-to-pdf", "merge-pdf", "split-pdf", "pdf-compressor"],
    },
    {
      key: "essential",
      title: "Essential calculators",
      blurb: "Everyday maths, solved step by step.",
      category: "math" as const,
      ids: ["scientific-calculator", "fraction-calculator", "ratio-calculator", "average-calculator", "square-root-calculator", "hcf-lcm-calculator", "quadratic-equation-solver", "standard-deviation-calculator"],
    },
    {
      key: "exams",
      title: "Student and exam tools",
      blurb: "Marks, percentiles and scores for the exams students ask about most.",
      category: "exams" as const,
      ids: ["jee-main-marks-calculator", "neet-ug-marks-calculator", "gate-score-calculator", "cat-score-calculator", "ssc-cgl-tier-1-score-calculator", "upsc-prelims-score-calculator", "cgpa-to-percentage-calculator", "marks-percentage-calculator"],
    },
    {
      key: "money",
      title: "Money and finance",
      blurb: "Loans, investments and tax-style calculations with the assumptions stated.",
      category: "money" as const,
      ids: ["emi-calculator", "sip-calculator", "lumpsum-calculator", "compound-interest-calculator", "gst-calculator", "fd-calculator", "loan-prepayment-calculator", "ctc-to-take-home-calculator"],
    },
    {
      key: "conversions",
      title: "Everyday conversions",
      blurb: "Exact conversion factors for the units people actually use.",
      category: "everyday" as const,
      ids: ["unit-converter", "length-converter", "weight-converter", "temperature-converter", "data-storage-converter", "speed-converter", "area-converter", "volume-converter"],
    },
    {
      key: "developer",
      title: "Developer utilities",
      blurb: "Run entirely in your browser. Nothing you paste is uploaded.",
      category: "developer" as const,
      ids: ["json-formatter", "csv-to-json-converter", "password-generator", "remove-duplicate-lines", "base64-encode-decode", "regex-tester", "qr-code-generator", "text-diff-checker"],
    },
  ],
};

export const HOME_TOOL_IDS: string[] = [...new Set([...HOME.popular, ...HOME.searchChips, ...HOME.sections.flatMap((s) => s.ids)])];
