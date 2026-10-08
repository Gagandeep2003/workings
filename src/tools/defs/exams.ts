import { group } from "../define";
import { numberField } from "../inputs";
import { CGL_TIER1_SECTIONS, CHSL_TIER1_SECTIONS } from "@/engines/exams/ssc";

const sectionInputs = (sections: readonly { id: string; label: string }[]) =>
  sections.flatMap((s) => [
    numberField({ id: `${s.id}_c`, label: `${s.label} — correct`, integer: true, min: 0, max: 25, default: "0" }),
    numberField({ id: `${s.id}_w`, label: `${s.label} — wrong`, integer: true, min: 0, max: 25, default: "0" }),
  ]);

const ssc = group({ category: "exams", engineModule: "exams/ssc", tags: ["ssc", "exam", "india"], reviewal: "periodic", disclaimer: "exam", commercialIntent: "medium", affiliateProfile: { categories: ["exam-prep"], maxItems: 1 } }, [
  {
    id: "ssc-cgl-tier-1-score-calculator",
    title: "SSC CGL Tier 1 Score Calculator",
    h1: "SSC CGL Tier-I Score Calculator (2025 Pattern)",
    shortDescription: "Raw Tier-I score from correct and wrong answers per section, using the SSC CGL 2025 marking scheme.",
    seoTitle: "SSC CGL Tier 1 Score Calculator – 2025 Marking Scheme",
    seoDescription: "Estimate your SSC CGL Tier-I raw score from correct and wrong answers in each of the four sections: +2 per correct, −0.5 per wrong, 200 marks. 2025 pattern.",
    keywords: ["ssc cgl score calculator", "ssc cgl marks calculator", "ssc cgl tier 1", "ssc cgl negative marking", "cgl raw score"],
    aliases: ["ssc cgl marks calculator", "cgl tier 1 marks calculator", "ssc cgl tier i score", "ssc cgl normalisation", "cgl score calculator 2025"],
    phrases: ["how to calculate ssc cgl tier 1 marks", "ssc cgl 0.5 negative marking calculator", "cgl 2025 score calculator"],
    intro: "Enter the correct and wrong answers for each of the four 25-question sections to get your raw Tier-I score out of 200.",
    inputs: sectionInputs(CGL_TIER1_SECTIONS),
    submitLabel: "Calculate score",
    output: { primary: ["Raw score"] },
    formula: { expression: ["score = 2 × correct − 0.5 × wrong   (per section, then summed)"], where: ["4 sections × 25 questions × 2 marks = 200 marks", "Unattempted questions score 0"], plain: "Two marks for each right answer, minus half a mark for each wrong one." },
    howItWorks: [
      "SSC CGL (Combined Graduate Level) Tier-I is the first computer-based stage for graduate-level posts. Under the 2025 pattern it has four sections — General Intelligence and Reasoning, General Awareness, Quantitative Aptitude and English Comprehension — each with 25 questions, so 100 questions in all, worth 200 marks, to be answered in 60 minutes.",
      "Marking is +2 for a correct answer and −0.50 for a wrong one; skipping costs nothing. A candidate with 75 right and 14 wrong therefore scores 150 − 7 = 143. The section table shows where marks came from, which matters because the sections are listed in the order the 2025 paper uses and accuracy usually differs between them.",
      "Want to test a hypothetical scheme or a mock paper with different rules? Use the generic [[exam-score-calculator]]. The sister exam has its own page: [[ssc-chsl-tier-1-score-calculator]]. To express a score as a percentage use [[marks-percentage-calculator]].",
      "Treat the figure as raw marks computed from your own answer count. Multi-shift papers can be normalised and cut-offs are set after the exam, so neither can be predicted from this page.",
    ],
    examples: [{ title: "A sample attempt", inputs: { reasoning_c: "20", reasoning_w: "3", ga_c: "15", ga_w: "5", quant_c: "18", quant_w: "4", english_c: "22", english_w: "2" } }],
    assumptions: ["Applies to the Tier-I scheme of the 2025 notification cycle only. Later or earlier cycles may use a different pattern — check the official notice.", "Tier-II, normalisation and cut-offs are not modelled."],
    regulatory: {
      region: "India (Staff Selection Commission)",
      appliesTo: "SSC Combined Graduate Level Examination 2025 — Tier-I: 4 sections × 25 questions, 2 marks each, 0.50 negative marking",
      effectiveFrom: "2025-06-09",
      reviewedOn: "2026-10-03",
      sources: [
        { label: "Staff Selection Commission — official notices (verify against the current notice)", url: "https://ssc.gov.in/" },
        { label: "SSC CGL exam pattern (IIT Kanpur SATHEE, citing the 2025 notification)", url: "https://satheessc.iitk.ac.in/sathee-ssc/ssc-exams/ssc-cgl/ssc-details/exam-pattern" },
        { label: "SSC CGL 2025 notification summary (Careers360)", url: "https://competition.careers360.com/articles/ssc-cgl-2025" },
      ],
      note: "Scheme confirmed from secondary summaries of the notification dated 9 June 2025; the official notice is the authority. Effective date is the notification date.",
    },
    relatedTools: ["ssc-chsl-tier-1-score-calculator", "exam-score-calculator", "marks-percentage-calculator", "required-marks-calculator", "percentage-calculator"],
  },
  {
    id: "ssc-chsl-tier-1-score-calculator",
    title: "SSC CHSL Tier 1 Score Calculator",
    h1: "SSC CHSL Tier-I Score Calculator (2025 Pattern)",
    shortDescription: "Raw Tier-I score from correct and wrong answers per section, using the SSC CHSL 2025 marking scheme.",
    seoTitle: "SSC CHSL Tier 1 Score Calculator – 2025 Marking Scheme",
    seoDescription: "Estimate your SSC CHSL Tier-I raw score from correct and wrong answers in each of the four sections: +2 per correct, −0.5 per wrong, 200 marks. 2025 pattern.",
    keywords: ["ssc chsl score calculator", "ssc chsl marks calculator", "ssc chsl tier 1", "chsl negative marking", "chsl raw score"],
    aliases: ["ssc chsl marks calculator", "chsl tier 1 marks calculator", "ssc chsl tier i score", "chsl score calculator 2025", "chsl normalisation"],
    phrases: ["how to calculate ssc chsl tier 1 marks", "chsl 0.5 negative marking calculator", "chsl 2025 marks calculator"],
    intro: "Enter the correct and wrong answers for each of the four 25-question sections to get your raw Tier-I score out of 200.",
    inputs: sectionInputs(CHSL_TIER1_SECTIONS),
    submitLabel: "Calculate score",
    output: { primary: ["Raw score"] },
    formula: { expression: ["score = 2 × correct − 0.5 × wrong   (per section, then summed)"], where: ["4 sections × 25 questions × 2 marks = 200 marks", "Unattempted questions score 0"], plain: "Two marks for each right answer, minus half a mark for each wrong one." },
    howItWorks: [
      "SSC CHSL (Combined Higher Secondary Level) Tier-I is the opening computer-based test for posts that need a higher-secondary qualification. In the 2025 pattern the paper opens with English Language, followed by General Intelligence, Quantitative Aptitude and General Awareness: 25 questions apiece, 100 in total, 60 minutes, 200 marks.",
      "Every right answer adds 2 marks and every wrong answer subtracts 0.50; unattempted questions are neutral. Getting 65 right and 19 wrong gives 130 − 9.5 = 120.5. Enter the counts for each section and the table breaks the total down, along with your overall accuracy and the marks lost to penalties.",
      "Preparing with practice papers that use another scheme? The generic [[exam-score-calculator]] accepts any marking rules, and the graduate-level exam is covered by the [[ssc-cgl-tier-1-score-calculator]]. Turn your result into a percentage with [[marks-percentage-calculator]].",
      "The number shown is a raw score. SSC can normalise marks across shifts and publishes cut-offs only after each cycle, so neither is estimated here.",
    ],
    examples: [{ title: "A sample attempt", inputs: { english_c: "20", english_w: "2", reasoning_c: "20", reasoning_w: "2", quant_c: "10", quant_w: "10", ga_c: "15", ga_w: "5" } }],
    assumptions: ["Applies to the Tier-I scheme of the 2025 notification cycle only. Check the official notice for any other year.", "Tier-II, normalisation and cut-offs are not modelled."],
    regulatory: {
      region: "India (Staff Selection Commission)",
      appliesTo: "SSC Combined Higher Secondary Level Examination 2025 — Tier-I: 4 sections × 25 questions, 2 marks each, 0.50 negative marking",
      effectiveFrom: "2025-05-27",
      reviewedOn: "2026-10-03",
      sources: [
        { label: "Staff Selection Commission — official notices (verify against the current notice)", url: "https://ssc.gov.in/" },
        { label: "SSC CHSL 2025 exam pattern summary (Mahendras)", url: "https://www.mahendras.org/exams/ssc-chsl" },
      ],
      note: "Scheme confirmed from secondary summaries of the 2025 notification (released 27 May 2025); the official notice is the authority.",
    },
    relatedTools: ["ssc-cgl-tier-1-score-calculator", "exam-score-calculator", "marks-percentage-calculator", "required-marks-calculator", "percentage-calculator"],
  },
]);

export const examTools = [...ssc];
