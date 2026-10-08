# Content-quality checklist (must hold before a tool is indexed)

Automated by `npm run validate:registry` / `validate:seo` unless marked *manual*.

- [ ] A useful primary tool above the fold; one clear purpose that no other page serves *(manual: does it solve a real problem?)*
- [ ] Calculation is correct: unit tests with independently derived expected values *(tests)*
- [ ] Clear one-sentence explanation under the H1 (30–260 chars)
- [ ] Formula or methodology in symbols **and** plain language
- [ ] ≥ 2 paragraphs of "how it works" (≥ 450 chars) with at least one contextual `[[link]]` to a related tool
- [ ] A realistic worked example (computed from the engine at build time)
- [ ] Assumptions / limitations listed; rounding explained where it matters
- [ ] Region, year, source URLs and `reviewedOn` for anything rule-dependent; `reviewal: "periodic"` *(enforced for Exams)*
- [ ] No factual claim that hasn't been verified *(manual — see "Verification record" in MAINTENANCE.md)*
- [ ] ≥ 3 related tools that reflect a real user journey, ≥ 1 in the same category
- [ ] Unique title (≤ 54 chars + site name), unique meta description (100–165 chars), self-canonical, one H1
- [ ] Reachable from its category page and from other tools; breadcrumbs + BreadcrumbList present
- [ ] Accessible (labels, errors tied to fields, keyboard) and usable at 320 px
- [ ] No fake freshness: `lastModified` / `reviewedOn` only set when the content was genuinely revised or re-checked
- [ ] Not too similar to a sibling page (`validate:seo` fails at 35 % shingle overlap)
