import type { CategoryDef, CategoryId } from "./types";

export const CATEGORIES: CategoryDef[] = [
  {
    id: "math",
    name: "Math",
    icon: "math",
    tagline: "Percentages, fractions, algebra, geometry and statistics",
    seoTitle: "Math Calculators — Percentage, Algebra, Geometry",
    seoDescription: "Free math calculators with the working shown: percentage, fractions, scientific calculator, quadratic solver, primes, triangle, circle, standard deviation and more.",
    intro: [
      "These are the calculations people reach for most often — what is 15% of 240, how much did a price change, what do three fractions add up to. Each tool gives the answer first and then the steps behind it, so you can check the result or copy the method into your own homework or spreadsheet.",
      "Percentages have the most pages because the same word hides different questions: a percentage of a number, a change between two numbers and a difference between two numbers each use a different formula. The tools below keep them separate on purpose.",
    ],
    groups: [
      { title: "Percentages", description: "Percent of a number, increase, decrease, change, difference and error.", toolIds: ["percentage-calculator", "percentage-increase-calculator", "percentage-decrease-calculator", "percentage-change-calculator", "percentage-difference-calculator", "percentage-error-calculator"] },
      { title: "Fractions and ratios", toolIds: ["fraction-calculator", "fraction-to-decimal-calculator", "decimal-to-fraction-calculator", "fraction-to-percentage-calculator", "ratio-calculator", "proportion-calculator"] },
      { title: "Algebra and powers", toolIds: ["scientific-calculator", "quadratic-equation-solver", "linear-equation-solver", "exponent-calculator", "square-root-calculator", "logarithm-calculator"] },
      { title: "Geometry", toolIds: ["pythagorean-theorem-calculator", "triangle-calculator", "circle-calculator", "area-volume-calculator"] },
      { title: "Averages, statistics and probability", toolIds: ["average-calculator", "weighted-average-calculator", "standard-deviation-calculator", "permutation-combination-calculator", "probability-calculator"] },
      { title: "Number theory", toolIds: ["hcf-lcm-calculator", "prime-number-checker", "prime-factorization-calculator", "divisibility-checker", "remainder-calculator"] },
      { title: "Shopping, speed and work", toolIds: ["profit-loss-calculator", "discount-calculator", "speed-time-distance-calculator", "time-and-work-calculator"] },
    ],
  },
  {
    id: "image-pdf",
    name: "Image & PDF",
    inline: "image & PDF",
    h1: "Image and PDF tools",
    icon: "image",
    tagline: "Compress, resize, convert and combine images and PDFs, without uploading them",
    seoTitle: "Image & PDF Tools – Compress, Resize, Convert, Merge",
    seoDescription: "Free image and PDF tools that run in your browser: image compressor, photo and signature resizer for forms, JPG to PDF, merge, split and compress PDF, plus QR codes.",
    intro: [
      "These tools work on your files, and they do it inside your browser: the pictures and PDFs you choose are processed on your own device and are never uploaded to a server, so passports, certificates, signatures and statements stay private. There is no account, no watermark and no daily limit imposed by this site; what you can process is limited only by your device's memory, and the limits are stated on every page.",
      "Each tool says honestly what it can and cannot do. Image compression is lossy and not every file shrinks; a PDF made only of text may not get smaller; a password-protected or signed PDF changes when it is merged or split; and the photo-size presets for application forms are common starting points, not rules, because every exam and portal publishes its own numbers. Where a limit cannot be met, the tool tells you instead of handing over a file that will be rejected.",
    ],
    groups: [
      { title: "Compress, resize and convert images", description: "Smaller files, exact dimensions, and the format you need.", toolIds: ["image-compressor", "image-resizer", "image-converter"] },
      { title: "Photos and signatures for forms", description: "Exact pixels and KB limits for exam, job and government application forms.", toolIds: ["passport-photo-resizer", "signature-resizer"] },
      { title: "PDF tools", description: "Turn pictures into a PDF, join files, pull pages out and shrink the result.", toolIds: ["jpg-to-pdf", "merge-pdf", "split-pdf", "pdf-compressor"] },
      { title: "QR codes", description: "Codes for networks and payments; links, text and contacts are in the main QR generator.", toolIds: ["wifi-qr-code-generator", "upi-qr-code-generator"], alsoToolIds: ["qr-code-generator"] },
    ],
  },
  {
    id: "everyday",
    name: "Everyday",
    icon: "calendar",
    tagline: "Dates, ages, time, pace and unit conversions",
    seoTitle: "Date, Age and Unit Converters for Everyday Use",
    seoDescription: "Free age, date and time-zone calculators plus length, weight, temperature, area, volume, speed and fuel-economy converters with exact factors.",
    intro: [
      "Everyday questions usually come down to two things: how long between two moments, and how big something is in another unit. Date tools here use pure calendar arithmetic, so leap years and month lengths are handled exactly and nothing depends on your time zone. Time-zone conversion is the one exception — it uses your device's time-zone database.",
      "All converters read from one shared table of conversion factors, using the exact legal definitions (an inch is exactly 25.4 mm, a US gallon is exactly 231 cubic inches), so two pages never disagree with each other.",
    ],
    groups: [
      { title: "Dates and time", toolIds: ["age-calculator", "days-between-dates-calculator", "days-until-date-calculator", "date-add-subtract-calculator", "working-days-calculator", "time-duration-calculator", "timezone-converter", "pace-calculator"] },
      { title: "Unit converters", toolIds: ["unit-converter", "length-converter", "weight-converter", "temperature-converter", "area-converter", "volume-converter", "speed-converter", "fuel-economy-converter", "data-storage-converter"] },
    ],
  },
  {
    id: "student",
    name: "Student",
    icon: "graduation",
    tagline: "Marks, percentages, CGPA, GPA and attendance",
    seoTitle: "Student Calculators — CGPA, GPA, Marks, Attendance",
    seoDescription: "Marks percentage, CGPA to percentage, GPA, SGPA, weighted grades, required marks and attendance calculators, with the method stated for every conversion.",
    intro: [
      "Grading systems differ between boards and universities, so these tools state their method on the page and, where institutions disagree, let you enter your own formula rather than guessing. CGPA-to-percentage conversion is the clearest example: the CBSE rule is published, but universities each set their own, so the page says so and offers a custom option.",
      "Everything runs on your device. Marks, grades and attendance numbers never leave the page.",
    ],
    groups: [
      { title: "Marks and percentages", toolIds: ["marks-percentage-calculator", "weighted-marks-calculator", "required-marks-calculator", "exam-score-calculator"] },
      { title: "CGPA, GPA and SGPA", toolIds: ["cgpa-calculator", "cgpa-to-percentage-calculator", "percentage-to-cgpa-calculator", "gpa-calculator", "sgpa-calculator"] },
      { title: "Attendance", toolIds: ["attendance-percentage-calculator", "required-attendance-calculator"] },
    ],
  },
  {
    id: "career",
    name: "Career",
    icon: "briefcase",
    tagline: "Salary hikes, take-home pay, experience and notice periods",
    seoTitle: "Career Calculators — Salary Hike, CTC, Notice Period",
    seoDescription: "Salary increment, hike percentage, offer comparison, CTC to take-home (India), experience, notice period and leave calculators with assumptions shown.",
    intro: [
      "Pay and employment rules vary by country, employer and contract, so these tools do the arithmetic and tell you plainly which assumptions they make. The CTC take-home tool, for example, is an estimate for salaried employees in India under the new tax regime for the year stated on its page — it is not a payslip.",
      "Date-based tools such as experience and notice period count days exactly, including leap years, and explain the convention they use so you can match it to your employer's.",
    ],
    groups: [
      { title: "Pay", toolIds: ["salary-increment-calculator", "salary-hike-percentage-calculator", "salary-comparison-calculator", "hourly-to-salary-calculator", "overtime-pay-calculator", "ctc-to-take-home-calculator"] },
      { title: "Time at work", toolIds: ["experience-calculator", "notice-period-calculator", "leave-calculator"] },
    ],
  },
  {
    id: "money",
    name: "Money",
    icon: "coins",
    tagline: "EMI, interest, SIP, FD, RD, GST and inflation",
    seoTitle: "Money Calculators — EMI, SIP, FD, Interest, GST",
    seoDescription: "EMI, loan amortization, simple and compound interest, SIP, FD, RD, CAGR, inflation and GST calculators with the formula and assumptions on every page.",
    intro: [
      "These calculators implement standard financial mathematics and show their assumptions — compounding frequency, payment timing, rounding — instead of hiding them. Amounts are held in whole cents or paise while a schedule is built, so a loan balance ends at exactly zero.",
      "They calculate; they do not advise. Real products add fees, taxes and rules that no generic calculator can know, so treat results as a planning figure and confirm with your lender, bank or adviser.",
    ],
    groups: [
      { title: "Loans", toolIds: ["emi-calculator", "amortization-schedule-calculator", "loan-prepayment-calculator", "loan-affordability-calculator", "loan-interest-rate-calculator"] },
      { title: "Saving and investing", toolIds: ["sip-calculator", "lumpsum-calculator", "fd-calculator", "rd-calculator", "compound-interest-calculator", "simple-interest-calculator", "cagr-calculator"] },
      { title: "Prices and inflation", toolIds: ["gst-calculator", "inflation-calculator"] },
    ],
  },
  {
    id: "developer",
    name: "Developer",
    icon: "code",
    tagline: "JSON, text, CSV, hashes, URLs, JWTs, regex and more — all local",
    seoTitle: "Developer Tools — JSON, Base64, JWT, Regex, UUID",
    seoDescription: "Browser-based developer tools: JSON formatter, CSV and JSON converters, Base64, hash and password generators, JWT decoder, regex tester, text tools and QR codes.",
    intro: [
      "Everything on these pages runs in your browser. The JSON, tokens, text and code you paste are processed on your device and are never uploaded, stored or sent to analytics, so it is safe to paste real payloads while debugging. Share links are switched off for these tools for the same reason.",
      "Where behaviour differs between environments the page says so — the JSON tools follow the JSON specification strictly, the regex tester uses JavaScript's engine, and the JWT decoder only decodes: it never claims a token is valid.",
    ],
    groups: [
      { title: "JSON", toolIds: ["json-formatter", "json-validator", "json-minifier"] },
      { title: "Encoding, hashing and tokens", toolIds: ["base64-encode-decode", "url-encode-decode", "html-entity-encoder-decoder", "hash-generator", "jwt-decoder", "uuid-generator", "unix-timestamp-converter"] },
      { title: "Code and text", toolIds: ["regex-tester", "text-diff-checker", "markdown-previewer", "html-formatter", "css-formatter", "slug-generator"] },
      { title: "Text cleanup and lists", description: "Count, clean, sort, deduplicate and replace text.", toolIds: ["word-counter", "case-converter", "remove-duplicate-lines", "sort-lines", "find-and-replace-text", "remove-extra-spaces"] },
      { title: "Data conversion and generators", toolIds: ["csv-to-json-converter", "json-to-csv-converter", "password-generator", "lorem-ipsum-generator"] },
      { title: "Web, colour and scheduling", toolIds: ["url-parser", "color-converter", "contrast-checker", "cron-expression-explainer", "qr-code-generator"], alsoToolIds: ["wifi-qr-code-generator", "upi-qr-code-generator"] },
    ],
  },
  {
    id: "exams",
    name: "Exams",
    icon: "target",
    tagline: "Marks and score calculators for JEE, NEET, GATE, CAT, SSC, banking, UPSC and railway exams",
    seoTitle: "Exam Score Calculators — JEE, NEET, GATE, CAT, SSC",
    seoDescription: "Score calculators for JEE Main and Advanced, NEET UG, GATE, CAT, SSC, banking, UPSC and railway exams, each with its marking scheme, source and review date.",
    intro: [
      "Exam rules change between notifications, so each calculator here names the exam cycle it follows, lists where its marking scheme came from and shows when it was checked. Where reliable sources disagree — for example on a penalty — the tool says so and shows both outcomes instead of picking one silently.",
      "Marks, percentages, percentiles, scaled scores, ranks and cut-offs are different things, and these tools keep them apart. They add up raw marks from your own answer count and apply published definitions such as the percentile formula to figures you provide. They do not turn marks into a rank or a percentile, because that needs every candidate's results; no tool here predicts a cut-off or an official result.",
    ],
    groups: [
      { title: "Engineering entrance (JEE)", description: "Marks, percentile and partial-marking calculators.", toolIds: ["jee-main-marks-calculator", "jee-main-percentile-calculator", "jee-advanced-marks-calculator"] },
      { title: "Medical entrance (NEET UG)", toolIds: ["neet-ug-marks-calculator", "neet-qualifying-cutoff-checker"] },
      { title: "Postgraduate engineering (GATE)", toolIds: ["gate-marks-calculator", "gate-score-calculator"] },
      { title: "Management entrance (CAT)", toolIds: ["cat-score-calculator", "cat-percentile-calculator"] },
      { title: "Government and recruitment exams", toolIds: ["ssc-cgl-tier-1-score-calculator", "ssc-chsl-tier-1-score-calculator", "ssc-mts-score-calculator", "banking-prelims-score-calculator", "upsc-prelims-score-calculator", "rrb-ntpc-group-d-score-calculator"] },
      { title: "General exam tools", description: "Plan a target and track mock tests, for any exam.", toolIds: ["target-score-planner", "mock-test-tracker"], alsoToolIds: ["exam-score-calculator", "required-marks-calculator", "marks-percentage-calculator", "days-until-date-calculator"] },
    ],
  },
];

export const CATEGORY_BY_ID = new Map<CategoryId, CategoryDef>(CATEGORIES.map((c) => [c.id, c]));
export const isCategoryId = (x: string): x is CategoryId => CATEGORY_BY_ID.has(x as CategoryId);
