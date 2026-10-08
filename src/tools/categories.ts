import type { CategoryDef, CategoryId } from "./types";

export const CATEGORIES: CategoryDef[] = [
  {
    id: "math",
    name: "Math",
    icon: "math",
    tagline: "Percentages, fractions, ratios, averages and everyday arithmetic",
    seoTitle: "Math Calculators — Percentages, Fractions, Ratios",
    seoDescription: "Free math calculators that show their working: percentage, fractions, ratio, average, profit and loss, discount, HCF and LCM, probability and more.",
    intro: [
      "These are the calculations people reach for most often — what is 15% of 240, how much did a price change, what do three fractions add up to. Each tool gives the answer first and then the steps behind it, so you can check the result or copy the method into your own homework or spreadsheet.",
      "Percentages have the most pages because the same word hides different questions: a percentage of a number, a change between two numbers and a difference between two numbers each use a different formula. The tools below keep them separate on purpose.",
    ],
    groups: [
      { title: "Percentages", description: "Percent of a number, increase, decrease, change and difference.", toolIds: ["percentage-calculator", "percentage-increase-calculator", "percentage-decrease-calculator", "percentage-change-calculator", "percentage-difference-calculator"] },
      { title: "Fractions and ratios", toolIds: ["fraction-calculator", "fraction-to-decimal-calculator", "decimal-to-fraction-calculator", "fraction-to-percentage-calculator", "ratio-calculator", "proportion-calculator"] },
      { title: "Averages and number theory", toolIds: ["average-calculator", "weighted-average-calculator", "hcf-lcm-calculator", "permutation-combination-calculator", "probability-calculator"] },
      { title: "Shopping, speed and work", toolIds: ["profit-loss-calculator", "discount-calculator", "speed-time-distance-calculator", "time-and-work-calculator"] },
    ],
  },
  {
    id: "everyday",
    name: "Everyday",
    icon: "calendar",
    tagline: "Dates, ages, time zones and unit conversions",
    seoTitle: "Date, Age and Unit Converters for Everyday Use",
    seoDescription: "Free age, date and time-zone calculators plus length, weight, temperature, area, volume, speed and fuel-economy converters with exact factors.",
    intro: [
      "Everyday questions usually come down to two things: how long between two moments, and how big something is in another unit. Date tools here use pure calendar arithmetic, so leap years and month lengths are handled exactly and nothing depends on your time zone. Time-zone conversion is the one exception — it uses your device's time-zone database.",
      "All converters read from one shared table of conversion factors, using the exact legal definitions (an inch is exactly 25.4 mm, a US gallon is exactly 231 cubic inches), so two pages never disagree with each other.",
    ],
    groups: [
      { title: "Dates and time", toolIds: ["age-calculator", "days-between-dates-calculator", "days-until-date-calculator", "date-add-subtract-calculator", "working-days-calculator", "timezone-converter"] },
      { title: "Unit converters", toolIds: ["unit-converter", "length-converter", "weight-converter", "temperature-converter", "area-converter", "volume-converter", "speed-converter", "fuel-economy-converter"] },
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
      { title: "Pay", toolIds: ["salary-increment-calculator", "salary-hike-percentage-calculator", "salary-comparison-calculator", "hourly-to-salary-calculator", "ctc-to-take-home-calculator"] },
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
      { title: "Loans", toolIds: ["emi-calculator", "amortization-schedule-calculator", "loan-interest-rate-calculator"] },
      { title: "Saving and investing", toolIds: ["sip-calculator", "fd-calculator", "rd-calculator", "compound-interest-calculator", "simple-interest-calculator", "cagr-calculator"] },
      { title: "Prices and inflation", toolIds: ["gst-calculator", "inflation-calculator"] },
    ],
  },
  {
    id: "developer",
    name: "Developer",
    icon: "code",
    tagline: "JSON, Base64, URLs, JWTs, regex, colours and more — all local",
    seoTitle: "Developer Tools — JSON, Base64, JWT, Regex, UUID",
    seoDescription: "Browser-based developer tools: JSON formatter and validator, Base64, URL encoding, JWT decoder, regex tester, UUID, timestamps, HTML/CSS formatters and QR codes.",
    intro: [
      "Everything on these pages runs in your browser. The JSON, tokens, text and code you paste are processed on your device and are never uploaded, stored or sent to analytics, so it is safe to paste real payloads while debugging. Share links are switched off for these tools for the same reason.",
      "Where behaviour differs between environments the page says so — the JSON tools follow the JSON specification strictly, the regex tester uses JavaScript's engine, and the JWT decoder only decodes: it never claims a token is valid.",
    ],
    groups: [
      { title: "JSON", toolIds: ["json-formatter", "json-validator", "json-minifier"] },
      { title: "Encoding and tokens", toolIds: ["base64-encode-decode", "url-encode-decode", "jwt-decoder", "uuid-generator", "unix-timestamp-converter"] },
      { title: "Code and text", toolIds: ["regex-tester", "html-formatter", "css-formatter", "color-converter", "word-counter", "case-converter", "qr-code-generator"] },
    ],
  },
  {
    id: "exams",
    name: "Exams",
    icon: "target",
    tagline: "Year-specific exam score calculators with sources",
    seoTitle: "Exam Score Calculators — SSC CGL and CHSL",
    seoDescription: "Year-specific SSC CGL and CHSL Tier-I score calculators. Each shows the marking scheme it uses, its source and the date it was checked.",
    intro: [
      "Exam rules change between notifications, so each calculator here is tied to a named exam cycle and lists the source of its marking scheme and when it was checked. If a rule is uncertain or has changed, the tool is withdrawn rather than guessed.",
      "These calculators estimate your raw marks from your own answer count. They do not predict cut-offs or normalised scores.",
    ],
    groups: [{ title: "SSC", toolIds: ["ssc-cgl-tier-1-score-calculator", "ssc-chsl-tier-1-score-calculator"] }],
  },
];

export const CATEGORY_BY_ID = new Map<CategoryId, CategoryDef>(CATEGORIES.map((c) => [c.id, c]));
export const isCategoryId = (x: string): x is CategoryId => CATEGORY_BY_ID.has(x as CategoryId);
